import { connect } from "node:net";
import { readFile } from "node:fs/promises";

import { tryExternalWhoisApis } from "@/lib/whois-external-fallback";
import { resolveReadableDataPath } from "@/lib/runtime-data";

type MissingTldEntry = {
  tld: string;
  whois?: string;
};

type MissingTldLookup = {
  results?: MissingTldEntry[];
};

export type RegistryFallbackResult = {
  rootTld: string;
  resolver: string;
  provider?: string;
  whoisHost?: string;
  whoisRaw?: string;
  parsed?: Record<string, string>;
  externalData?: Record<string, unknown>;
  partial: boolean;
  referralChain?: string[];
};

const IANA_WHOIS_HOST = "whois.iana.org";
const MAX_REFERRAL_HOPS = 3;
const NIC_WHOIS_PROBE_TIMEOUT_MS = 5000;

const NIC_WHOIS_HOST_PATTERNS = [
  "whois1.nic.{tld}",
  "whois.nic.{tld}",
  "whois2.nic.{tld}",
  "whois3.nic.{tld}",
  "whois1.registry.{tld}",
  "whois.registry.{tld}",
  "whois1.{tld}",
  "whois.{tld}",
  "whois.nic.net.{tld}",
  "whois.dns.{tld}"
];

type WhoisExtraHosts = {
  port43?: Record<string, string>;
  webRegistry?: Record<string, string>;
};

let cachedWhoisHosts: Map<string, string> | null = null;
let cachedExtraHosts: WhoisExtraHosts | null = null;
const discoveredWhoisHostCache = new Map<string, string>();

function normalizeWhoisHost(host: string): string {
  return host.trim().replace(/^whois:\/\//i, "").replace(/:\d+$/, "");
}

async function loadWhoisExtraHosts(): Promise<WhoisExtraHosts> {
  if (cachedExtraHosts) {
    return cachedExtraHosts;
  }

  try {
    const filePath = await resolveReadableDataPath("whois-extra-hosts.json");
    const raw = await readFile(filePath, "utf-8");
    cachedExtraHosts = JSON.parse(raw) as WhoisExtraHosts;
    return cachedExtraHosts;
  } catch {
    cachedExtraHosts = {};
    return cachedExtraHosts;
  }
}

async function loadWhoisHosts(): Promise<Map<string, string>> {
  if (cachedWhoisHosts) {
    return cachedWhoisHosts;
  }

  try {
    const filePath = await resolveReadableDataPath("missing-tld-lookup.json");
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as MissingTldLookup;
    const map = new Map<string, string>();
    for (const item of data.results ?? []) {
      const host = item.whois?.trim();
      if (host) {
        map.set(item.tld.toLowerCase(), normalizeWhoisHost(host));
      }
    }
    const extra = await loadWhoisExtraHosts();
    for (const [tld, host] of Object.entries(extra.port43 ?? {})) {
      if (host.trim()) {
        map.set(tld.toLowerCase(), normalizeWhoisHost(host));
      }
    }
    cachedWhoisHosts = map;
    return map;
  } catch {
    cachedWhoisHosts = new Map();
    return cachedWhoisHosts;
  }
}

export function extractRootTld(domainOrSuffix: string): string {
  const labels = domainOrSuffix.toLowerCase().split(".").filter(Boolean);
  return labels[labels.length - 1] ?? domainOrSuffix.toLowerCase();
}

async function queryWhoisPort43(host: string, query: string, timeoutMs = 12000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const socket = connect({ host, port: 43 }, () => {
      socket.write(`${query}\r\n`);
    });
    socket.setTimeout(timeoutMs);
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    socket.on("end", () => resolve(data.trim()));
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("WHOIS query timed out"));
    });
  });
}

function parseWhoisFields(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 .\-/]*?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      if (!fields[key]) {
        fields[key] = match[2].trim();
      }
    }
  }
  return fields;
}

function parseReferralHost(raw: string): string | null {
  let refer: string | null = null;
  let whois: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const lower = line.toLowerCase();
    if (lower.startsWith("refer:")) {
      const value = line.split(":", 2)[1]?.trim();
      if (value) {
        refer = normalizeWhoisHost(value);
      }
    } else if (lower.startsWith("whois:")) {
      const value = line.split(":", 2)[1]?.trim();
      if (value) {
        whois = normalizeWhoisHost(value);
      }
    }
  }
  return refer ?? whois;
}

function isIanaRootDbResponse(raw: string, query: string): boolean {
  const lower = raw.toLowerCase();
  if (!lower.includes("iana whois server")) {
    return false;
  }
  if (lower.includes("domain name:")) {
    return false;
  }
  const rootTld = extractRootTld(query);
  const parsed = parseWhoisFields(raw);
  return parsed.domain?.toLowerCase() === rootTld;
}

