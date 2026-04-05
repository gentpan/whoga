import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";
import { getWhoisQueryStats, type QueryStatsSnapshot } from "@/lib/query-stats";

type BootstrapKey = "asn" | "dns" | "ipv4" | "ipv6" | "object-tags";

export interface BootstrapStat {
  key: BootstrapKey;
  description: string;
  publication: string;
  supportedCount: number;
  supportedLabel: string;
}

export interface BootstrapStatsPayload {
  updatedAt: string;
  queryableDomainSuffixes: number;
  items: BootstrapStat[];
  queryStats: QueryStatsSnapshot;
}

interface BootstrapFileMeta {
  key: BootstrapKey;
  url: string;
}

const FILES: BootstrapFileMeta[] = [
  { key: "asn", url: "https://data.iana.org/rdap/asn.json" },
  { key: "dns", url: "https://data.iana.org/rdap/dns.json" },
  { key: "ipv4", url: "https://data.iana.org/rdap/ipv4.json" },
  { key: "ipv6", url: "https://data.iana.org/rdap/ipv6.json" },
  { key: "object-tags", url: "https://data.iana.org/rdap/object-tags.json" }
];

const CACHE_TTL_MS = 72 * 60 * 60 * 1000;

const DATA_DIR = path.join(process.cwd(), "data");
const UPDATE_META_FILE = path.join(DATA_DIR, "update-meta.json");
const LOCAL_FILES: Record<BootstrapKey, string> = {
  asn: path.join(DATA_DIR, "asn.json"),
  dns: path.join(DATA_DIR, "dns.json"),
  ipv4: path.join(DATA_DIR, "ipv4.json"),
  ipv6: path.join(DATA_DIR, "ipv6.json"),
  "object-tags": path.join(DATA_DIR, "object-tags.json")
};

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

interface UpdateMetaPayload {
  generatedAt?: string;
  categories?: {
    cache?: { lastAccessAt?: string; lastRefreshAt?: string };
    sync?: {
      rdapBootstrap?: { updatedAt?: string };
      dns?: { updatedAt?: string; sourceUrl?: string; publication?: string };
      whois?: {
        updatedAt?: string;
        sources?: {
          dns?: string;
          publicSuffixList?: string;
          gtldsJson?: string;
          geoTlds?: string;
          rdapExtra?: string;
        };
      };
      tldList?: { lastSyncedAt?: string; tldCount?: number; fileSize?: number; source?: string };
    };
  };
}

async function refreshBootstrapCache(): Promise<void> {
  const updateMeta = await readJson<UpdateMetaPayload>(UPDATE_META_FILE);
  const meta = updateMeta?.categories?.sync?.rdapBootstrap;
  const recentEnough =
    meta?.updatedAt && Date.now() - new Date(meta.updatedAt).getTime() < CACHE_TTL_MS;
  if (recentEnough) {
    return;
  }

  await Promise.all(
    FILES.map(async (file) => {
      try {
        const response = await fetch(file.url, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as Record<string, unknown>;
        await writeJson(LOCAL_FILES[file.key], payload);
      } catch {
        // keep existing cache if fetch fails
      }
    })
  );

  const now = new Date().toISOString();
  const next: UpdateMetaPayload = {
    ...(updateMeta ?? {}),
    generatedAt: now,
    categories: {
      ...(updateMeta?.categories ?? {}),
      sync: {
        ...(updateMeta?.categories?.sync ?? {}),
        rdapBootstrap: { updatedAt: now }
      }
    }
  };
  await writeJson(UPDATE_META_FILE, next);
}

let cache: {
  updatedAtMs: number;
  payload: Omit<BootstrapStatsPayload, "queryStats" | "updatedAt">;
} | null = null;

const MERGED_FILE = path.join(process.cwd(), "data", "whois-merged.json");

function countIdentifiers(services: unknown): number {
  if (!Array.isArray(services)) {
    return 0;
  }

  let count = 0;
  for (const service of services) {
    const identifiers = Array.isArray((service as unknown[])?.[0])
      ? ((service as unknown[])?.[0] as unknown[])
      : [];
    count += identifiers.length;
  }
  return count;
}

function countObjectTags(services: unknown): number {
  if (!Array.isArray(services)) {
    return 0;
  }

  let count = 0;
  for (const service of services) {
    const tags = Array.isArray((service as unknown[])?.[1])
      ? ((service as unknown[])?.[1] as unknown[])
      : [];
    count += tags.length;
  }
  return count;
}

function toStat(meta: BootstrapFileMeta, data: Record<string, unknown>): BootstrapStat {
  const description = String(data.description ?? "");
  const publication = String(data.publication ?? "");
  const services = data.services;

  if (meta.key === "object-tags") {
    return {
      key: meta.key,
      description,
      publication,
      supportedCount: countObjectTags(services),
      supportedLabel: "对象标签数"
    };
  }

  return {
    key: meta.key,
    description,
    publication,
    supportedCount: countIdentifiers(services),
    supportedLabel: "支持项数量"
  };
}

export async function getBootstrapStats(force = false): Promise<BootstrapStatsPayload> {
  if (!force && cache && Date.now() - cache.updatedAtMs < CACHE_TTL_MS) {
    return {
      ...cache.payload,
      updatedAt: new Date().toISOString(),
      queryStats: await getWhoisQueryStats()
    };
  }

  await ensureWhoisDataFresh(force);
  await refreshBootstrapCache();

  const results = await Promise.all(
    FILES.map(async (file) => {
      const localPath = LOCAL_FILES[file.key];
      try {
        const raw = await readFile(localPath, "utf-8");
        const payload = JSON.parse(raw) as Record<string, unknown>;
        return toStat(file, payload);
      } catch {
        return {
          key: file.key,
          description: "",
          publication: "",
          supportedCount: 0,
          supportedLabel: file.key === "object-tags" ? "对象标签数" : "支持项数量"
        };
      }
    })
  );

  let queryableDomainSuffixes = 0;
  try {
    const raw = await readFile(MERGED_FILE, "utf-8");
    const merged = JSON.parse(raw) as { summary?: { with_rdap_url?: number } };
    queryableDomainSuffixes = merged.summary?.with_rdap_url ?? 0;
  } catch {
    queryableDomainSuffixes = 0;
  }

  const payload = {
    queryableDomainSuffixes,
    items: results
  };

  cache = { updatedAtMs: Date.now(), payload };
  return {
    ...payload,
    updatedAt: new Date().toISOString(),
    queryStats: await getWhoisQueryStats()
  };
}
