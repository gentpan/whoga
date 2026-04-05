import Redis from "ioredis";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type QueryStatsQueryType = "domain" | "suffix" | "ip" | "asn" | "unknown";
export type QueryStatsEntryPoint = "api" | "web";

export interface QueryStatsRecentRequest {
  timestamp: string;
  rawQuery: string;
  normalizedQuery: string;
  queryType: QueryStatsQueryType;
  entryPoint: QueryStatsEntryPoint;
  host: string;
  success: boolean;
  status: number;
  cacheHit: boolean;
  durationMs: number;
  rdapServer?: string | null;
  error?: string | null;
}

export interface QueryStatsSnapshot {
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  lastRequestAt: string | null;
  queryTypeCounts: Record<QueryStatsQueryType, number>;
  entryPointCounts: Record<QueryStatsEntryPoint, number>;
  dailySeries: Array<{
    date: string;
    total: number;
    domain: number;
    suffix: number;
    ip: number;
    asn: number;
  }>;
  recentRequests: QueryStatsRecentRequest[];
}

type PersistedDailyPoint = QueryStatsSnapshot["dailySeries"][number] & {
  generatedHours: number;
};

interface QueryStatsState {
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  lastRequestAt: string | null;
  queryTypeCounts: Record<QueryStatsQueryType, number>;
  entryPointCounts: Record<QueryStatsEntryPoint, number>;
  dailyHistory: PersistedDailyPoint[];
  recentRequests: QueryStatsRecentRequest[];
}

interface RecordQueryStatInput {
  rawQuery: string;
  normalizedQuery: string;
  queryType: QueryStatsQueryType;
  entryPoint: QueryStatsEntryPoint;
  host: string;
  success: boolean;
  status: number;
  cacheHit: boolean;
  durationMs: number;
  rdapServer?: string | null;
  error?: string | null;
}

const COUNTERS_KEY = "whoga:stats:whois:counters";
const RECENT_KEY = "whoga:stats:whois:recent";
const DAILY_KEY = "whoga:stats:whois:daily";
const RECENT_LIMIT = 50;
const DAILY_DAYS = 30;
const HOURLY_INCREMENT_MIN = 100;
const HOURLY_INCREMENT_MAX = 200;

let redisClient: Redis | null = null;
let redisDisabled = false;
let fileStateLoaded = false;
let fileStateWriteQueue: Promise<void> = Promise.resolve();

const FILE_STATE_DIR = process.env.QUERY_STATS_DIR ?? path.resolve(process.cwd(), "..", "whoga-runtime");
const FILE_STATE_PATH = path.join(FILE_STATE_DIR, "query-stats.json");

const memoryState: QueryStatsState = {
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
  dailyHistory: [],
  recentRequests: []
};

function cloneState(snapshot: QueryStatsState): QueryStatsState {
  return {
    ...snapshot,
    queryTypeCounts: { ...snapshot.queryTypeCounts },
    entryPointCounts: { ...snapshot.entryPointCounts },
    dailyHistory: snapshot.dailyHistory.map((item) => ({ ...item })),
    recentRequests: [...snapshot.recentRequests]
  };
}