function isNoridBoilerplateOnly(raw: string): boolean {
  const lower = raw.toLowerCase();
  return (
    lower.includes("norid as holds the copyright") &&
    !lower.includes("domain name:") &&
    !lower.includes("no match")
  );
}

function isUsefulWhoisResponse(raw: string, query: string): boolean {
  if (!raw.trim() || isIanaRootDbResponse(raw, query) || isNoridBoilerplateOnly(raw)) {
    return false;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("domain name:") || lower.includes("registry domain id:")) {
    return true;
  }
  if (
    lower.includes("no match") ||
    lower.includes("not found") ||
    lower.includes("no data found") ||
    lower.includes("no object found") ||
    lower.includes("object not found") ||
    lower.includes("no entries found") ||
    lower.includes("%error:101") ||
    lower.includes("status: free")
  ) {
    return true;
  }
  if (lower.includes("tld is not supported") || lower.includes("tld not supported")) {
    return false;
  }
  return raw.length > 180 && !lower.includes("this query returned 1 object");
}

function hostsFromRegistryUrl(url: string): string[] {
  const hosts: string[] = [];
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (!host) {
      return hosts;
    }
    if (host.startsWith("www.")) {
      hosts.push(host.slice(4));
    }
    hosts.push(host);
    const base = host.startsWith("www.") ? host.slice(4) : host;
    hosts.push(`whois.${base}`, `whois1.${base}`);
    const whoisMatch = url.match(/whois[\w.-]+/i);
    if (whoisMatch && whoisMatch[0].includes(".")) {
      hosts.push(whoisMatch[0].toLowerCase());
    }
  } catch {
    return hosts;
  }
  return [...new Set(hosts.map(normalizeWhoisHost).filter(Boolean))];
}

async function getRemarkDerivedWhoisHosts(rootTld: string): Promise<string[]> {
  const extra = await loadWhoisExtraHosts();
  const webUrl = extra.webRegistry?.[rootTld];
  if (!webUrl) {
    return [];
  }
  return hostsFromRegistryUrl(webUrl);
}

async function getRegistryWebUrl(rootTld: string): Promise<string | null> {
  const extra = await loadWhoisExtraHosts();
  return extra.webRegistry?.[rootTld] ?? null;
}

async function tryPort43Whois(
  query: string,
  queryType: "domain" | "suffix",
  host: string,
  resolver: string
): Promise<RegistryFallbackResult | null> {
  const rootTld = extractRootTld(query);
  const whoisQuery = queryType === "suffix" ? rootTld : query;
  try {
    const whoisRaw = await queryWhoisPort43(host, whoisQuery);
    if (!whoisRaw || !isUsefulWhoisResponse(whoisRaw, whoisQuery)) {
      return null;
    }
    return {
      rootTld,
      resolver,
      whoisHost: host,
      whoisRaw,
      parsed: parseWhoisFields(whoisRaw),
      partial: false,
      referralChain: [host]
    };
  } catch {
    return null;
  }
}

function buildNicWhoisHostCandidates(rootTld: string): string[] {
  const hosts: string[] = [];
  for (const pattern of NIC_WHOIS_HOST_PATTERNS) {
    hosts.push(pattern.replace("{tld}", rootTld));
  }
  return hosts;
}

async function probeWhoisHost(host: string, query: string): Promise<boolean> {
  try {
    const raw = await queryWhoisPort43(host, query, NIC_WHOIS_PROBE_TIMEOUT_MS);
    return isUsefulWhoisResponse(raw, query);
  } catch {
    return false;
  }
}

async function discoverWhoisHostByNicPattern(
  rootTld: string,
  query: string,
  queryType: "domain" | "suffix"
): Promise<string | null> {
  const cached = discoveredWhoisHostCache.get(rootTld);
  if (cached) {
    return cached;
  }

  const whoisQuery = queryType === "suffix" ? rootTld : query;
  const remarkHosts = await getRemarkDerivedWhoisHosts(rootTld);
  const candidates = [
    ...remarkHosts,
    ...buildNicWhoisHostCandidates(rootTld)
  ];
  const seen = new Set<string>();

  for (const host of candidates) {
    if (!host || seen.has(host)) {
      continue;
    }
    seen.add(host);
    if (await probeWhoisHost(host, whoisQuery)) {
      discoveredWhoisHostCache.set(rootTld, host);
      return host;
    }
  }
  return null;
}

