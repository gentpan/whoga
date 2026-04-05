import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_HOST = "api.who.ga";
const MAIN_HOST = "who.ga";

function normalizeHost(hostHeader: string | null): string {
  return (hostHeader ?? "").toLowerCase().split(":")[0] ?? "";
}

function isReservedPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/_next/") || pathname === "/favicon.ico";
}

export function middleware(request: NextRequest): NextResponse {
  const host = normalizeHost(request.headers.get("host"));

  if (host !== API_HOST) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(`https://${MAIN_HOST}/`, request.url), 308);
  }

  if (isReservedPath(pathname)) {
    return NextResponse.next();
  }

  const query = pathname.slice(1);
  if (!query) {
    return NextResponse.redirect(new URL(`https://${MAIN_HOST}/`, request.url), 308);
  }

  const rewrittenUrl = request.nextUrl.clone();
  rewrittenUrl.pathname = "/api/whois";
  rewrittenUrl.search = "";
  rewrittenUrl.searchParams.set("domain", decodeURIComponent(query));

  if (search) {
    const extraParams = new URLSearchParams(search);
    extraParams.forEach((value, key) => {
      if (key !== "domain") {
        rewrittenUrl.searchParams.set(key, value);
      }
    });
  }

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: ["/:path*"]
};
