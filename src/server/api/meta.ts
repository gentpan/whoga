import { readFile } from "node:fs/promises";
import { json } from "@/src/lib/http";
import { resolveReadableDataPath } from "@/lib/runtime-data";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await ensureWhoisDataFresh(false);
    const raw = await readFile(await resolveReadableDataPath("update-meta.json"), "utf-8");
    const meta = JSON.parse(raw);
    return json(meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return json({ error: message }, { status: 500 });
  }
}