async function tryIanaReferralWhois(
  query: string,
  queryType: "domain" | "suffix"
): Promise<RegistryFallbackResult | null> {
  const rootTld = extractRootTld(query);
  const whoisQuery = queryType === "suffix" ? rootTld : query;
  const chain = [IANA_WHOIS_HOST];

  try {
    let raw = await queryWhoisPort43(IANA_WHOIS_HOST, whoisQuery);
    let nextHost = parseReferralHost(raw);

    for (let hop = 0; hop < MAX_REFERRAL_HOPS && nextHost; hop += 1) {
      if (nextHost === IANA_WHOIS_HOST) {
        break;
      }
      chain.push(nextHost);
      try {
        raw = await queryWhoisPort43(nextHost, whoisQuery);
      } catch {
        break;
      }
      if (isUsefulWhoisResponse(raw, whoisQuery)) {
        return {
          rootTld,
          resolver: "whois-iana-referral",
          whoisHost: nextHost,
          whoisRaw: raw,
          parsed: parseWhoisFields(raw),
          partial: false,
          referralChain: chain
        };
      }
      nextHost = parseReferralHost(raw);
    }

    if (raw && !isUsefulWhoisResponse(raw, whoisQuery)) {
      return null;
    }

    if (raw) {
      return {
        rootTld,
        resolver: "whois-iana-referral",
        whoisHost: chain[chain.length - 1] ?? IANA_WHOIS_HOST,
        whoisRaw: raw,
        parsed: parseWhoisFields(raw),
        partial: false,
        referralChain: chain
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchIanaRootMetadata(
  query: string,
  queryType: "domain" | "suffix"
): Promise<RegistryFallbackResult> {
  const rootTld = extractRootTld(query);
  const whoisQuery = queryType === "suffix" ? rootTld : query;
  const registryWebUrl = await getRegistryWebUrl(rootTld);

  try {
    const whoisRaw = await queryWhoisPort43(IANA_WHOIS_HOST, whoisQuery);
    const parsed = parseWhoisFields(whoisRaw);
    if (registryWebUrl) {
      parsed["registry web"] = registryWebUrl;
    }
    return {
      rootTld,
      resolver: "iana-root-metadata",
      whoisHost: IANA_WHOIS_HOST,
      whoisRaw,
      parsed,
      partial: true,
      referralChain: [IANA_WHOIS_HOST]
    };
  } catch {
    return {
      rootTld,
      resolver: "iana-root-metadata",
      partial: true,
      parsed: {
        message: `No registration registry endpoint is published for .${rootTld}`,
        ...(registryWebUrl ? { "registry web": registryWebUrl } : {})
      }
    };
  }
}

export async function tryRegistryFallback(
  query: string,
  queryType: "domain" | "suffix"
): Promise<RegistryFallbackResult | null> {
  const rootTld = extractRootTld(query);
  const hosts = await loadWhoisHosts();
  const mappedHost = hosts.get(rootTld);

  if (mappedHost) {
    const direct = await tryPort43Whois(query, queryType, mappedHost, "whois-port43");
    if (direct) {
      return direct;
    }
  }

  const discoveredHost = await discoverWhoisHostByNicPattern(rootTld, query, queryType);
  if (discoveredHost) {
    const discovered = await tryPort43Whois(query, queryType, discoveredHost, "whois-nic-pattern");
    if (discovered) {
      return discovered;
    }
  }

  const referral = await tryIanaReferralWhois(query, queryType);
  if (referral) {
    return referral;
  }

  const external = await tryExternalWhoisApis(queryType === "suffix" ? rootTld : query);
  if (external) {
    return {
      rootTld,
      resolver: "external-api",
      provider: external.provider,
      externalData: external.data,
      partial: external.partial,
      referralChain: [external.provider]
    };
  }

  return null;
}

export function shouldRetryWithRegistryFallback(status: number): boolean {
  if (status === 404 || status === 400 || status === 422) {
    return false;
  }
  return status === 0 || status >= 500 || status === 408 || status === 429;
}

export function buildRegistryFallbackResult(
  fallback: RegistryFallbackResult
): Record<string, unknown> {
  if (fallback.externalData) {
    return {
      partial: fallback.partial,
      provider: fallback.provider,
      external: fallback.externalData
    };
  }

  return {
    partial: fallback.partial,
    whoisRaw: fallback.whoisRaw ?? null,
    whoisHost: fallback.whoisHost ?? null,
    parsed: fallback.parsed ?? {},
    referralChain: fallback.referralChain ?? []
  };
}

/** @deprecated Use tryRegistryFallback */
export async function tryWhoisFallback(
  query: string,
  queryType: "domain" | "suffix"
): Promise<{
  rootTld: string;
  whoisHost: string;
  whoisRaw: string;
  parsed: Record<string, string>;
} | null> {
  const result = await tryRegistryFallback(query, queryType);
  if (!result?.whoisRaw || !result.whoisHost) {
    return null;
  }
  return {
    rootTld: result.rootTld,
    whoisHost: result.whoisHost,
    whoisRaw: result.whoisRaw,
    parsed: result.parsed ?? {}
  };
}