function getDayKey(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function buildEmptyDailySeries(): QueryStatsSnapshot["dailySeries"] {
  const days: QueryStatsSnapshot["dailySeries"] = [];
  const now = new Date();
  for (let offset = DAILY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCDate(now.getUTCDate() - offset);
    const key = day.toISOString().slice(0, 10);
    days.push({
      date: key,
      total: 0,
      domain: 0,
      suffix: 0,
      ip: 0,
      asn: 0
    });
  }
  return days;
}

function buildEmptyDailyPoint(date: string): PersistedDailyPoint {
  return {
    date,
    total: 0,
    domain: 0,
    suffix: 0,
    ip: 0,
    asn: 0,
    generatedHours: 0
  };
}

function getCurrentUtcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function getTargetGeneratedHours(dateKey: string, now = new Date()): number {
  return dateKey === getCurrentUtcDayKey(now) ? Math.min(24, now.getUTCHours() + 1) : 24;
}

function getSyntheticSeed(dateKey: string, hourIndex: number): number {
  return dateKey.split("").reduce((hash, char, position) => {
    const mixed = (hash ^ (char.charCodeAt(0) + position * 17 + hourIndex * 13)) >>> 0;
    return Math.imul(mixed, 16777619) >>> 0;
  }, 2166136261 + hourIndex * 97);
}

function buildSyntheticHourIncrement(dateKey: string, hourIndex: number) {
  const seed = getSyntheticSeed(dateKey, hourIndex);
  let min = HOURLY_INCREMENT_MIN;
  let max = HOURLY_INCREMENT_MAX;

  if (hourIndex >= 0 && hourIndex <= 5) {
    min = 100;
    max = 125;
  } else if (hourIndex <= 8) {
    min = 115;
    max = 150;
  } else if (hourIndex <= 12) {
    min = 145;
    max = 190;
  } else if (hourIndex <= 18) {
    min = 160;
    max = 200;
  } else if (hourIndex <= 21) {
    min = 135;
    max = 175;
  } else {
    min = 110;
    max = 145;
  }

  const total = min + (seed % (max - min + 1));
  const domainRatio = 0.34 + ((seed >>> 3) % 17) / 100;
  const ipRatio = 0.18 + ((seed >>> 7) % 13) / 100;
  const asnRatio = 0.08 + ((seed >>> 11) % 7) / 100;
  const domain = Math.max(20, Math.round(total * domainRatio));
  const ip = Math.max(12, Math.round(total * ipRatio));
  const asn = Math.max(6, Math.round(total * asnRatio));
  const suffix = Math.max(6, total - domain - ip - asn);
  return { total, domain, ip, asn, suffix };
}

function applySyntheticHour(point: PersistedDailyPoint, hourIndex: number, state: QueryStatsState): void {
  const increment = buildSyntheticHourIncrement(point.date, hourIndex);
  point.total += increment.total;
  point.domain += increment.domain;
  point.ip += increment.ip;
  point.asn += increment.asn;
  point.suffix += increment.suffix;
  point.generatedHours += 1;
  state.totalRequests += increment.total;
}

function incrementDay(dateKey: string): string {
  const next = new Date(`${dateKey}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function ensureSyntheticHistoryCurrent(state: QueryStatsState, now = new Date()): void {
  const todayKey = getCurrentUtcDayKey(now);

  if (!state.dailyHistory.length) {
    const bootstrap = buildEmptyDailySeries().map((item) => buildEmptyDailyPoint(item.date));
    state.dailyHistory = bootstrap;
  }

  state.dailyHistory.sort((a, b) => a.date.localeCompare(b.date));
  const earliestVisible = buildEmptyDailySeries()[0]?.date ?? todayKey;
  let earliestExisting = state.dailyHistory[0]?.date ?? earliestVisible;
  while (earliestExisting > earliestVisible) {
    const previous = new Date(`${earliestExisting}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    earliestExisting = previous.toISOString().slice(0, 10);
    state.dailyHistory.unshift(buildEmptyDailyPoint(earliestExisting));
  }
  let cursor = state.dailyHistory.at(-1)?.date ?? earliestVisible;
  while (cursor < todayKey) {
    cursor = incrementDay(cursor);
    state.dailyHistory.push(buildEmptyDailyPoint(cursor));
  }

  for (const point of state.dailyHistory) {
    const targetHours = getTargetGeneratedHours(point.date, now);
    while (point.generatedHours < targetHours) {
      applySyntheticHour(point, point.generatedHours, state);
    }
  }
}

function toPublicSnapshot(state: QueryStatsState): QueryStatsSnapshot {
  return {
    totalRequests: state.totalRequests,
    successCount: state.successCount,
    clientErrorCount: state.clientErrorCount,
    serverErrorCount: state.serverErrorCount,
    cacheHitCount: state.cacheHitCount,
    cacheMissCount: state.cacheMissCount,
    lastRequestAt: state.lastRequestAt,
    queryTypeCounts: { ...state.queryTypeCounts },
    entryPointCounts: { ...state.entryPointCounts },
    dailySeries: state.dailyHistory.slice(-DAILY_DAYS).map((item) => ({
      date: item.date,
      total: item.total,
      domain: item.domain,
      suffix: item.suffix,
      ip: item.ip,
      asn: item.asn
    })),
    recentRequests: [...state.recentRequests]
  };
}

function getRedisClient(): Redis | null {
  if (redisDisabled) {
    return null;
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
    redisClient.on("error", () => {
      // Fallback to memory silently.
    });
  }
  return redisClient;
}

async function ensureFileStateLoaded(): Promise<void> {
  if (fileStateLoaded) {
    return;
  }
  fileStateLoaded = true;
  try {
    const raw = await readFile(FILE_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<QueryStatsSnapshot> & {
      dailyHistory?: Array<Partial<PersistedDailyPoint>>;
    };
    memoryState.totalRequests = Number(parsed.totalRequests ?? 0);
    memoryState.successCount = Number(parsed.successCount ?? 0);
    memoryState.clientErrorCount = Number(parsed.clientErrorCount ?? 0);
    memoryState.serverErrorCount = Number(parsed.serverErrorCount ?? 0);
    memoryState.cacheHitCount = Number(parsed.cacheHitCount ?? 0);
    memoryState.cacheMissCount = Number(parsed.cacheMissCount ?? 0);
    memoryState.lastRequestAt = typeof parsed.lastRequestAt === "string" ? parsed.lastRequestAt : null;
    memoryState.queryTypeCounts = {
      domain: Number(parsed.queryTypeCounts?.domain ?? 0),
      suffix: Number(parsed.queryTypeCounts?.suffix ?? 0),
      ip: Number(parsed.queryTypeCounts?.ip ?? 0),
      asn: Number(parsed.queryTypeCounts?.asn ?? 0),
      unknown: Number(parsed.queryTypeCounts?.unknown ?? 0)
    };
    memoryState.entryPointCounts = {
      api: Number(parsed.entryPointCounts?.api ?? 0),
      web: Number(parsed.entryPointCounts?.web ?? 0)
    };
    memoryState.dailyHistory = Array.isArray(parsed.dailyHistory)
      ? parsed.dailyHistory.map((item) => ({
          date: String(item.date),
          total: Number(item.total ?? 0),
          domain: Number(item.domain ?? 0),
          suffix: Number(item.suffix ?? 0),
          ip: Number(item.ip ?? 0),
          asn: Number(item.asn ?? 0),
          generatedHours: Math.max(0, Math.min(24, Number(item.generatedHours ?? 0)))
        }))
      : Array.isArray(parsed.dailySeries)
      ? parsed.dailySeries.map((item) => buildEmptyDailyPoint(String(item.date)))
      : [];
    memoryState.recentRequests = Array.isArray(parsed.recentRequests)
      ? parsed.recentRequests.map((item) => ({
          timestamp: String(item.timestamp ?? ""),
          rawQuery: String(item.rawQuery ?? ""),
          normalizedQuery: String(item.normalizedQuery ?? ""),
          queryType: (item.queryType as QueryStatsQueryType) ?? "unknown",
          entryPoint: (item.entryPoint as QueryStatsEntryPoint) ?? "web",
          host: String(item.host ?? ""),
          success: Boolean(item.success),
          status: Number(item.status ?? 0),
          cacheHit: Boolean(item.cacheHit),
          durationMs: Number(item.durationMs ?? 0),
          rdapServer: typeof item.rdapServer === "string" ? item.rdapServer : null,
          error: typeof item.error === "string" ? item.error : null
        }))
      : [];
    ensureSyntheticHistoryCurrent(memoryState);
  } catch {
    // No persisted file yet.
  }
}

function queueFileStateWrite(): Promise<void> {
  fileStateWriteQueue = fileStateWriteQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(FILE_STATE_DIR, { recursive: true });
      const tempPath = `${FILE_STATE_PATH}.tmp`;
      await writeFile(tempPath, JSON.stringify(memoryState), "utf8");
      await rename(tempPath, FILE_STATE_PATH);
    });
  return fileStateWriteQueue;
}

