import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DnsRecordMap = {
  A: string[];
  AAAA: string[];
  CNAME: string[];
  MX: string[];
  NS: string[];
  TXT: string[];
  CAA: string[];
  PTR: string[];
  SRV: string[];
  SOA: Record<string, unknown>;
};

type CachedLookup = {
  expiresAt: number;
  payload: {
    code: number;
    data: {
      domain: string;
      records: DnsRecordMap;
      source: string;
      cached: boolean;
      timingMs: number;
      timestamp: number;
    };
    cached: boolean;
    timestamp: number;
  };
};

const LOOKUP_TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const dnsCache = new Map<string, CachedLookup>();

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

function isLikelyDomain(input: string): boolean {
  if (!input || input.length > 253) {
    return false;
  }
  return /^[a-z0-9.-]+$/i.test(input) && input.includes(".");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = LOOKUP_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    })
  ]);
}

function isDnsNoDataError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeError = error as { code?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  return code === "ENODATA" || code === "ENOTFOUND" || code === "ENOTIMP" || code === "SERVFAIL";
}

async function safeResolve<T>(
  resolverCall: () => Promise<T>,
  timeoutMs = LOOKUP_TIMEOUT_MS
): Promise<T | null> {
  try {
    return await withTimeout(resolverCall(), timeoutMs);
  } catch (error) {
    if (isDnsNoDataError(error)) {
      return null;
    }
    throw error;
  }
}

function mapTxt(records: string[][] | null): string[] {
  if (!records) {
    return [];
  }
  return records.map((row) => row.join("")).filter(Boolean);
}

function mapMx(records: { exchange: string; priority: number }[] | null): string[] {
  if (!records) {
    return [];
  }
  return records.map((row) => `${row.priority} ${row.exchange}`).filter(Boolean);
}

function mapSrv(
  records:
    | {
        name: string;
        port: number;
        priority: number;
        weight: number;
      }[]
    | null
): string[] {
  if (!records) {
    return [];
  }
  return records
    .map((row) => `${row.priority} ${row.weight} ${row.port} ${row.name}`)
    .filter(Boolean);
}

function mapCaa(
  records:
    | {
        critical: number;
        issue?: string;
        issuewild?: string;
        iodef?: string;
      }[]
    | null
): string[] {
  if (!records) {
    return [];
  }
  return records
    .map((row) => {
      if (row.issue) {
        return `issue "${row.issue}"`;
      }
      if (row.issuewild) {
        return `issuewild "${row.issuewild}"`;
      }
      if (row.iodef) {
        return `iodef "${row.iodef}"`;
      }
      return row.critical ? `critical=${row.critical}` : "";
    })
    .filter(Boolean);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const domainParam = request.nextUrl.searchParams.get("domain") ?? "";
  const domain = normalizeDomain(domainParam);

  if (!isLikelyDomain(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const now = Date.now();
  const hit = dnsCache.get(domain);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json({
      ...hit.payload,
      cached: true,
      data: {
        ...hit.payload.data,
        cached: true
      }
    });
  }

  try {
    const resolver = new Resolver();
    const startedAt = Date.now();

    const [a, aaaa, cname, mx, ns, txt, caa, ptr, srv, soa] = await Promise.all([
      safeResolve(() => resolver.resolve4(domain)),
      safeResolve(() => resolver.resolve6(domain)),
      safeResolve(() => resolver.resolveCname(domain)),
      safeResolve(() => resolver.resolveMx(domain)),
      safeResolve(() => resolver.resolveNs(domain)),
      safeResolve(() => resolver.resolveTxt(domain)),
      safeResolve(() => resolver.resolveCaa(domain)),
      safeResolve(() => resolver.resolvePtr(domain)),
      safeResolve(() => resolver.resolveSrv(domain)),
      safeResolve(() => resolver.resolveSoa(domain))
    ]);

    const records: DnsRecordMap = {
      A: Array.isArray(a) ? a : [],
      AAAA: Array.isArray(aaaa) ? aaaa : [],
      CNAME: Array.isArray(cname) ? cname : [],
      MX: mapMx(Array.isArray(mx) ? mx : null),
      NS: Array.isArray(ns) ? ns : [],
      TXT: mapTxt(Array.isArray(txt) ? txt : null),
      CAA: mapCaa(Array.isArray(caa) ? caa : null),
      PTR: Array.isArray(ptr) ? ptr : [],
      SRV: mapSrv(Array.isArray(srv) ? srv : null),
      SOA: soa && typeof soa === "object" ? (soa as unknown as Record<string, unknown>) : {}
    };

    const payload = {
      code: 0,
      data: {
        domain,
        records,
        source: "local-resolver",
        cached: false,
        timingMs: Date.now() - startedAt,
        timestamp: Math.floor(Date.now() / 1000)
      },
      cached: false,
      timestamp: Math.floor(Date.now() / 1000)
    };

    dnsCache.set(domain, {
      expiresAt: now + CACHE_TTL_MS,
      payload
    });

    return NextResponse.json({
      domain,
      result: payload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DNS lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
