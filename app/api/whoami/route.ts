import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const headerIp = forwarded?.split(",")[0]?.trim() || realIp || "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const responseV4 = await fetch("https://ipv4.ipwest.com", {
      signal: controller.signal,
      cache: "no-store"
    });
    if (responseV4.ok) {
      const text = (await responseV4.text()).trim();
      if (text) {
        return NextResponse.json({ ip: text });
      }
    }

    const responseV6 = await fetch("https://ipv6.ipwest.com", {
      signal: controller.signal,
      cache: "no-store"
    });
    if (responseV6.ok) {
      const text = (await responseV6.text()).trim();
      if (text) {
        return NextResponse.json({ ip: text });
      }
    }
  } catch {
    // ignore and fall back to headers
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({ ip: headerIp });
}
