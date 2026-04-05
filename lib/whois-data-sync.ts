import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DnsRegistryMeta } from "@/lib/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DATA_DIR = path.join(process.cwd(), "data");

const DNS_FILE = path.join(DATA_DIR, "dns.json");
const EXTRA_FILE = path.join(DATA_DIR, "rdap-servers-extra.json");
const PSL_FILE = path.join(DATA_DIR, "public_suffix_list.dat");
const MERGED_FILE = path.join(DATA_DIR, "whois-merged.json");
const BRAND_TLDS_FILE = path.join(DATA_DIR, "brand-tlds.json");
const GEO_TLDS_FILE = path.join(DATA_DIR, "geo-tlds.json");
const ASN_FILE = path.join(DATA_DIR, "asn.json");
const IPV4_FILE = path.join(DATA_DIR, "ipv4.json");
const IPV6_FILE = path.join(DATA_DIR, "ipv6.json");
const OBJECT_TAGS_FILE = path.join(DATA_DIR, "object-tags.json");
const REGISTRIES_FILE = path.join(DATA_DIR, "registries.json");
const TLD_CATEGORIES_FILE = path.join(DATA_DIR, "tld-categories.json");
const TLD_FILE = path.join(DATA_DIR, "tld.json");
const TLD_LIST_FILE = path.join(DATA_DIR, "tlds-iana-list.json");
const TLDS_FILE = path.join(DATA_DIR, "tlds.json");
const CANNOT_QUERY_ROOT_TLDS_FILE = path.join(DATA_DIR, "cannot-query-root-tlds.txt");
const UPDATE_META_FILE = path.join(DATA_DIR, "update-meta.json");

const DNS_SOURCE_URL = "https://data.iana.org/rdap/dns.json";
const PSL_SOURCE_URL = "https://publicsuffix.org/list/public_suffix_list.dat";
const GTLDS_SOURCE_URL = "https://www.icann.org/resources/registries/gtlds/v2/gtlds.json";
const ASN_SOURCE_URL = "https://data.iana.org/rdap/asn.json";
const IPV4_SOURCE_URL = "https://data.iana.org/rdap/ipv4.json";
const IPV6_SOURCE_URL = "https://data.iana.org/rdap/ipv6.json";
const OBJECT_TAGS_SOURCE_URL = "https://data.iana.org/rdap/object-tags.json";
const TLD_LIST_SOURCE_URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";
const ROOT_DB_URL = "https://www.iana.org/domains/root/db";
const ROOT_DB_PREFIX = "https://www.iana.org";
const GEO_TLDS_SOURCE_URL = process.env.GEO_TLDS_SOURCE_URL;
const EXTRA_SOURCE_URL = process.env.RDAP_EXTRA_SOURCE_URL;

interface ServiceRecord {
  suffix: string;
  rdapUrl: string | null;
  sources: string[];
}

interface SyncResult {
  updatedAt: string;
  mergedSummary: {
    dns_json_suffixes: number;
    rdap_servers_iana_suffixes: number;
    rdap_servers_extra_suffixes: number;
    public_suffix_list_suffixes: number;
    dns_meta_records: number;
    unique_queryable_suffixes: number;
    with_rdap_url: number;
    without_rdap_url: number;
  };
  publication: string | null;
}

interface CacheMeta {
  lastAccessAt: string;
  lastRefreshAt: string;
}

interface WhoisSyncMeta {
  updatedAt: string;
  sources: {
    dns: string;
    publicSuffixList: string;
    gtldsJson: string;
    geoTlds: string;
    rdapExtra: string;
  };
}

interface TldListMeta {
  lastSyncedAt: string;
  tldCount: number;
  fileSize: number;
  source: string;
}

interface UpdateMeta {
  generatedAt: string;
  categories: {
    cache?: CacheMeta;
    sync: {
      whois?: WhoisSyncMeta;
      dns?: DnsRegistryMeta;
      tldList?: TldListMeta;
      rdapBootstrap?: { updatedAt: string };
    };
  };
}

interface GtldEntry {
  gTLD?: string;
  uLabel?: string;
  specification13?: boolean;
  contractTerminated?: boolean;
  removalDate?: string | null;
}

