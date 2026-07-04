import { json } from "@/src/lib/http";
import { getBootstrapStats } from "@/lib/rdap-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const stats = await getBootstrapStats();
    return json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return json({ error: message }, { status: 500 });
  }
}

