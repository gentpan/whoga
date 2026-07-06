import { readFile, writeFile } from "node:fs/promises";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";
import { type QueryStatsSnapshot } from "@/lib/query-stats";
import { resolveReadableDataPath, ensureWritableDataPath } from "@/lib/runtime-data";

type BootstrapKey = "asn" | "dns" | "ipv4" | "ipv6" | "object-tags";

export interface BootstrapStat {
  key: BootstrapKey;
  description: string;
  publication: string;
  supportedCount: number;
  supportedLabel: string;
}

export interface RootTldCoverage {
  total: number;
  withRdap: number;
  withWhoisFallback: number;
  withWebRegistryOnly: number;
}

export interface BootstrapStatsPayload {
  updatedAt: string;
  queryableDomainSuffixes: number;
  rootTldCoverage: RootTldCoverage;
  items: BootstrapStat[];
  queryStats: QueryStatsSnapshot & {
    periodTotals?: {
      last24h: number;
      last7d: number;
      last30d: number;
      allTime: number;
    };
    source?: string;
    updatedAt?: string;
  };
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

interface FlagcdnTrafficCache {
  fetchedAt?: string;
  historicalDaily?: Record<string, number>;
  queryStats?: BootstrapStatsPayload["queryStats"];
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

async function getDataSnapshotUpdatedAt(): Promise<string> {
  try {
    const raw = await readFile(await resolveReadableDataPath("whois-merged.json"), "utf-8");
    const merged = JSON.parse(raw) as { generatedAt?: string };
    if (isValidTimestamp(merged.generatedAt)) {
      return merged.generatedAt;
    }
  } catch {
    // Fall through to metadata.
  }

  try {
    const meta = await readJson<UpdateMetaPayload>(await resolveReadableDataPath("update-meta.json"));
    const candidates = [
      meta?.categories?.sync?.whois?.updatedAt,
      meta?.categories?.sync?.rdapBootstrap?.updatedAt,
      meta?.categories?.sync?.dns?.updatedAt,
      meta?.categories?.cache?.lastRefreshAt,
      meta?.generatedAt
    ];
    const timestamp = candidates.find(isValidTimestamp);
    if (timestamp) {
      return timestamp;
    }
  } catch {
    // Fall through to a deterministic fallback.
  }

  return "1970-01-01T00:00:00.000Z";
}

function getUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getRecentDateKeys(days: number): string[] {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - (days - index - 1));
    return getUtcDateKey(date);
  });
}

function emptyFlagcdnTrafficStats(): BootstrapStatsPayload["queryStats"] {
  return {
    totalRequests: 0,
    successCount: 0,
    clientErrorCount: 0,
    serverErrorCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    lastRequestAt: null,
    queryTypeCounts: {
      domain: 0,
      suffix: 0,
      ip: 0,
      asn: 0,
      unknown: 0
    },
    entryPointCounts: {
      api: 0,
      web: 0
    },
    dailySeries: getRecentDateKeys(30).map((date) => ({
      date,
      total: 0,
      domain: 0,
      suffix: 0,
      ip: 0,
      asn: 0
    })),
    recentRequests: [],
    periodTotals: {
      last24h: 0,
      last7d: 0,
      last30d: 0,
      allTime: 0
    },
    source: "flagcdn.io",
    updatedAt: new Date().toISOString()
  };
}

function sumRequests(values: Array<{ total: number }>): number {
  return values.reduce((total, item) => total + item.total, 0);
}

