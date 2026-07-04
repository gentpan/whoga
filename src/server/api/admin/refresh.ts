import type { RouteRequest } from "@/src/lib/http";
import { json } from "@/src/lib/http";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: RouteRequest): boolean {
  const cronHeader = request.headers.get("x-vercel-cron");
  if (cronHeader) {
    return true;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${secret}`;
}

async function refresh(request: RouteRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sync = await ensureWhoisDataFresh(true);
    return json({ success: true, sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: RouteRequest): Promise<Response> {
  return refresh(request);
}

export async function POST(request: RouteRequest): Promise<Response> {
  return refresh(request);
}
