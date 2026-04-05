import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = (request.nextUrl.searchParams.get("ip") ?? "").trim();
  if (!ip || isIP(ip) === 0) {
    return NextResponse.json({ error: "Invalid IP" }, { status: 400 });
  }

  const resolver = new Resolver();
  try {
    const ptr = await resolver.reverse(ip);
    return NextResponse.json({
      ip,
      ptr: Array.isArray(ptr) ? ptr : []
    });
  } catch {
    return NextResponse.json({
      ip,
      ptr: []
    });
  }
}