async function getFlagcdnTrafficStats(): Promise<BootstrapStatsPayload["queryStats"]> {
  const cacheFile = await ensureWritableDataPath("flagcdn-traffic.json");
  const cached = await readJson<FlagcdnTrafficCache>(cacheFile);
  if (cached?.fetchedAt && cached.queryStats && Date.now() - new Date(cached.fetchedAt).getTime() < 10 * 60 * 1000) {
    return cached.queryStats;
  }

  const email = process.env.CLOUDFLARE_EMAIL ?? process.env.CF_EMAIL;
  const apiKey = process.env.CLOUDFLARE_API_KEY ?? process.env.CF_KEY;
  const zoneId = process.env.FLAGCDN_ZONE_ID ?? "4d624496fd8084c860c57e0fa9f9342b";
  if (!email || !apiKey || !zoneId) {
    return cached?.queryStats ?? emptyFlagcdnTrafficStats();
  }

  const now = new Date();
  const start24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const start30 = getRecentDateKeys(30)[0];
  const endDay = getUtcDateKey(now);
  const query = `
    query($zone: String!, $start24: DateTime!, $start30: Date!, $endDay: Date!) {
      viewer {
        zones(filter: { zoneTag: $zone }) {
          hourly: httpRequests1hGroups(limit: 25, filter: { datetime_geq: $start24 }) {
            dimensions { datetime }
            sum { requests }
          }
          daily: httpRequests1dGroups(limit: 31, filter: { date_geq: $start30, date_leq: $endDay }) {
            dimensions { date }
            sum { requests cachedRequests }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Email": email,
        "X-Auth-Key": apiKey
      },
      body: JSON.stringify({
        query,
        variables: { zone: zoneId, start24, start30, endDay }
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return cached?.queryStats ?? emptyFlagcdnTrafficStats();
    }

    const payload = (await response.json()) as {
      data?: {
        viewer?: {
          zones?: Array<{
            hourly?: Array<{ dimensions?: { datetime?: string }; sum?: { requests?: number } }>;
            daily?: Array<{ dimensions?: { date?: string }; sum?: { requests?: number; cachedRequests?: number } }>;
          }>;
        };
      };
      errors?: unknown;
    };
    const zone = payload.data?.viewer?.zones?.[0];
    if (payload.errors || !zone) {
      return cached?.queryStats ?? emptyFlagcdnTrafficStats();
    }

    const hourly = (zone.hourly ?? [])
      .map((item) => ({
        date: item.dimensions?.datetime ?? "",
        total: Number(item.sum?.requests ?? 0)
      }))
      .filter((item) => item.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    const last24h = sumRequests(hourly.slice(-24));

    const dailyByDate = new Map(
      (zone.daily ?? [])
        .map((item) => [
          item.dimensions?.date ?? "",
          {
            total: Number(item.sum?.requests ?? 0),
            cached: Number(item.sum?.cachedRequests ?? 0)
          }
        ] as const)
        .filter(([date]) => Boolean(date))
    );
    const dailySeries = getRecentDateKeys(30).map((date) => {
      const point = dailyByDate.get(date);
      return {
        date,
        total: point?.total ?? 0,
        domain: 0,
        suffix: 0,
        ip: 0,
        asn: 0
      };
    });
    const last7d = sumRequests(dailySeries.slice(-7));
    const last30d = sumRequests(dailySeries);
    const cacheHitCount = dailySeries.reduce((total, point) => total + (dailyByDate.get(point.date)?.cached ?? 0), 0);

    const historicalDaily = { ...(cached?.historicalDaily ?? {}) };
    for (const point of dailySeries) {
      historicalDaily[point.date] = Math.max(historicalDaily[point.date] ?? 0, point.total);
    }
    const allTime = Object.values(historicalDaily).reduce((total, value) => total + Number(value || 0), 0);
    const fetchedAt = now.toISOString();
    const queryStats: BootstrapStatsPayload["queryStats"] = {
      totalRequests: allTime,
      successCount: last30d,
      clientErrorCount: 0,
      serverErrorCount: 0,
      cacheHitCount,
      cacheMissCount: Math.max(0, last30d - cacheHitCount),
      lastRequestAt: fetchedAt,
      queryTypeCounts: {
        domain: last30d,
        suffix: 0,
        ip: 0,
        asn: 0,
        unknown: 0
      },
      entryPointCounts: {
        api: 0,
        web: last30d
      },
      dailySeries,
      recentRequests: [],
      periodTotals: {
        last24h,
        last7d,
        last30d,
        allTime
      },
      source: "flagcdn.io",
      updatedAt: fetchedAt
    };

    await writeJson(cacheFile, { fetchedAt, historicalDaily, queryStats });
    return queryStats;
  } catch {
    return cached?.queryStats ?? emptyFlagcdnTrafficStats();
  }
}

async function refreshBootstrapCache(): Promise<void> {
  const updateMetaFile = await ensureWritableDataPath("update-meta.json");
  const updateMeta = await readJson<UpdateMetaPayload>(updateMetaFile);
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
        await writeJson(await ensureWritableDataPath(`${file.key}.json`), payload);
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
  await writeJson(updateMetaFile, next);
}

let cache: {
  updatedAtMs: number;
  payload: Omit<BootstrapStatsPayload, "queryStats" | "updatedAt">;
} | null = null;

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

async function readRootTldCoverage(): Promise<RootTldCoverage> {
  const empty: RootTldCoverage = {
    total: 0,
    withRdap: 0,
    withWhoisFallback: 0,
    withWebRegistryOnly: 0
  };
  try {
    const tlds = await readJson<{
      counts?: {
        ianaRootTlds?: number;
        ianaRootWithRdap?: number;
        ianaRootWithWhoisFallback?: number;
        ianaRootWithWebRegistryOnly?: number;
      };
    }>(await resolveReadableDataPath("tlds.json"));
    const counts = tlds?.counts;
    if (!counts) {
      return empty;
    }
    return {
      total: counts.ianaRootTlds ?? 0,
      withRdap: counts.ianaRootWithRdap ?? 0,
      withWhoisFallback: counts.ianaRootWithWhoisFallback ?? 0,
      withWebRegistryOnly: counts.ianaRootWithWebRegistryOnly ?? 0
    };
  } catch {
    return empty;
  }
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
      updatedAt: await getDataSnapshotUpdatedAt(),
      rootTldCoverage: await readRootTldCoverage(),
      queryStats: await getFlagcdnTrafficStats()
    };
  }

  await ensureWhoisDataFresh(force);
  await refreshBootstrapCache();

  const results = await Promise.all(
    FILES.map(async (file) => {
      const localPath = await resolveReadableDataPath(`${file.key}.json`);
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
    const raw = await readFile(await resolveReadableDataPath("whois-merged.json"), "utf-8");
    const merged = JSON.parse(raw) as { summary?: { with_rdap_url?: number } };
    queryableDomainSuffixes = merged.summary?.with_rdap_url ?? 0;
  } catch {
    queryableDomainSuffixes = 0;
  }

  const payload = {
    queryableDomainSuffixes,
    rootTldCoverage: await readRootTldCoverage(),
    items: results
  };

  cache = { updatedAtMs: Date.now(), payload };
  return {
    ...payload,
    updatedAt: await getDataSnapshotUpdatedAt(),
    queryStats: await getFlagcdnTrafficStats()
  };
}