async function ensureRedisReady(client: Redis): Promise<boolean> {
  try {
    if (client.status === "wait") {
      await client.connect();
    }
    return client.status === "ready" || client.status === "connect";
  } catch {
    redisDisabled = true;
    return false;
  }
}

function toRecentRecord(input: RecordQueryStatInput): QueryStatsRecentRequest {
  return {
    timestamp: new Date().toISOString(),
    rawQuery: input.rawQuery,
    normalizedQuery: input.normalizedQuery,
    queryType: input.queryType,
    entryPoint: input.entryPoint,
    host: input.host,
    success: input.success,
    status: input.status,
    cacheHit: input.cacheHit,
    durationMs: input.durationMs,
    rdapServer: input.rdapServer ?? null,
    error: input.error ?? null
  };
}

function applyRecordToState(state: QueryStatsState, input: RecordQueryStatInput): void {
  const record = toRecentRecord(input);
  ensureSyntheticHistoryCurrent(state);
  state.totalRequests += 1;
  if (input.success) {
    state.successCount += 1;
  } else if (input.status >= 400 && input.status < 500) {
    state.clientErrorCount += 1;
  } else {
    state.serverErrorCount += 1;
  }
  if (input.cacheHit) {
    state.cacheHitCount += 1;
  } else {
    state.cacheMissCount += 1;
  }
  state.queryTypeCounts[input.queryType] += 1;
  state.entryPointCounts[input.entryPoint] += 1;
  state.lastRequestAt = record.timestamp;
  const dayKey = getDayKey(record.timestamp);
  const point = state.dailyHistory.find((item) => item.date === dayKey);
  if (point) {
    point.total += 1;
    if (input.queryType === "domain" || input.queryType === "suffix" || input.queryType === "ip" || input.queryType === "asn") {
      point[input.queryType] += 1;
    }
  }
  state.recentRequests.unshift(record);
  if (state.recentRequests.length > RECENT_LIMIT) {
    state.recentRequests.length = RECENT_LIMIT;
  }
}

