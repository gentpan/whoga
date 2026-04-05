import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPDATE_META_FILE = path.join(process.cwd(), "data", "update-meta.json");

export async function GET(): Promise<NextResponse> {
  try {
    await ensureWhoisDataFresh(false);
    const raw = await readFile(UPDATE_META_FILE, "utf-8");
    const meta = JSON.parse(raw);
    return NextResponse.json(meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
