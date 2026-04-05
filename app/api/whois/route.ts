import { NextRequest, NextResponse } from "next/server";
import { isValidDomain, isValidSuffix, normalizeDomain } from "@/lib/domain";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildDomainLookupUrl,
  ensureLocalDnsRegistryFresh,
  loadLocalDnsRegistry,
  resolveRdapBaseUrlFromExtraWithTrace
} from "@/lib/rdap-registry";
import { getCacheJson, setCacheJson } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const IPV4_FILE = path.join(DATA_DIR, "ipv4.json");
const IPV6_FILE = path.join(DATA_DIR, "ipv6.json");
const ASN_FILE = path.join(DATA_DIR, "asn.json");

type BootstrapRegistry = {
  services?: Array<[string[], string[]]>;
  publication?: string | null;
};

type QueryType = "domain" | "suffix" | "ip" | "asn" | "unknown";

type WhoisApiCachePayload = {
  domain: string;
  queryType: QueryType;
  rdapServer?: string | null;
  source?: {
    dnsJsonUrl: string;
    localUpdatedAt?: string;
    publication?: string | null;
    fallbackUsed: boolean;
  };
  match?: {
    matchedSuffix: string | null;
    fallbackChain: string[];
    matchedSources: string[];
    resolver: string;
  };
  registryResult?: Record<string, unknown> | null;
  registrarResult?: Record<string, unknown> | null;
  registrarRdapServer?: string | null;
  resultSource?: "registry" | "registrar";
  result: Record<string, unknown> | null;
};

const CACHE_KEY_PREFIX = "whoga:whois:v1:";
const CACHE_TTL_SECONDS = Number(process.env.WHOIS_CACHE_TTL_SECONDS ?? "900");

function toCacheKey(queryType: QueryType, query: string): string {
  return `${CACHE_KEY_PREFIX}${queryType}:${query}`;
}

function cacheTtlSeconds(): number {
  if (!Number.isFinite(CACHE_TTL_SECONDS) || CACHE_TTL_SECONDS < 30) {
    return 900;
  }
  return Math.floor(CACHE_TTL_SECONDS);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseAsn(input: string): number | null {
  const trimmed = input.trim().toUpperCase();
  const numeric = trimmed.startsWith("AS") ? trimmed.slice(2) : trimmed;
  if (!/^\d+$/.test(numeric)) {
    return null;
  }
  const value = Number(numeric);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseIpv4(input: string): bigint | null {
  const parts = input.trim().split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0n;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const num = Number(part);
    if (!Number.isFinite(num) || num < 0 || num > 255) {
      return null;
    }
    value = (value << 8n) + BigInt(num);
  }
  return value;
}

function parseIpv6(input: string): bigint | null {
  const value = input.trim().toLowerCase();
  if (!/^[0-9a-f:.]+$/.test(value)) {
    return null;
  }
  const [leftRaw, rightRaw] = value.split("::");
  if (value.includes("::") && value.split("::").length > 2) {
    return null;
  }
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];
  if (left.length + right.length > 8) {
    return null;
  }
  const fill = value.includes("::") ? 8 - (left.length + right.length) : 0;
  const parts = value.includes("::")
    ? [...left, ...Array(fill).fill("0"), ...right]
    : value.split(":");
  if (parts.length !== 8) {
    return null;
  }
  let total = 0n;
  for (const part of parts) {
    if (!/^[0-9a-f]{0,4}$/i.test(part)) {
      return null;
    }
    const num = parseInt(part || "0", 16);
    if (!Number.isFinite(num) || num < 0 || num > 0xffff) {
      return null;
    }
    total = (total << 16n) + BigInt(num);
  }
  return total;
}

function parseCidrIpv4(cidr: string): { base: bigint; prefix: number } | null {
  const [addr, prefixRaw] = cidr.split("/");
  const base = parseIpv4(addr);
  if (base === null) {
    return null;
  }
  const prefix = prefixRaw ? Number(prefixRaw) : 32;
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  return { base, prefix };
}

function parseCidrIpv6(cidr: string): { base: bigint; prefix: number } | null {
  const [addr, prefixRaw] = cidr.split("/");
  const base = parseIpv6(addr);
  if (base === null) {
    return null;
  }
  const prefix = prefixRaw ? Number(prefixRaw) : 128;
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 128) {
    return null;
  }
  return { base, prefix };
}

function maskBits(totalBits: number, prefix: number): bigint {
  if (prefix <= 0) {
    return 0n;
  }
  const all = (1n << BigInt(totalBits)) - 1n;
  const hostBits = BigInt(totalBits - prefix);
  const hostMask = hostBits > 0n ? (1n << hostBits) - 1n : 0n;
  return all ^ hostMask;
}

