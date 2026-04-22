import { readFile } from "node:fs/promises";
import type { DnsRegistry, DnsRegistryMeta } from "@/lib/types";
import { resolveReadableDataPath } from "@/lib/runtime-data";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

interface UpdateMetaPayload {
  generatedAt?: string;
  categories?: {
    sync?: {
      dns?: DnsRegistryMeta;
      whois?: {
        updatedAt?: string;
      };
    };
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isDnsRegistry(value: unknown): value is DnsRegistry {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as DnsRegistry).services)
  );
}

export async function ensureLocalDnsRegistryFresh(force = false): Promise<DnsRegistryMeta> {
  await ensureWhoisDataFresh(force);
  const updateMetaFile = await resolveReadableDataPath("update-meta.json");
  const updateMeta = await readJson<UpdateMetaPayload>(updateMetaFile);
  const meta = updateMeta?.categories?.sync?.dns;
  if (meta) {
    return meta;
  }

  // Backward compatibility for older update-meta schema.
  const dnsFile = await resolveReadableDataPath("dns.json");
  const dnsData = await readJson<{ publication?: string }>(dnsFile);
  const fallbackUpdatedAt =
    updateMeta?.categories?.sync?.whois?.updatedAt ??
    updateMeta?.generatedAt ??
    new Date().toISOString();
  const fallbackMeta: DnsRegistryMeta = {
    updatedAt: fallbackUpdatedAt,
    sourceUrl: "https://data.iana.org/rdap/dns.json",
    publication: typeof dnsData?.publication === "string" ? dnsData.publication : undefined
  };

  if (!dnsData) {
    throw new Error("Local RDAP meta is missing and dns.json is unavailable");
  }
  return fallbackMeta;
}

export async function loadLocalDnsRegistry(): Promise<DnsRegistry> {
  await ensureLocalDnsRegistryFresh();
  const dnsFile = await resolveReadableDataPath("dns.json");
  const data = await readJson<DnsRegistry>(dnsFile);

  if (!data || !isDnsRegistry(data)) {
    throw new Error("Local RDAP registry is missing or corrupted");
  }

  return data;
}

interface MergedWhoisRecord {
  suffix: string;
  rdapUrl: string | null;
  sources?: string[];
}

interface MergedWhoisData {
  items: MergedWhoisRecord[];
}

export interface RdapMergedResolution {
  rdapBaseUrl: string | null;
  matchedSuffix: string | null;
  fallbackChain: string[];
  matchedSources: string[];
}

export interface RdapResolutionTrace {
  rdapBaseUrl: string | null;
  matchedSuffix: string | null;
  fallbackChain: string[];
  matchedSources: string[];
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

export async function resolveRdapBaseUrlFromMergedWithTrace(
  domain: string
): Promise<RdapMergedResolution> {
  await ensureLocalDnsRegistryFresh();
  const mergedFile = await resolveReadableDataPath("whois-merged.json");
  const merged = await readJson<MergedWhoisData>(mergedFile);
  const fallbackChain = buildSuffixFallbackChain(domain);

  if (!merged || !Array.isArray(merged.items)) {
    return {
      rdapBaseUrl: null,
      matchedSuffix: null,
      fallbackChain,
      matchedSources: []
    };
  }

  const map = new Map<string, { rdapUrl: string; sources: string[] }>();
  for (const item of merged.items) {
    if (!item?.suffix || !item?.rdapUrl) {
      continue;
    }
    map.set(item.suffix.toLowerCase(), {
      rdapUrl: item.rdapUrl,
      sources: Array.isArray(item.sources) ? item.sources : []
    });
  }

  for (const suffix of fallbackChain) {
    const matched = map.get(suffix);
    if (matched) {
      return {
        rdapBaseUrl: matched.rdapUrl,
        matchedSuffix: suffix,
        fallbackChain,
        matchedSources: matched.sources
      };
    }
  }

  return {
    rdapBaseUrl: null,
    matchedSuffix: null,
    fallbackChain,
    matchedSources: []
  };
}

export async function resolveRdapBaseUrlFromExtraWithTrace(
  domain: string
): Promise<RdapResolutionTrace> {
  await ensureLocalDnsRegistryFresh();
  const extraFile = await resolveReadableDataPath("rdap-servers-extra.json");
  const extra = await readJson<Record<string, unknown>>(extraFile);
  const fallbackChain = buildSuffixFallbackChain(domain);

  if (!extra || typeof extra !== "object") {
    return {
      rdapBaseUrl: null,
      matchedSuffix: null,
      fallbackChain,
      matchedSources: []
    };
  }

  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(extra)) {
    if (typeof key === "string" && typeof value === "string" && key.trim() && value.trim()) {
      const normalizedUrl = value.trim();
      let host = "";
      try {
        host = new URL(normalizedUrl).hostname.toLowerCase();
      } catch {
        host = "";
      }
      if (host === "rdap.org" || host === "www.rdap.org") {
        continue;
      }
      map.set(key.trim().toLowerCase(), normalizedUrl);
    }
  }

  for (const suffix of fallbackChain) {
    const url = map.get(suffix);
    if (url) {
      return {
        rdapBaseUrl: url,
        matchedSuffix: suffix,
        fallbackChain,
        matchedSources: ["rdap-servers-extra.json"]
      };
    }
  }

  return {
    rdapBaseUrl: null,
    matchedSuffix: null,
    fallbackChain,
    matchedSources: []
  };
}

export async function resolveRdapBaseUrlFromMerged(domain: string): Promise<string | null> {
  const resolved = await resolveRdapBaseUrlFromMergedWithTrace(domain);
  return resolved.rdapBaseUrl;
}

export function resolveRdapBaseUrl(domain: string, registry: DnsRegistry): string | null {
  const labels = domain.toLowerCase().split(".");

  for (let start = 0; start < labels.length; start += 1) {
    const suffix = labels.slice(start).join(".");

    for (const service of registry.services) {
      const [zones, urls] = service;
      if (zones.includes(suffix) && urls.length > 0) {
        return urls[0];
      }
    }
  }

  return null;
}

export function buildDomainLookupUrl(baseUrl: string, domain: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}domain/${domain}`;
}