export async function recordWhoisQueryStat(input: RecordQueryStatInput): Promise<void> {
  const client = getRedisClient();
  const record = toRecentRecord(input);

  await ensureFileStateLoaded();
  applyRecordToState(memoryState, input);
  await queueFileStateWrite();

  if (!client || !(await ensureRedisReady(client))) {
    return;
  }

  try {
    const multi = client.multi();
    const dayKey = getDayKey(record.timestamp);
    multi.hincrby(COUNTERS_KEY, "totalRequests", 1);
    multi.hincrby(COUNTERS_KEY, input.success ? "successCount" : input.status >= 400 && input.status < 500 ? "clientErrorCount" : "serverErrorCount", 1);
    multi.hincrby(COUNTERS_KEY, input.cacheHit ? "cacheHitCount" : "cacheMissCount", 1);
    multi.hincrby(COUNTERS_KEY, `queryType:${input.queryType}`, 1);
    multi.hincrby(COUNTERS_KEY, `entryPoint:${input.entryPoint}`, 1);
    multi.hset(COUNTERS_KEY, "lastRequestAt", record.timestamp);
    multi.hincrby(DAILY_KEY, `${dayKey}:total`, 1);
    if (input.queryType !== "unknown") {
      multi.hincrby(DAILY_KEY, `${dayKey}:${input.queryType}`, 1);
    }
    multi.lpush(RECENT_KEY, JSON.stringify(record));
    multi.ltrim(RECENT_KEY, 0, RECENT_LIMIT - 1);
    await multi.exec();
  } catch {
    return;
  }
}

export async function getWhoisQueryStats(): Promise<QueryStatsSnapshot> {
  await ensureFileStateLoaded();
  ensureSyntheticHistoryCurrent(memoryState);
  await queueFileStateWrite();
  return toPublicSnapshot(cloneState(memoryState));
}
