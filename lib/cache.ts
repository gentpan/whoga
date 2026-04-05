import Redis from "ioredis";

type CacheBackend = "redis" | "memory" | "none";

type CacheHit<T> = {
  hit: boolean;
  value: T | null;
  backend: CacheBackend;
};

type MemoryEntry = {
  expiresAt: number;
  raw: string;
};

const memoryCache = new Map<string, MemoryEntry>();
let redisClient: Redis | null = null;
let redisDisabled = false;

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
      // keep silent and fallback to memory cache
    });
  }
  return redisClient;
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

function getMemory<T>(key: string): CacheHit<T> {
  const now = Date.now();
  const entry = memoryCache.get(key);
  if (!entry) {
    return { hit: false, value: null, backend: "memory" };
  }
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return { hit: false, value: null, backend: "memory" };
  }
  try {
    return {
      hit: true,
      value: JSON.parse(entry.raw) as T,
      backend: "memory"
    };
  } catch {
    memoryCache.delete(key);
    return { hit: false, value: null, backend: "memory" };
  }
}

function setMemory(key: string, value: unknown, ttlSeconds: number): void {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { expiresAt, raw: JSON.stringify(value) });
}

export async function getCacheJson<T>(key: string): Promise<CacheHit<T>> {
  const client = getRedisClient();
  if (!client) {
    return getMemory<T>(key);
  }

  const isReady = await ensureRedisReady(client);
  if (!isReady) {
    return getMemory<T>(key);
  }

  try {
    const raw = await client.get(key);
    if (!raw) {
      return { hit: false, value: null, backend: "redis" };
    }
    return {
      hit: true,
      value: JSON.parse(raw) as T,
      backend: "redis"
    };
  } catch {
    return getMemory<T>(key);
  }
}

export async function setCacheJson(key: string, value: unknown, ttlSeconds: number): Promise<CacheBackend> {
  const client = getRedisClient();
  if (!client) {
    setMemory(key, value, ttlSeconds);
    return "memory";
  }

  const isReady = await ensureRedisReady(client);
  if (!isReady) {
    setMemory(key, value, ttlSeconds);
    return "memory";
  }

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return "redis";
  } catch {
    setMemory(key, value, ttlSeconds);
    return "memory";
  }
}
