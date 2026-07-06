import type { RouteRequest } from "@/lib/http";
import { json } from "@/lib/http";
import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: RouteRequest): Promise<Response> {
  const ip = (request.nextUrl.searchParams.get("ip") ?? "").trim();
  if (!ip || isIP(ip) === 0) {
    return json({ error: "Invalid IP" }, { status: 400 });
  }

  const resolver = new Resolver();
  try {
    const ptr = await resolver.reverse(ip);
    return json({
      ip,
      ptr: Array.isArray(ptr) ? ptr : []
    });
  } catch {
    return json({
      ip,
      ptr: []
    });
  }
}