interface GtldsPayload {
  gTLDs?: GtldEntry[];
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function downloadJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

async function downloadText(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to download ${url}: ${response.status}`);
  }
  return await response.text();
}

async function downloadJsonOrLocal(url: string, filePath: string): Promise<Record<string, unknown>> {
  try {
    return await downloadJson(url);
  } catch {
    const local = await readJson<Record<string, unknown>>(filePath);
    if (local) {
      return local;
    }
    throw new Error(`Unable to download ${url} and no local cache available`);
  }
}

async function downloadTextOrLocal(url: string, filePath: string): Promise<string> {
  try {
    return await downloadText(url);
  } catch {
    const local = await readText(filePath);
    if (local) {
      return local;
    }
    throw new Error(`Unable to download ${url} and no local cache available`);
  }
}

function normalizeTldLabel(label: string): string | null {
  const cleaned = label.trim().replace(/^\./, "").toLowerCase();
  if (!cleaned) {
    return null;
  }
  return cleaned;
}

function extractActiveGtlds(payload: GtldsPayload): Set<string> {
  const set = new Set<string>();
  for (const entry of payload.gTLDs ?? []) {
    const label = normalizeTldLabel(entry.gTLD ?? entry.uLabel ?? "");
    if (!label) {
      continue;
    }
    if (entry.contractTerminated || entry.removalDate) {
      continue;
    }
    set.add(label);
  }
  return set;
}

function extractBrandTlds(payload: GtldsPayload): string[] {
  const list: string[] = [];
  for (const entry of payload.gTLDs ?? []) {
    if (!entry.specification13) {
      continue;
    }
    if (entry.contractTerminated || entry.removalDate) {
      continue;
    }
    const label = normalizeTldLabel(entry.gTLD ?? entry.uLabel ?? "");
    if (label) {
      list.push(label);
    }
  }
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

function extractGeoTlds(html: string, activeGtlds: Set<string>): string[] {
  const list: string[] = [];
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rowMatches) {
    const cellMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!cellMatch) {
      continue;
    }
    const text = stripHtml(cellMatch[1] ?? "");
    const token = text.split(/\s+/)[0] ?? "";
    const normalized = normalizeTldLabel(token);
    if (!normalized) {
      continue;
    }
    if (normalized === "tld") {
      continue;
    }
    if (activeGtlds.size > 0 && !activeGtlds.has(normalized)) {
      continue;
    }
    list.push(normalized);
  }
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h1|h2|h3|p|li|tr|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toLines(html: string): string[] {
  const raw = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(h1|h2|h3|p|li|tr|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRootDbIndex(html: string): { tld: string; type: string; manager: string; href: string }[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const items: { tld: string; type: string; manager: string; href: string }[] = [];
  for (const row of rows) {
    const cells = row.match(/<td[\s\S]*?<\/td>/gi) ?? [];
    if (cells.length < 3) {
      continue;
    }
    const tldCell = cells[0] ?? "";
    const linkMatch = tldCell.match(/href="([^"]+)"/i);
    const tldText = stripHtml(tldCell);
    if (!tldText.startsWith(".")) {
      continue;
    }
    const tld = tldText.replace(/^\./, "").trim();
    const href = linkMatch ? new URL(linkMatch[1], ROOT_DB_PREFIX).toString() : "";
    const type = stripHtml(cells[1] ?? "");
    const manager = stripHtml(cells[2] ?? "");
    items.push({ tld, type, manager, href });
  }
  return items;
}

function parseContact(lines: string[]): { lines: string[]; email?: string; voice?: string; fax?: string } {
  const result = { lines: [] as string[], email: undefined as string | undefined, voice: undefined as string | undefined, fax: undefined as string | undefined };
  for (const line of lines) {
    if (line.startsWith("Email:")) {
      result.email = line.replace(/^Email:\s*/, "").trim();
      continue;
    }
    if (line.startsWith("Voice:")) {
      result.voice = line.replace(/^Voice:\s*/, "").trim();
      continue;
    }
    if (line.startsWith("Fax:")) {
      result.fax = line.replace(/^Fax:\s*/, "").trim();
      continue;
    }
    result.lines.push(line);
  }
  return result;
}

function parseNameServers(lines: string[]): { host: string; ips: string[] }[] {
  const entries: { host: string; ips: string[] }[] = [];
  let current: { host: string; ips: string[] } | null = null;
  const isIp = (value: string) => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || /:/.test(value);
  for (const line of lines) {
    if (line.toLowerCase().startsWith("host name")) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && parts[0].includes(".") && isIp(parts[1])) {
      current = { host: parts[0], ips: [parts[1]] };
      entries.push(current);
      continue;
    }
    if (isIp(line) && current) {
      current.ips.push(line);
    }
  }
  return entries;
}

function parseRegistryInfo(lines: string[]): { url?: string; whois?: string; rdap?: string } {
  const info: { url?: string; whois?: string; rdap?: string } = {};
  for (const line of lines) {
    if (line.startsWith("URL for registration services:")) {
      info.url = line.replace(/^URL for registration services:\s*/, "").trim();
    } else if (line.startsWith("WHOIS Server:")) {
      info.whois = line.replace(/^WHOIS Server:\s*/, "").trim();
    } else if (line.startsWith("RDAP Server:")) {
      info.rdap = line.replace(/^RDAP Server:\s*/, "").trim();
    }
  }
  return info;
}

function parseIanaReports(lines: string[]): { title: string; date?: string }[] {
  const reports: { title: string; date?: string }[] = [];
  for (const line of lines) {
    const match = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const date = match?.[1];
    const title = line.replace(/\(\d{4}-\d{2}-\d{2}\)\s*$/, "").trim();
    if (title) {
      reports.push({ title, date });
    }
  }
  return reports;
}

function parseRootDbDetail(html: string): {
  delegationType?: string;
  sponsoringOrganisation?: string[];
  administrativeContact?: ReturnType<typeof parseContact>;
  technicalContact?: ReturnType<typeof parseContact>;
  nameServers?: { host: string; ips: string[] }[];
  registryInformation?: ReturnType<typeof parseRegistryInfo>;
  ianaReports?: ReturnType<typeof parseIanaReports>;
  recordLastUpdated?: string;
  registrationDate?: string;
} {
  const lines = toLines(html);
  const headings = new Set([
    "Sponsoring Organisation",
    "Administrative Contact",
    "Technical Contact",
    "Name Servers",
    "Registry Information",
    "IANA Reports",
    "Domain Names"
  ]);

  const getSection = (heading: string): string[] => {
    const start = lines.findIndex((line) => line === heading);
    if (start === -1) {
      return [];
    }
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      if (headings.has(lines[i])) {
        break;
      }
      out.push(lines[i]);
    }
    return out;
  };

  const typeLine = lines.find((line) => line.startsWith("(") && line.includes("top-level domain"));
  const delegationType = typeLine ? typeLine.replace(/[()]/g, "").trim() : undefined;

  const sponsoring = getSection("Sponsoring Organisation");
  const admin = parseContact(getSection("Administrative Contact"));
  const tech = parseContact(getSection("Technical Contact"));
  const nameServers = parseNameServers(getSection("Name Servers"));
  const registry = parseRegistryInfo(getSection("Registry Information"));
  const reports = parseIanaReports(getSection("IANA Reports"));

  const recordLine = lines.find((line) => line.startsWith("Record last updated"));
  let recordLastUpdated: string | undefined;
  let registrationDate: string | undefined;
  if (recordLine) {
    const match = recordLine.match(/Record last updated\s+(\d{4}-\d{2}-\d{2})\.\s*Registration date\s+(\d{4}-\d{2}-\d{2})/);
    if (match) {
      recordLastUpdated = match[1];
      registrationDate = match[2];
    }
  }

  return {
    delegationType,
    sponsoringOrganisation: sponsoring,
    administrativeContact: admin,
    technicalContact: tech,
    nameServers,
    registryInformation: registry,
    ianaReports: reports,
    recordLastUpdated,
    registrationDate
  };
}

function mapFromServices(services: unknown): Map<string, string | null> {
  const map = new Map<string, string | null>();
  if (!Array.isArray(services)) {
    return map;
  }

  for (const service of services) {
    const row = service as unknown[];
    const zones = Array.isArray(row?.[0]) ? (row[0] as unknown[]) : [];
    const urls = Array.isArray(row?.[1]) ? (row[1] as unknown[]) : [];
    const firstUrl = urls.length > 0 ? String(urls[0]) : null;

    for (const zone of zones) {
      map.set(String(zone).toLowerCase(), firstUrl);
    }
  }

  return map;
}

function mapFromObject(input: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return map;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim().length > 0) {
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
      map.set(key.toLowerCase(), normalizedUrl);
    }
  }

  return map;
}

function setFromPsl(raw: string): Set<string> {
  const set = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    if (trimmed.includes(" ")) {
      continue;
    }
    const normalized = trimmed.replace(/^\*\./, "").replace(/^!/, "").toLowerCase();
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

function groupRegistries(
  dnsServices: unknown,
  extraMap: Map<string, string>
): { rdapUrl: string; zones: string[] }[] {
  const registryMap = new Map<string, Set<string>>();
  const dnsMap = mapFromServices(dnsServices);
  for (const [suffix, url] of dnsMap) {
    if (!url) {
      continue;
    }
    if (!registryMap.has(url)) {
      registryMap.set(url, new Set());
    }
    registryMap.get(url)?.add(suffix);
  }
  for (const [suffix, url] of extraMap) {
    if (!url) {
      continue;
    }
    if (!registryMap.has(url)) {
      registryMap.set(url, new Set());
    }
    registryMap.get(url)?.add(suffix);
  }
  return [...registryMap.entries()]
    .map(([rdapUrl, zones]) => ({
      rdapUrl,
      zones: [...zones].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.rdapUrl.localeCompare(b.rdapUrl));
}

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const cleaned = input
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(cleaned)].sort((a, b) => a.localeCompare(b));
}

async function readCannotQueryRootTlds(): Promise<string[]> {
  const raw = await readText(CANNOT_QUERY_ROOT_TLDS_FILE);
  if (!raw) {
    return [];
  }
  const list = raw
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

function buildTldCategories(
  queryableSuffixes: string[],
  brandTlds: Set<string>,
  geoTlds: Set<string>
): { counts: Record<string, number>; lists: Record<string, string[]> } {
  const counts: Record<string, number> = {
    gTld: 0,
    ccTld: 0,
    newGtld: 0,
    sTld: 0,
    brandTld: 0,
    geoTld: 0,
    total: queryableSuffixes.length
  };
  const lists: Record<string, string[]> = {
    gTld: [],
    ccTld: [],
    newGtld: [],
    sTld: [],
    brandTld: [],
    geoTld: []
  };

  const legacy = new Set(["arpa", "biz", "com", "info", "name", "net", "org", "pro", "xxx"]);
  const sponsored = new Set([
    "aero",
    "asia",
    "cat",
    "coop",
    "edu",
    "gov",
    "int",
    "jobs",
    "mil",
    "mobi",
    "museum",
    "post",
    "tel",
    "travel"
  ]);

  const isAsciiCc = (tld: string) => /^[a-z]{2}$/.test(tld);

  for (const suffix of queryableSuffixes) {
    const labels = suffix.split(".");
    const rootTld = labels[labels.length - 1] ?? suffix;
    let bucket = "newGtld";
    if (isAsciiCc(rootTld)) {
      bucket = "ccTld";
    } else if (sponsored.has(rootTld)) {
      bucket = "sTld";
    } else if (brandTlds.has(rootTld)) {
      bucket = "brandTld";
    } else if (geoTlds.has(rootTld)) {
      bucket = "geoTld";
    } else if (legacy.has(rootTld)) {
      bucket = "gTld";
    }
    counts[bucket] += 1;
    lists[bucket].push(suffix);
  }

  for (const key of Object.keys(lists)) {
    lists[key] = [...new Set(lists[key])].sort((a, b) => a.localeCompare(b));
  }

  return { counts, lists };
}

function upsertRecord(
  target: Map<string, ServiceRecord>,
  suffix: string,
  rdapUrl: string | null,
  source: string
): void {
  if (!target.has(suffix)) {
    target.set(suffix, { suffix, rdapUrl, sources: [source] });
    return;
  }

  const current = target.get(suffix);
  if (!current) {
    return;
  }
  if (!current.sources.includes(source)) {
    current.sources.push(source);
  }
  if (!current.rdapUrl && rdapUrl) {
    current.rdapUrl = rdapUrl;
  }
}

async function rebuildMergedFile(): Promise<SyncResult["mergedSummary"]> {
  const dns = await readJson<Record<string, unknown>>(DNS_FILE);
  const extra = await readJson<Record<string, unknown>>(EXTRA_FILE);
  const pslRaw = await readText(PSL_FILE);
  const updateMeta = await readJson<UpdateMeta>(UPDATE_META_FILE);
  const dnsMeta = updateMeta?.categories?.sync?.dns ?? null;

  const dnsMap = mapFromServices(dns?.services);
  const extraMap = mapFromObject(extra);
  const pslSet = pslRaw ? setFromPsl(pslRaw) : new Set<string>();

  const merged = new Map<string, ServiceRecord>();
  for (const [suffix, url] of dnsMap) {
    upsertRecord(merged, suffix, url, "dns.json");
  }
  for (const [suffix, url] of extraMap) {
    upsertRecord(merged, suffix, url, "rdap-servers-extra.json");
  }
  for (const suffix of pslSet) {
    upsertRecord(merged, suffix, null, "public_suffix_list.dat");
  }

  const items = [...merged.values()].sort((a, b) => a.suffix.localeCompare(b.suffix));
  const summary = {
    dns_json_suffixes: dnsMap.size,
    rdap_servers_iana_suffixes: 0,
    rdap_servers_extra_suffixes: extraMap.size,
    public_suffix_list_suffixes: pslSet.size,
    dns_meta_records: dnsMeta ? 1 : 0,
    unique_queryable_suffixes: items.length,
    with_rdap_url: items.filter((item) => Boolean(item.rdapUrl)).length,
    without_rdap_url: items.filter((item) => !item.rdapUrl).length
  };

  const pslVersion =
    (pslRaw?.match(/^\/\/ VERSION:\s*(.+)$/m) ?? [])[1] ?? null;

  const mergedPayload = {
    generatedAt: new Date().toISOString(),
    sourceMeta: {
      dnsMeta,
      dnsPublication: typeof dns?.publication === "string" ? dns.publication : null,
      pslVersion
    },
    summary,
    items
  };
  await writeFile(MERGED_FILE, JSON.stringify(mergedPayload, null, 2), "utf-8");
  return summary;
}

async function readCacheMeta(): Promise<CacheMeta | null> {
  const meta = await readJson<UpdateMeta>(UPDATE_META_FILE);
  const cache = meta?.categories?.cache;
  if (!cache?.lastAccessAt || !cache?.lastRefreshAt) {
    return null;
  }
  return cache;
}

async function updateMetaFile(
  updater: (current: UpdateMeta) => UpdateMeta
): Promise<UpdateMeta> {
  const current =
    (await readJson<UpdateMeta>(UPDATE_META_FILE)) ??
    ({
      generatedAt: new Date().toISOString(),
      categories: { sync: {} }
    } as UpdateMeta);
  const next = updater(current);
  next.generatedAt = new Date().toISOString();
  await writeFile(UPDATE_META_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

async function writeCacheMeta(meta: CacheMeta): Promise<void> {
  await updateMetaFile((current) => ({
    ...current,
    categories: {
      sync: current.categories?.sync ?? {},
      cache: meta
    }
  }));
}

/**
 * Sync TLD list from IANA and convert to JSON
 */
async function syncTldList(): Promise<
  { tlds: string[]; count: number; version: string; generatedAt: string; meta: TldListMeta } | null
> {
  try {
    const response = await downloadText(TLD_LIST_SOURCE_URL);
    const lines = response.split("\n").map((line) => line.trim());

    // Parse: skip comments and empty lines
    let version = "unknown";
    const tlds: string[] = [];

    for (const line of lines) {
      if (line.startsWith("#")) {
        if (line.startsWith("# Version:")) {
          version = line.substring("# Version:".length).trim();
        }
      } else if (line.length > 0) {
        const tld = line.toLowerCase();
        if (/^[a-z0-9\-]+$/.test(tld)) {
          tlds.push(tld);
        }
      }
    }

    const now = new Date().toISOString();
    const basePayload = {
      tlds,
      count: tlds.length,
      generatedAt: now,
      source: TLD_LIST_SOURCE_URL,
      version
    };

    const payload = {
      ...basePayload,
      meta: {
        lastSyncedAt: now,
        tldCount: tlds.length,
        fileSize: Buffer.byteLength(JSON.stringify(basePayload), "utf8"),
        source: TLD_LIST_SOURCE_URL
      }
    };

    // Write main TLD list
    await writeFile(TLD_LIST_FILE, JSON.stringify(payload, null, 2), "utf-8");

    return payload;
  } catch (error) {
    console.error("Failed to sync TLD list:", error);
    return null;
  }
}

async function deleteCacheFiles(): Promise<void> {
  const files = [
    DNS_FILE,
    EXTRA_FILE,
    PSL_FILE,
    MERGED_FILE,
    ASN_FILE,
    IPV4_FILE,
    IPV6_FILE,
    OBJECT_TAGS_FILE,
    REGISTRIES_FILE,
    TLD_CATEGORIES_FILE,
    TLD_FILE,
    TLDS_FILE,
    TLD_LIST_FILE,
    UPDATE_META_FILE
  ];
  await Promise.all(
    files.map(async (file) => {
      try {
        await unlink(file);
      } catch {
        // ignore
      }
    })
  );
}

async function hasAllRequiredFiles(): Promise<boolean> {
  const checks = await Promise.all([
    readText(DNS_FILE),
    readText(EXTRA_FILE),
    readText(PSL_FILE),
    readText(MERGED_FILE),
    readText(TLD_FILE),
    readText(TLDS_FILE),
    readText(REGISTRIES_FILE),
    readText(TLD_CATEGORIES_FILE),
    readText(UPDATE_META_FILE)
  ]);
  return checks.every((value) => value !== null);
}

export async function ensureWhoisDataFresh(force = false): Promise<SyncResult> {
  const cacheMeta = await readCacheMeta();
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const staleByAccess =
    cacheMeta?.lastAccessAt &&
    now - new Date(cacheMeta.lastAccessAt).getTime() > THIRTY_DAYS_MS;

  if (staleByAccess) {
    await deleteCacheFiles();
  }

  const updateMeta = await readJson<UpdateMeta>(UPDATE_META_FILE);
  const syncMeta = updateMeta?.categories?.sync?.whois;
  const recentEnough =
    syncMeta && Date.now() - new Date(syncMeta.updatedAt).getTime() < ONE_DAY_MS;
  const hasFiles = await hasAllRequiredFiles();
  const staleByRefresh =
    cacheMeta?.lastRefreshAt &&
    now - new Date(cacheMeta.lastRefreshAt).getTime() > THIRTY_DAYS_MS;

  if (!force && recentEnough && hasFiles && !staleByRefresh && !staleByAccess) {
    const merged = await readJson<{
      summary?: SyncResult["mergedSummary"];
      sourceMeta?: { dnsPublication?: string | null };
    }>(MERGED_FILE);
    if (merged?.summary) {
      await writeCacheMeta({
        lastAccessAt: new Date().toISOString(),
        lastRefreshAt: cacheMeta?.lastRefreshAt ?? new Date().toISOString()
      });
      return {
        updatedAt: syncMeta.updatedAt,
        mergedSummary: merged.summary,
        publication: merged.sourceMeta?.dnsPublication ?? null
      };
    }
  }

  const [dnsJson, pslRaw, extraJson, asnJson, ipv4Json, ipv6Json, objectTagsJson] =
    await Promise.all([
      downloadJsonOrLocal(DNS_SOURCE_URL, DNS_FILE),
      downloadTextOrLocal(PSL_SOURCE_URL, PSL_FILE),
      EXTRA_SOURCE_URL ? downloadJson(EXTRA_SOURCE_URL) : Promise.resolve(null),
      downloadJsonOrLocal(ASN_SOURCE_URL, ASN_FILE),
      downloadJsonOrLocal(IPV4_SOURCE_URL, IPV4_FILE),
      downloadJsonOrLocal(IPV6_SOURCE_URL, IPV6_FILE),
      downloadJsonOrLocal(OBJECT_TAGS_SOURCE_URL, OBJECT_TAGS_FILE)
    ]);

  let gtldsJson: GtldsPayload | null = null;
  let geoHtml: string | null = null;
  try {
    gtldsJson = (await downloadJson(GTLDS_SOURCE_URL)) as GtldsPayload;
  } catch {
    gtldsJson = null;
  }
  if (GEO_TLDS_SOURCE_URL) {
    try {
      geoHtml = await downloadText(GEO_TLDS_SOURCE_URL);
    } catch {
      geoHtml = null;
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  await Promise.all([
    writeFile(DNS_FILE, JSON.stringify(dnsJson, null, 2), "utf-8"),
    writeFile(PSL_FILE, pslRaw, "utf-8"),
    writeFile(ASN_FILE, JSON.stringify(asnJson, null, 2), "utf-8"),
    writeFile(IPV4_FILE, JSON.stringify(ipv4Json, null, 2), "utf-8"),
    writeFile(IPV6_FILE, JSON.stringify(ipv6Json, null, 2), "utf-8"),
    writeFile(OBJECT_TAGS_FILE, JSON.stringify(objectTagsJson, null, 2), "utf-8")
  ]);

  if (extraJson) {
    await writeFile(EXTRA_FILE, JSON.stringify(extraJson, null, 2), "utf-8");
  } else {
    const existingExtra = await readText(EXTRA_FILE);
    if (!existingExtra) {
      await writeFile(EXTRA_FILE, "{}\n", "utf-8");
    }
  }

  const nextMeta: DnsRegistryMeta = {
    updatedAt: new Date().toISOString(),
    sourceUrl: DNS_SOURCE_URL,
    publication: typeof dnsJson.publication === "string" ? dnsJson.publication : undefined
  };
  await updateMetaFile((current) => ({
    ...current,
    categories: {
      cache: current.categories?.cache,
      sync: {
        ...(current.categories?.sync ?? {}),
        dns: nextMeta,
        rdapBootstrap: { updatedAt: nextMeta.updatedAt }
      }
    }
  }));

  const mergedSummary = await rebuildMergedFile();

  const registries = groupRegistries(dnsJson?.services, mapFromObject(extraJson));
  let rootDbEntries: { tld: string; type: string; manager: string; href: string }[] = [];
  const rootDbDetails: Record<string, unknown> = {};
  const includeRootDbDetails = force || process.env.ROOT_DB_DETAILS === "1";
  if (includeRootDbDetails) {
    try {
      const rootDbHtml = await downloadText(ROOT_DB_URL);
      rootDbEntries = parseRootDbIndex(rootDbHtml);
      for (const entry of rootDbEntries) {
        if (!entry.href) {
          continue;
        }
        try {
          const detailHtml = await downloadText(entry.href);
          rootDbDetails[entry.tld.toLowerCase()] = parseRootDbDetail(detailHtml);
        } catch {
          // skip failed detail fetch
        }
      }
    } catch {
      rootDbEntries = [];
    }
  }

  await writeFile(
    REGISTRIES_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          rootDb: ROOT_DB_URL,
          dns: DNS_SOURCE_URL,
          rdapExtra: EXTRA_SOURCE_URL ?? "local-file"
        },
        tlds: rootDbEntries.map((entry) => ({
          tld: entry.tld.toLowerCase(),
          type: entry.type,
          manager: entry.manager,
          href: entry.href,
          details: rootDbDetails[entry.tld.toLowerCase()] ?? null
        })),
        rdapRegistries: registries
      },
      null,
      2
    ),
    "utf-8"
  );

  const tldMap = new Map<string, string>();
  for (const [suffix, url] of mapFromServices(dnsJson?.services)) {
    if (url) {
      tldMap.set(suffix, url);
    }
  }
  for (const [suffix, url] of mapFromObject(extraJson)) {
    if (url) {
      tldMap.set(suffix, url);
    }
  }
  const tldEntries = [...tldMap.entries()]
    .map(([suffix, rdapUrl]) => ({ suffix, rdapUrl }))
    .sort((a, b) => a.suffix.localeCompare(b.suffix));
  await writeFile(
    TLD_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          dns: DNS_SOURCE_URL,
          rdapExtra: EXTRA_SOURCE_URL ?? "local-file"
        },
        count: tldEntries.length,
        tlds: tldEntries
      },
      null,
      2
    ),
    "utf-8"
  );

  const tldListPayload = await syncTldList();
  if (tldListPayload?.meta) {
    await updateMetaFile((current) => ({
      ...current,
      categories: {
        cache: current.categories?.cache,
        sync: {
          ...(current.categories?.sync ?? {}),
          tldList: tldListPayload.meta
        }
      }
    }));
  }

  if (gtldsJson) {
    const activeGtlds = extractActiveGtlds(gtldsJson);
    const brandTlds = extractBrandTlds(gtldsJson);
    const brandPayload = {
      generatedAt: new Date().toISOString(),
      source: GTLDS_SOURCE_URL,
      counts: { brandTlds: brandTlds.length },
      tlds: brandTlds
    };
    await writeFile(BRAND_TLDS_FILE, JSON.stringify(brandPayload, null, 2), "utf-8");

    if (geoHtml) {
      const geoTlds = extractGeoTlds(geoHtml, activeGtlds);
      const geoPayload = {
        generatedAt: new Date().toISOString(),
        source: GEO_TLDS_SOURCE_URL ?? "local-file",
        filteredByGtldsJson: true,
        counts: { geoTlds: geoTlds.length },
        tlds: geoTlds
      };
      await writeFile(GEO_TLDS_FILE, JSON.stringify(geoPayload, null, 2), "utf-8");
    }
  }

  const localBrand = await readJson<{ tlds?: string[]; brandTLDs?: string[] }>(BRAND_TLDS_FILE);
  const localGeo = await readJson<{ tlds?: string[]; geoTLDs?: string[] }>(GEO_TLDS_FILE);
  const brandList = normalizeList(localBrand?.tlds ?? localBrand?.brandTLDs ?? []);
  const geoList = normalizeList(localGeo?.tlds ?? localGeo?.geoTLDs ?? []);

  const queryableSuffixes = (() => {
    const raw = readFile(MERGED_FILE, "utf-8");
    return raw
      .then((content) => JSON.parse(content) as { items?: { suffix: string; rdapUrl: string | null }[] })
      .then((payload) =>
        (payload.items ?? [])
          .filter((item) => item?.suffix && item?.rdapUrl)
          .map((item) => item.suffix.toLowerCase())
      );
  })();
  const suffixList = await queryableSuffixes;
  const categories = buildTldCategories(suffixList, new Set(brandList), new Set(geoList));
  const cannotQueryRootTlds = await readCannotQueryRootTlds();
  const tldList = await readJson<{ tlds?: string[]; count?: number }>(TLD_LIST_FILE);
  const ianaRootTlds = normalizeList(tldList?.tlds ?? []);

  await writeFile(
    TLDS_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          merged: MERGED_FILE,
          brand: BRAND_TLDS_FILE,
          geo: GEO_TLDS_FILE,
          ianaList: TLD_LIST_FILE,
          cannotQueryRoot: CANNOT_QUERY_ROOT_TLDS_FILE
        },
        counts: {
          queryable: suffixList.length,
          categories: categories.counts,
          brandTlds: brandList.length,
          geoTlds: geoList.length,
          ianaRootTlds: ianaRootTlds.length,
          cannotQueryRootTlds: cannotQueryRootTlds.length
        },
        tlds: {
          queryable: suffixList,
          categories: categories.lists,
          brand: brandList,
          geo: geoList,
          ianaRoot: ianaRootTlds,
          cannotQueryRoot: cannotQueryRootTlds
        }
      },
      null,
      2
    ),
    "utf-8"
  );

  await writeFile(
    TLD_CATEGORIES_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          merged: MERGED_FILE,
          brand: BRAND_TLDS_FILE,
          geo: GEO_TLDS_FILE
        },
        counts: categories.counts,
        tlds: categories.lists
      },
      null,
      2
    ),
    "utf-8"
  );
  await updateMetaFile((current) => ({
    ...current,
    categories: {
      cache: current.categories?.cache,
      sync: {
        ...(current.categories?.sync ?? {}),
        whois: {
          updatedAt: nextMeta.updatedAt,
          sources: {
            dns: DNS_SOURCE_URL,
            publicSuffixList: PSL_SOURCE_URL,
            gtldsJson: GTLDS_SOURCE_URL,
            geoTlds: GEO_TLDS_SOURCE_URL ?? "local-file",
            rdapExtra: EXTRA_SOURCE_URL ?? "local-file"
          }
        }
      }
    }
  }));

  await writeCacheMeta({
    lastAccessAt: new Date().toISOString(),
    lastRefreshAt: new Date().toISOString()
  });

  return {
    updatedAt: nextMeta.updatedAt,
    mergedSummary,
    publication: nextMeta.publication ?? null
  };
}
