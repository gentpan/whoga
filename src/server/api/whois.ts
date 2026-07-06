import type { RouteRequest } from "@/src/lib/http";
import { json } from "@/src/lib/http";
import { isValidDomain, isValidSuffix, normalizeDomain } from "@/lib/domain";
import { readFile } from "node:fs/promises";
import {
  buildDomainLookupUrl,
  ensureLocalDnsRegistryFresh,
  loadLocalDnsRegistry,
  resolveRdapBaseUrlFromExtraWithTrace
} from "@/lib/rdap-registry";
import { getCacheJson, setCacheJson } from "@/lib/cache";
import { recordWhoisQueryStat, type QueryStatsEntryPoint } from "@/lib/query-stats";
import { resolveReadableDataPath } from "@/lib/runtime-data";
import {
  buildRegistryFallbackResult,
  extractRootTld,
  fetchIanaRootMetadata,
  shouldRetryWithRegistryFallback,
  tryRegistryFallback,
  type RegistryFallbackResult
} from "@/lib/whois-fallback";
import { tryIpinfoLookup } from "@/lib/whois-external-fallback";
import { removeSuffixSupportRequestsForSuffix } from "@/lib/suffix-support-requests";
import {
  isSuffixSupportedForQuery,
  normalizeSuffixLabel,
  shouldTreatAsUnsupportedSuffix,
  UNSUPPORTED_SUFFIX_ERROR_CODE
} from "@/lib/suffix-support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTNIC_SEARCH_URL = "https://www.nic.tt/cgi-bin/search.pl";

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

const CACHE_KEY_PREFIX = "whoga:whois:v2:";
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

function toHttpStatus(status: number | undefined, fallback = 502): number {
  if (typeof status === "number" && status >= 200 && status <= 599) {
    return status;
  }
  return fallback;
}

async function sendRegistryFallbackResponse(
  sendJson: (
    body: Record<string, unknown>,
    status?: number,
    statMeta?: Record<string, unknown>
  ) => Response | Promise<Response>,
  cacheKey: string,
  queryLabel: string,
  queryType: QueryType,
  meta: { updatedAt: string; publication?: string | null },
  fallback: RegistryFallbackResult,
  match: {
    matchedSuffix: string | null;
    fallbackChain: string[];
    matchedSources: string[];
    resolver: string;
  }
): Promise<Response> {
  const matchedSources = [...match.matchedSources];
  if (fallback.provider) {
    matchedSources.push(fallback.provider);
  } else if (fallback.resolver === "whois-port43") {
    matchedSources.push("missing-tld-lookup.json");
  } else if (fallback.resolver === "whois-iana-referral") {
    matchedSources.push("whois.iana.org");
  } else if (fallback.resolver === "iana-root-metadata") {
    matchedSources.push("whois.iana.org");
  }

  const payload: WhoisApiCachePayload = {
    domain: queryLabel,
    queryType,
    rdapServer: null,
    source: {
      dnsJsonUrl: "https://data.iana.org/rdap/dns.json",
      localUpdatedAt: meta.updatedAt,
      publication: meta.publication,
      fallbackUsed: true
    },
    match: {
      matchedSuffix: fallback.rootTld,
      fallbackChain: match.fallbackChain.length > 0 ? match.fallbackChain : [fallback.rootTld],
      matchedSources,
      resolver: fallback.resolver
    },
    result: buildRegistryFallbackResult(fallback)
  };
  const cacheBackend = await setCacheJson(cacheKey, payload, cacheTtlSeconds());
  return sendJson(
    {
      ...payload,
      cache: {
        hit: false,
        backend: cacheBackend
      }
    },
    200,
    {
      normalizedQuery: queryLabel,
      cacheHit: false,
      rdapServer: null
    }
  );
}

async function sendUnsupportedSuffixJson(
  sendJson: (
    body: Record<string, unknown>,
    status?: number,
    statMeta?: Record<string, unknown>
  ) => Response | Promise<Response>,
  suffix: string,
  query: string
): Promise<Response> {
  const message = `Suffix .${suffix} is not supported yet`;
  return sendJson(
    {
      error: message,
      errorCode: UNSUPPORTED_SUFFIX_ERROR_CODE,
      suffix,
      query
    },
    422,
    {
      normalizedQuery: query,
      error: message,
      rdapServer: null
    }
  );
}

