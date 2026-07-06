import { json } from "@/lib/http";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return json({ ip: getVisitorIp(request.headers) });
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
