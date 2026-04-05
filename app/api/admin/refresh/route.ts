import { NextRequest, NextResponse } from "next/server";
import { ensureWhoisDataFresh } from "@/lib/whois-data-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
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

async function refresh(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sync = await ensureWhoisDataFresh(true);
    return NextResponse.json({ success: true, sync });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return refresh(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return refresh(request);
}