async function clearSuffixSupportRequestIfNeeded(query: string, queryType: QueryType): Promise<void> {
  if (queryType !== "domain" && queryType !== "suffix") {
    return;
  }
  const suffix =
    queryType === "suffix" ? normalizeSuffixLabel(query) : normalizeSuffixLabel(extractRootTld(query));
  if (!suffix) {
    return;
  }
  await removeSuffixSupportRequestsForSuffix(suffix);
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

function stripHtml(input: string): string {
  return cleanApiString(
    input
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|table|h1|h2|h3|li)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function cleanApiString(input: string): string {
  return input
    .replace(/&amp;(?:nbsp|#0*160|#x0*a0);?/gi, " ")
    .replace(/&(?:nbsp|#0*160|#x0*a0);?/gi, " ")
    .replace(/\u00c2[\u00a0 ]/g, " ")
    .replace(/[\u00a0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *(\r?\n) */g, "$1")
    .trim();
}

function sanitizeApiValue(input: unknown): unknown {
  if (typeof input === "string") {
    return cleanApiString(input);
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeApiValue(item));
  }
  if (!input || typeof input !== "object") {
    return input;
  }
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      sanitizeApiValue(value)
    ])
  );
}

function sanitizeRdapBody(body: Record<string, unknown> | null): Record<string, unknown> | null {
  const sanitized = sanitizeApiValue(body);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : null;
}

function parseTtnicHtml(html: string, domain: string): Record<string, unknown> | null {
  const availableMatch = html.match(/This Domain Name is available\./i);
  if (availableMatch) {
    return {
      objectClassName: "domain",
      handle: domain,
      ldhName: domain,
      unicodeName: domain,
      status: ["available"],
      notices: [
        {
          title: "TTNIC Search",
          description: [`${domain} is reported as available by TTNIC.`],
          links: [{ href: TTNIC_SEARCH_URL, value: TTNIC_SEARCH_URL, rel: "alternate", type: "text/html" }]
        }
      ]
    };
  }

  const rowRegex = /<tr><td>(.*?)<\/td>\s*<td>(.*?)<\/td><\/tr>/gis;
  const rows = new Map<string, string>();
  for (const match of html.matchAll(rowRegex)) {
    const key = stripHtml(match[1] ?? "");
    const value = stripHtml(match[2] ?? "");
    if (key && value) {
      rows.set(key, value);
    }
  }

  if (!rows.size) {
    return null;
  }

  const nameservers = (rows.get("DNS Hostnames") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((host) => ({ ldhName: host }));
  const statusText = rows.get("Expiration Date") ?? "";
  const registrationDate = rows.get("Registration Date") ?? "";
  const expirationDate = statusText.replace(/\s+ACTIVE\s*$/i, "").trim();
  const status = /ACTIVE/i.test(statusText) ? ["active"] : [];
  const registrantName = rows.get("Registrant Name") ?? "";
  const registrantAddress = rows.get("Registrant Address") ?? "";

  const result: Record<string, unknown> = {
    objectClassName: "domain",
    handle: domain,
    ldhName: rows.get("Domain Name") ?? domain,
    unicodeName: rows.get("Domain Name") ?? domain,
    name: registrantName || domain,
    status,
    nameservers,
    port43: "www.nic.tt/cgi-bin/search.pl",
    entities: registrantName
      ? [
          {
            objectClassName: "entity",
            roles: ["registrant"],
            vcardArray: [
              "vcard",
              [
                ["version", {}, "text", "4.0"],
                ["fn", {}, "text", registrantName],
                ...(registrantAddress ? [["adr", { label: registrantAddress }, "text", ["", "", "", "", "", "", ""]]] : [])
              ]
            ]
          }
        ]
      : [],
    remarks: [
      {
        title: "TTNIC HTML fallback",
        description: ["This result was parsed from the public TTNIC search page because no working RDAP endpoint is available."]
      }
    ],
    links: [{ href: TTNIC_SEARCH_URL, value: TTNIC_SEARCH_URL, rel: "alternate", type: "text/html" }]
  };

  if (registrationDate || expirationDate) {
    result.events = [
      ...(registrationDate ? [{ eventAction: "registration", eventDate: registrationDate }] : []),
      ...(expirationDate ? [{ eventAction: "expiration", eventDate: expirationDate }] : [])
    ];
  }

  return sanitizeRdapBody(result);
}

async function fetchTtnicDomain(domain: string): Promise<Record<string, unknown> | null> {
  const body = new URLSearchParams({
    name: domain,
    Search: "Search"
  });
  const response = await fetch(TTNIC_SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0"
    },
    body: body.toString(),
    cache: "no-store"
  });
  if (!response.ok) {
    return null;
  }
  const html = await response.text();
  return parseTtnicHtml(html, domain);
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
  try {
    const response = await fetch(targetUrl, {
      headers: { Accept: "application/rdap+json, application/json" },
      cache: "no-store"
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, status: response.status, body: sanitizeRdapBody(body) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return {
      ok: false,
      status: 0,
      body: sanitizeRdapBody({
        title: "RDAP network error",
        error: message
      })
    };
  }
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

export async function GET(request: RouteRequest): Promise<Response> {
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
    return json({
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
  const requestHost = (request.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";
  const entryPoint: QueryStatsEntryPoint = requestHost === "api.who.ga" ? "api" : "web";
  const requestStartedAt = Date.now();

  const sendJson = async (
    body: Record<string, unknown>,
    status = 200,
    options?: {
      normalizedQuery?: string;
      cacheHit?: boolean;
      rdapServer?: string | null;
      error?: string | null;
    }
  ): Promise<Response> => {
    if (status < 400 && (queryType === "domain" || queryType === "suffix")) {
      const resolvedQuery = options?.normalizedQuery ?? cacheQuery;
      void clearSuffixSupportRequestIfNeeded(resolvedQuery, queryType);
    }
    await recordWhoisQueryStat({
      rawQuery: rawInput,
      normalizedQuery: options?.normalizedQuery ?? rawInput,
      queryType,
      entryPoint,
      host: requestHost,
      success: status < 400,
      status,
      cacheHit: options?.cacheHit ?? false,
      durationMs: Date.now() - requestStartedAt,
      rdapServer: options?.rdapServer ?? null,
      error: options?.error ?? (typeof body.error === "string" ? body.error : null)
    });
    return json(body, { status });
  };

  try {
    const cached = await getCacheJson<WhoisApiCachePayload>(cacheKey);
    if (cached.hit && cached.value) {
      return sendJson(
        {
          ...cached.value,
          cache: {
            hit: true,
            backend: cached.backend
          }
        },
        200,
        {
          normalizedQuery: cacheQuery,
          cacheHit: true,
          rdapServer: cached.value.rdapServer ?? null
        }
      );
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
        const registryFallback =
          (await tryRegistryFallback(normalizedDomain, queryType)) ??
          (await fetchIanaRootMetadata(normalizedDomain, queryType));
        const suffixLabel =
          queryType === "suffix"
            ? normalizeSuffixLabel(normalizedDomain)
            : normalizeSuffixLabel(extractRootTld(normalizedDomain));
        const hasUsefulFallback =
          Boolean(registryFallback.whoisRaw) ||
          Boolean(registryFallback.externalData) ||
          (registryFallback.parsed
            ? Object.keys(registryFallback.parsed).some(
                (key) => key !== "message" && registryFallback.parsed?.[key]
              )
            : false);

        if (!hasUsefulFallback && suffixLabel && !(await isSuffixSupportedForQuery(suffixLabel))) {
          return sendUnsupportedSuffixJson(sendJson, suffixLabel, queryLabel);
        }

        if (queryType === "suffix" && suffixLabel && !(await isSuffixSupportedForQuery(suffixLabel))) {
          return sendUnsupportedSuffixJson(sendJson, suffixLabel, queryLabel);
        }

        return sendRegistryFallbackResponse(
          sendJson,
          cacheKey,
          queryLabel,
          queryType,
          meta,
          registryFallback,
          {
            matchedSuffix: null,
            fallbackChain,
            matchedSources: [],
            resolver: "none"
          }
        );
      }

      if (matchedSuffix === "tt") {
        if (queryType === "suffix") {
          return sendJson(
            {
              error: "TTNIC does not provide a public RDAP suffix endpoint; query a full .tt domain instead.",
              rdapServer: TTNIC_SEARCH_URL,
              match: {
                matchedSuffix,
                fallbackChain,
                matchedSources,
                resolver: "ttnic-html"
              }
            },
            400,
            {
              normalizedQuery: normalizedDomain,
              rdapServer: TTNIC_SEARCH_URL,
              error: "TTNIC does not provide a public RDAP suffix endpoint; query a full .tt domain instead."
            }
          );
        }

        const ttnicResult = await fetchTtnicDomain(normalizedDomain);
        if (ttnicResult) {
          const payload: WhoisApiCachePayload = {
            domain: queryLabel,
            queryType,
            rdapServer: TTNIC_SEARCH_URL,
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
              resolver: "ttnic-html"
            },
            resultSource: "registry",
            result: ttnicResult
          };
          const cacheBackend = await setCacheJson(cacheKey, payload, cacheTtlSeconds());
          return sendJson(
            {
              ...payload,
              cache: {
                hit: false,
                backend: cacheBackend
              }
            },
            200,
            {
              normalizedQuery: queryLabel,
              cacheHit: false,
              rdapServer: TTNIC_SEARCH_URL
            }
          );
        }
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
          return sendJson(
            {
              ...payload,
              cache: {
                hit: false,
                backend: cacheBackend
              }
            },
            200,
            {
              normalizedQuery: queryLabel,
              cacheHit: false,
              rdapServer: ianaFallbackBase
            }
          );
        }

        const reason =
          typeof fallbackTry.body?.error === "string"
            ? fallbackTry.body.error
            : typeof fallbackTry.body?.title === "string"
              ? fallbackTry.body.title
              : typeof firstTry.body?.error === "string"
                ? firstTry.body.error
                : typeof firstTry.body?.title === "string"
                  ? firstTry.body.title
                  : "RDAP query failed";
        const responseStatus =
          fallbackTry.status > 0 ? toHttpStatus(fallbackTry.status) : toHttpStatus(firstTry.status);
        const responseBody = fallbackTry.body ?? firstTry.body;
        const responseServer = fallbackTry.status > 0 ? ianaFallbackBase : rdapBase;

        if (shouldRetryWithRegistryFallback(responseStatus)) {
          const registryFallback =
            (await tryRegistryFallback(normalizedDomain, queryType)) ??
            (await fetchIanaRootMetadata(normalizedDomain, queryType));
          return sendRegistryFallbackResponse(
            sendJson,
            cacheKey,
            queryLabel,
            queryType,
            meta,
            registryFallback,
            {
              matchedSuffix,
              fallbackChain,
              matchedSources,
              resolver
            }
          );
        }

        const unsupported = await shouldTreatAsUnsupportedSuffix({
          query: normalizedDomain,
          queryType,
          error: reason,
          status: responseStatus
        });
        if (unsupported) {
          return sendUnsupportedSuffixJson(sendJson, unsupported.suffix, unsupported.query);
        }

        return sendJson(
          {
            error: reason,
            status: responseStatus,
            rdapServer: responseServer,
            match: {
              matchedSuffix,
              fallbackChain,
              matchedSources,
              resolver
            },
            result: responseBody
          },
          responseStatus,
          {
            normalizedQuery: normalizedDomain,
            rdapServer: responseServer,
            error: reason
          }
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
      return sendJson(
        {
          ...payload,
          cache: {
            hit: false,
            backend: cacheBackend
          }
        },
        200,
        {
          normalizedQuery: queryLabel,
          cacheHit: false,
          rdapServer: rdapBase
        }
      );
    } else if (queryType === "ip") {
      const registry = await readJson<BootstrapRegistry>(
        await resolveReadableDataPath(ipv4Value ? "ipv4.json" : "ipv6.json")
      );
      if (!registry) {
        return sendJson({ error: "IP RDAP registry is missing" }, 500, {
          normalizedQuery: rawInput,
          error: "IP RDAP registry is missing"
        });
      }
      rdapBase = resolveRdapBaseFromIp(rawInput, registry, ipv4Value ? "ipv4" : "ipv6");
      if (!rdapBase) {
        const ipinfo = await tryIpinfoLookup(rawInput, "ip");
        if (ipinfo) {
          return sendJson(
            {
              domain: rawInput,
              queryType,
              rdapServer: null,
              match: {
                matchedSuffix: null,
                fallbackChain: [],
                matchedSources: ["ipinfo.io"],
                resolver: "ipinfo-api"
              },
              result: { partial: false, ipinfo }
            },
            200,
            { normalizedQuery: rawInput, rdapServer: null }
          );
        }
        return sendJson(
          {
            domain: rawInput,
            queryType,
            rdapServer: null,
            match: {
              matchedSuffix: null,
              fallbackChain: [],
              matchedSources: [],
              resolver: "none"
            },
            result: {
              partial: true,
              message: `No RDAP routing entry found for ${rawInput}`
            }
          },
          200,
          { normalizedQuery: rawInput, rdapServer: null }
        );
      }
      targetUrl = buildIpLookupUrl(rdapBase, rawInput);
    } else if (queryType === "asn") {
      const registry = await readJson<BootstrapRegistry>(await resolveReadableDataPath("asn.json"));
      if (!registry) {
        return sendJson({ error: "ASN RDAP registry is missing" }, 500, {
          normalizedQuery: rawInput,
          error: "ASN RDAP registry is missing"
        });
      }
      const asn = asnValue ?? 0;
      rdapBase = resolveRdapBaseFromAsn(asn, registry);
      if (!rdapBase) {
        const ipinfo = await tryIpinfoLookup(String(asn), "asn");
        if (ipinfo) {
          return sendJson(
            {
              domain: `AS${asn}`,
              queryType,
              rdapServer: null,
              match: {
                matchedSuffix: null,
                fallbackChain: [],
                matchedSources: ["ipinfo.io"],
                resolver: "ipinfo-api"
              },
              result: { partial: false, ipinfo }
            },
            200,
            { normalizedQuery: `AS${asn}`, rdapServer: null }
          );
        }
        return sendJson(
          { error: `No RDAP server found for AS${asn}` },
          404,
          {
            normalizedQuery: `AS${asn}`,
            error: `No RDAP server found for AS${asn}`
          }
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
      const responseStatus = toHttpStatus(firstTry.status);

      if (queryType === "ip" && shouldRetryWithRegistryFallback(responseStatus)) {
        const ipinfo = await tryIpinfoLookup(rawInput, "ip");
        if (ipinfo) {
          return sendJson(
            {
              domain: rawInput,
              queryType,
              rdapServer: rdapBase,
              match: {
                matchedSuffix: null,
                fallbackChain: [],
                matchedSources: ["ipinfo.io"],
                resolver: "ipinfo-api"
              },
              result: { partial: true, rdapError: firstTry.body, ipinfo }
            },
            200,
            { normalizedQuery: rawInput, rdapServer: rdapBase }
          );
        }
      }

      return sendJson(
        {
          error: reason,
          status: responseStatus,
          rdapServer: rdapBase,
          result: firstTry.body
        },
        responseStatus,
        {
          normalizedQuery: queryLabel,
          rdapServer: rdapBase,
          error: reason
        }
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
    return sendJson(
      {
        ...payload,
        cache: {
          hit: false,
          backend: cacheBackend
        }
      },
      200,
      {
        normalizedQuery: queryLabel,
        cacheHit: false,
        rdapServer: rdapBase
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return sendJson({ error: message }, 500, {
      normalizedQuery: cacheQuery,
      error: message
    });
  }
}
