import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { extractRootTld } from "@/lib/whois-fallback";
import { ensureWritableDataPath, resolveReadableDataPath } from "@/lib/runtime-data";
import { isSuffixSupportedForQuery, normalizeSuffixLabel } from "@/lib/suffix-support";

const STORE_FILE = "suffix-support-requests.json";

export type SuffixSupportRequestRecord = {
  id: string;
  suffix: string;
  query: string;
  requestedAt: string;
  clientKey: string;
};

type SuffixSupportStore = {
  requests: SuffixSupportRequestRecord[];
};

export type PublicSuffixSupportItem = {
  suffix: string;
  count: number;
  lastRequestedAt: string;
  queries: string[];
};

export type PublicSuffixSupportResponse = {
  items: PublicSuffixSupportItem[];
  totalRequests: number;
  uniqueSuffixes: number;
};

function hashClientKey(ip: string): string {
  const salt = process.env.SUFFIX_REQUEST_SALT ?? "who.ga-suffix-request";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 40);
}

async function readStore(): Promise<SuffixSupportStore> {
  const filePath = await resolveReadableDataPath(STORE_FILE);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as SuffixSupportStore;
    if (!parsed || !Array.isArray(parsed.requests)) {
      return { requests: [] };
    }
    return parsed;
  } catch {
    return { requests: [] };
  }
}

async function writeStore(store: SuffixSupportStore): Promise<void> {
  const filePath = await ensureWritableDataPath(STORE_FILE);
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

export async function pruneSupportedSuffixRequests(): Promise<number> {
  const store = await readStore();
  const kept: SuffixSupportRequestRecord[] = [];
  let removed = 0;

  for (const item of store.requests) {
    const supported = await isSuffixSupportedForQuery(item.suffix);
    if (supported) {
      removed += 1;
      continue;
    }
    kept.push(item);
  }

  if (removed > 0) {
    await writeStore({ requests: kept });
  }

  return removed;
}

export async function removeSuffixSupportRequestsForSuffix(suffix: string): Promise<number> {
  const normalized = normalizeSuffixLabel(suffix);
  const store = await readStore();
  const before = store.requests.length;
  const kept = store.requests.filter((item) => normalizeSuffixLabel(item.suffix) !== normalized);
  const removed = before - kept.length;
  if (removed > 0) {
    await writeStore({ requests: kept });
  }
  return removed;
}

function aggregatePublic(store: SuffixSupportStore): PublicSuffixSupportResponse {
  const map = new Map<string, PublicSuffixSupportItem>();

  for (const item of store.requests) {
    const suffix = normalizeSuffixLabel(item.suffix);
    const existing = map.get(suffix);
    if (!existing) {
      map.set(suffix, {
        suffix,
        count: 1,
        lastRequestedAt: item.requestedAt,
        queries: [item.query]
      });
      continue;
    }

    existing.count += 1;
    if (item.requestedAt > existing.lastRequestedAt) {
      existing.lastRequestedAt = item.requestedAt;
    }
    if (!existing.queries.includes(item.query) && existing.queries.length < 5) {
      existing.queries.push(item.query);
    }
  }

  const items = [...map.values()].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return b.lastRequestedAt.localeCompare(a.lastRequestedAt);
  });

  return {
    items,
    totalRequests: store.requests.length,
    uniqueSuffixes: items.length
  };
}

export async function listPublicSuffixSupportRequests(): Promise<PublicSuffixSupportResponse> {
  await pruneSupportedSuffixRequests();
  const store = await readStore();
  return aggregatePublic(store);
}

export type CreateSuffixSupportRequestResult =
  | {
      ok: true;
      created: true;
      suffix: string;
      query: string;
    }
  | {
      ok: true;
      created: false;
      reason: "already_requested";
      suffix: string;
      query: string;
    }
  | {
      ok: false;
      reason: "invalid_query" | "already_supported";
    };

export async function createSuffixSupportRequest(params: {
  query: string;
  clientIp: string;
}): Promise<CreateSuffixSupportRequestResult> {
  const query = params.query.trim();
  const suffix = normalizeSuffixLabel(
    query.includes(".") ? extractRootTld(query) : query
  );
  if (!suffix || suffix.length < 2) {
    return { ok: false, reason: "invalid_query" };
  }

  if (await isSuffixSupportedForQuery(suffix)) {
    return { ok: false, reason: "already_supported" };
  }

  const clientKey = hashClientKey(params.clientIp || "anonymous");
  const store = await readStore();

  if (store.requests.some((item) => item.clientKey === clientKey)) {
    const existing = store.requests.find((item) => item.clientKey === clientKey);
    return {
      ok: true,
      created: false,
      reason: "already_requested",
      suffix: existing?.suffix ?? suffix,
      query: existing?.query ?? query
    };
  }

  store.requests.push({
    id: randomUUID(),
    suffix,
    query,
    requestedAt: new Date().toISOString(),
    clientKey
  });

  await writeStore(store);

  return {
    ok: true,
    created: true,
    suffix,
    query
  };
}

export function getVisitorIpFromHeaders(headers: Headers): string {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip")
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }
    const ip = value.split(",")[0]?.trim() ?? "";
    if (ip) {
      return ip;
    }
  }

  return "";
}
