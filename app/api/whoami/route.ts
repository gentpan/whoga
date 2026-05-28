import { NextResponse } from "next/server";
import { isIP } from "node:net";

export async function GET(request: Request) {
  const headerIp = getVisitorIp(request.headers);
  if (headerIp) {
    return NextResponse.json({ ip: headerIp });
  }

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

function getVisitorIp(headers: Headers): string {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip")
  ];

  for (const value of candidates) {
    const ip = pickFirstValidIp(value);
    if (ip) {
      return ip;
    }
  }

  return "";
}

function pickFirstValidIp(value: string | null): string {
  if (!value) {
    return "";
  }

  for (const item of value.split(",")) {
    const candidate = normalizeIp(item);
    if (candidate && isIP(candidate)) {
      return candidate;
    }
  }

  return "";
}

function normalizeIp(value: string): string {
  let candidate = value.trim().replace(/^"|"$/g, "");
  if (candidate.startsWith("::ffff:")) {
    candidate = candidate.slice("::ffff:".length);
  }
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  }
  return candidate;
}
