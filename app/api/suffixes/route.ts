import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TldTypeCounts {
  ccTld: number;
  gTld: number;
  newGtld: number;
  sTld: number;
  brandTld: number;
  geoTld: number;
  total: number;
}

interface TldCategories {
  ccTld: string[];
  gTld: string[];
  newGtld: string[];
  sTld: string[];
  brandTld: string[];
  geoTld: string[];
}

interface UnifiedTldsPayload {
  counts?: {
    queryable?: number;
    categories?: TldTypeCounts;
  };
  tlds?: {
    queryable?: string[];
    categories?: TldCategories;
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    await ensureWhoisDataFresh(false);
    const tldsPath = path.join(process.cwd(), "data", "tlds.json");
    const raw = await readFile(tldsPath, "utf-8");
    const payload = JSON.parse(raw) as UnifiedTldsPayload;

    const suffixes = payload?.tlds?.queryable ?? [];
    const tldCategories =
      payload?.tlds?.categories ??
      ({
        ccTld: [],
        gTld: [],
        newGtld: [],
        sTld: [],
        brandTld: [],
        geoTld: []
      } as TldCategories);
    const tldTypeCounts =
      payload?.counts?.categories ??
      ({
        ccTld: 0,
        gTld: 0,
        newGtld: 0,
        sTld: 0,
        brandTld: 0,
        geoTld: 0,
        total: suffixes.length
      } as TldTypeCounts);

    return NextResponse.json({
      count: payload?.counts?.queryable ?? suffixes.length,
      suffixes,
      tldTypeCounts,
      tldCategories
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