function ipv4InCidr(ip: bigint, cidr: string): boolean {
  const parsed = parseCidrIpv4(cidr);
  if (!parsed) {
    return false;
  }
  const mask = maskBits(32, parsed.prefix);
  return (ip & mask) === (parsed.base & mask);
}

function ipv6InCidr(ip: bigint, cidr: string): boolean {
  const parsed = parseCidrIpv6(cidr);
  if (!parsed) {
    return false;
  }
  const mask = maskBits(128, parsed.prefix);
  return (ip & mask) === (parsed.base & mask);
}

function resolveRdapBaseFromIp(ip: string, registry: BootstrapRegistry, version: "ipv4" | "ipv6"): string | null {
  const services = registry.services ?? [];
  const ipValue = version === "ipv4" ? parseIpv4(ip) : parseIpv6(ip);
  if (ipValue === null) {
    return null;
  }
  for (const service of services) {
    const [ranges, urls] = service;
    if (!urls?.length) {
      continue;
    }
    for (const range of ranges) {
      const match = version === "ipv4" ? ipv4InCidr(ipValue, range) : ipv6InCidr(ipValue, range);
      if (match) {
        return urls[0] ?? null;
      }
    }
  }
  return null;
}

function resolveRdapBaseFromAsn(asn: number, registry: BootstrapRegistry): string | null {
  const services = registry.services ?? [];
  for (const service of services) {
    const [ranges, urls] = service;
    if (!urls?.length) {
      continue;
    }
    for (const range of ranges) {
      const [startRaw, endRaw] = String(range).split("-");
      const start = Number(startRaw);
      const end = endRaw ? Number(endRaw) : start;
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      if (asn >= start && asn <= end) {
        return urls[0] ?? null;
      }
    }
  }
  return null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function buildIpLookupUrl(baseUrl: string, ip: string): string {
  return `${normalizeBaseUrl(baseUrl)}ip/${ip}`;
}

function buildAsnLookupUrl(baseUrl: string, asn: number): string {
  return `${normalizeBaseUrl(baseUrl)}autnum/${asn}`;
}

function buildSuffixFallbackChain(domain: string): string[] {
  const labels = domain
    .toLowerCase()
    .split(".")
    .filter((label) => label.length > 0);
  const chain: string[] = [];
  for (let start = 0; start < labels.length; start += 1) {
    chain.push(labels.slice(start).join("."));
  }
  return chain;
}

function resolveRdapFromDnsRegistryWithTrace(
  domain: string,
  registry: BootstrapRegistry
): {
  rdapBaseUrl: string | null;
  matchedSuffix: string | null;
  fallbackChain: string[];
} {
  const fallbackChain = buildSuffixFallbackChain(domain);
  for (const suffix of fallbackChain) {
    for (const service of registry.services ?? []) {
      const [zones, urls] = service;
      if (zones.includes(suffix) && urls.length > 0) {
        return {
          rdapBaseUrl: urls[0] ?? null,
          matchedSuffix: suffix,
          fallbackChain
        };
      }
    }
  }
  return {
    rdapBaseUrl: null,
    matchedSuffix: null,
    fallbackChain
  };
}

async function fetchRdapJson(targetUrl: string): Promise<{
  ok: boolean;
  status: number;
  body: Record<string, unknown> | null;
}> {
  const response = await fetch(targetUrl, {
    headers: { Accept: "application/rdap+json, application/json" },
    cache: "no-store"
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, body };
}

function resolveRegistrarLookupUrl(
  registryBody: Record<string, unknown> | null,
  registryBase: string,
  domain: string
): string | null {
  if (!registryBody) {
    return null;
  }
  const links = Array.isArray(registryBody.links) ? registryBody.links : [];
  const registryBaseNormalized = normalizeBaseUrl(registryBase);

  for (const rawLink of links) {
    if (!rawLink || typeof rawLink !== "object") {
      continue;
    }
    const link = rawLink as Record<string, unknown>;
    const href = typeof link.href === "string" ? link.href.trim() : "";
    const rel = typeof link.rel === "string" ? link.rel.trim().toLowerCase() : "";
    const type = typeof link.type === "string" ? link.type.trim().toLowerCase() : "";
    if (!href) {
      continue;
    }
    const isRdapLike = href.includes("rdap") || type.includes("rdap+json");
    const isRelated = rel === "related" || rel === "alternate";
    if (!isRdapLike || !isRelated) {
      continue;
    }

    let lookupUrl = href;
    if (!lookupUrl.includes("/domain/")) {
      lookupUrl = buildDomainLookupUrl(lookupUrl, domain);
    }
    if (lookupUrl.startsWith(registryBaseNormalized)) {
      continue;
    }
    return lookupUrl;
  }

  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const domainParam = request.nextUrl.searchParams.get("domain") ?? "";
  const rawInput = domainParam.trim();
  const normalizedDomain = normalizeDomain(rawInput);
  const isDomainQuery = isValidDomain(normalizedDomain);
  const isSuffixQuery = isValidSuffix(normalizedDomain);
  const asnValue = parseAsn(rawInput);
  const ipv4Value = parseIpv4(rawInput);
  const ipv6Value = ipv4Value === null ? parseIpv6(rawInput) : null;

  let queryType: QueryType = "unknown";
  if (asnValue !== null) {
    queryType = "asn";
  } else if (ipv4Value !== null || ipv6Value !== null) {
    queryType = "ip";
  } else if (isDomainQuery || isSuffixQuery) {
    queryType = isSuffixQuery ? "suffix" : "domain";
  }

  if (queryType === "unknown") {
    return NextResponse.json({
      domain: rawInput,
      queryType: "unknown",
      result: null
    });
  }

  const cacheQuery =
    queryType === "domain" || queryType === "suffix"
      ? normalizedDomain
      : queryType === "asn"
        ? String(asnValue ?? rawInput)
        : rawInput.toLowerCase();
  const cacheKey = toCacheKey(queryType, cacheQuery);

  try {
    const cached = await getCacheJson<WhoisApiCachePayload>(cacheKey);
    if (cached.hit && cached.value) {
      return NextResponse.json({
        ...cached.value,
        cache: {
          hit: true,
          backend: cached.backend
        }
      });
    }

    const meta = await ensureLocalDnsRegistryFresh();
    let rdapBase: string | null = null;
    let targetUrl = "";
    let queryLabel = rawInput;

    if (queryType === "domain" || queryType === "suffix") {
      queryLabel = normalizedDomain;
      const registry = await loadLocalDnsRegistry();
      const dnsResolved = resolveRdapFromDnsRegistryWithTrace(normalizedDomain, registry);
      rdapBase = dnsResolved.rdapBaseUrl;
      let matchedSuffix = dnsResolved.matchedSuffix;
      let fallbackChain = dnsResolved.fallbackChain;
      let matchedSources = rdapBase ? ["dns.json"] : [];
      let resolver: "dns-json" | "extra-json" = "dns-json";

      if (!rdapBase) {
        const extraResolved = await resolveRdapBaseUrlFromExtraWithTrace(normalizedDomain);
        rdapBase = extraResolved.rdapBaseUrl;
        matchedSuffix = extraResolved.matchedSuffix;
        fallbackChain = extraResolved.fallbackChain;
        matchedSources = extraResolved.matchedSources;
        resolver = "extra-json";
      }

      if (!rdapBase) {
        return NextResponse.json(
          {
            error: `No RDAP server found for ${normalizedDomain}`,
            match: {
              matchedSuffix: null,
              fallbackChain,
              matchedSources: [],
              resolver: "none"
            }
          },
          { status: 404 }
        );
      }

      targetUrl = buildDomainLookupUrl(rdapBase, normalizedDomain);
      const firstTry = await fetchRdapJson(targetUrl);

      if (!firstTry.ok) {
        const ianaFallbackBase = "https://rdap.iana.org/";
        const ianaTargetUrl = buildDomainLookupUrl(ianaFallbackBase, normalizedDomain);
        const fallbackTry = await fetchRdapJson(ianaTargetUrl);

        if (fallbackTry.ok) {
          const registrarLookupUrl = resolveRegistrarLookupUrl(
            fallbackTry.body,
            ianaFallbackBase,
            normalizedDomain
          );
          let registrarResult: Record<string, unknown> | null = null;
          let registrarRdapServer: string | null = null;
          if (registrarLookupUrl) {
            const registrarTry = await fetchRdapJson(registrarLookupUrl);
            if (registrarTry.ok && registrarTry.body) {
              registrarResult = registrarTry.body;
              try {
                registrarRdapServer = new URL(registrarLookupUrl).origin;
              } catch {
                registrarRdapServer = null;
              }
            }
          }

          const payload: WhoisApiCachePayload = {
            domain: queryLabel,
            queryType,
            rdapServer: ianaFallbackBase,
            source: {
              dnsJsonUrl: "https://data.iana.org/rdap/dns.json",
              localUpdatedAt: meta.updatedAt,
              publication: meta.publication,
              fallbackUsed: true
            },
            match: {
              matchedSuffix,
              fallbackChain,
              matchedSources,
              resolver
            },
            registryResult: fallbackTry.body,
            registrarResult,
            registrarRdapServer,
            resultSource: registrarResult ? "registrar" : "registry",
            result: registrarResult ?? fallbackTry.body
          };
          const cacheBackend = await setCacheJson(cacheKey, payload, cacheTtlSeconds());
          return NextResponse.json({
            ...payload,
            cache: {
              hit: false,
              backend: cacheBackend
            }
          });
        }

        const reason =
          typeof firstTry.body?.error === "string"
            ? firstTry.body.error
            : typeof firstTry.body?.title === "string"
              ? firstTry.body.title
              : "RDAP query failed";
        return NextResponse.json(
          {
            error: reason,
            status: firstTry.status,
            rdapServer: rdapBase,
            match: {
              matchedSuffix,
              fallbackChain,
              matchedSources,
              resolver
            },
            result: firstTry.body
          },
          { status: firstTry.status }
        );
      }

      const registrarLookupUrl = resolveRegistrarLookupUrl(firstTry.body, rdapBase, normalizedDomain);
      let registrarResult: Record<string, unknown> | null = null;
      let registrarRdapServer: string | null = null;
      if (registrarLookupUrl) {
        const registrarTry = await fetchRdapJson(registrarLookupUrl);
        if (registrarTry.ok && registrarTry.body) {
          registrarResult = registrarTry.body;
          try {
            registrarRdapServer = new URL(registrarLookupUrl).origin;
          } catch {
            registrarRdapServer = null;
          }
        }
      }

      const payload: WhoisApiCachePayload = {
        domain: queryLabel,
        queryType,
        rdapServer: rdapBase,
        source: {
          dnsJsonUrl: "https://data.iana.org/rdap/dns.json",
          localUpdatedAt: meta.updatedAt,
          publication: meta.publication,
          fallbackUsed: false
        },
        match: {
          matchedSuffix,
          fallbackChain,
          matchedSources,
          resolver
        },
        registryResult: firstTry.body,
        registrarResult,
        registrarRdapServer,
        resultSource: registrarResult ? "registrar" : "registry",
        result: registrarResult ?? firstTry.body
      };
      const cacheBackend = await setCacheJson(cacheKey, payload, cacheTtlSeconds());
      return NextResponse.json({
        ...payload,
        cache: {
          hit: false,
          backend: cacheBackend
        }
      });
    } else if (queryType === "ip") {
      const registry = await readJson<BootstrapRegistry>(ipv4Value ? IPV4_FILE : IPV6_FILE);
      if (!registry) {
        return NextResponse.json({ error: "IP RDAP registry is missing" }, { status: 500 });
      }
      rdapBase = resolveRdapBaseFromIp(rawInput, registry, ipv4Value ? "ipv4" : "ipv6");
      if (!rdapBase) {
        return NextResponse.json(
          { error: `No RDAP server found for ${rawInput}` },
          { status: 404 }
        );
      }
      targetUrl = buildIpLookupUrl(rdapBase, rawInput);
    } else if (queryType === "asn") {
      const registry = await readJson<BootstrapRegistry>(ASN_FILE);
      if (!registry) {
        return NextResponse.json({ error: "ASN RDAP registry is missing" }, { status: 500 });
      }
      const asn = asnValue ?? 0;
      rdapBase = resolveRdapBaseFromAsn(asn, registry);
      if (!rdapBase) {
        return NextResponse.json(
          { error: `No RDAP server found for AS${asn}` },
          { status: 404 }
        );
      }
      targetUrl = buildAsnLookupUrl(rdapBase, asn);
    }

    const firstTry = await fetchRdapJson(targetUrl);

    if (!firstTry.ok) {
      const reason =
        typeof firstTry.body?.error === "string"
          ? firstTry.body.error
          : typeof firstTry.body?.title === "string"
            ? firstTry.body.title
            : "RDAP query failed";
      return NextResponse.json(
        {
          error: reason,
          status: firstTry.status,
          rdapServer: rdapBase,
          result: firstTry.body
        },
        { status: firstTry.status }
      );
    }

    const payload: WhoisApiCachePayload = {
      domain: queryLabel,
      queryType,
      rdapServer: rdapBase,
      source: {
        dnsJsonUrl: "https://data.iana.org/rdap/dns.json",
        localUpdatedAt: meta.updatedAt,
        publication: meta.publication,
        fallbackUsed: false
      },
      result: firstTry.body
    };
    const cacheBackend = await setCacheJson(cacheKey, payload, cacheTtlSeconds());
    return NextResponse.json({
      ...payload,
      cache: {
        hit: false,
        backend: cacheBackend
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
