import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveReadableDataPath } from "@/lib/runtime-data";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    await ensureWhoisDataFresh(false);
    const raw = await readFile(await resolveReadableDataPath("update-meta.json"), "utf-8");
    const meta = JSON.parse(raw);
    return NextResponse.json(meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
