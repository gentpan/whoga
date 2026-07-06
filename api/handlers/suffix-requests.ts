import { json, type RouteRequest } from "@/lib/http";
import {
  createSuffixSupportRequest,
  getVisitorIpFromHeaders,
  listPublicSuffixSupportRequests
} from "@/lib/suffix-support-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const payload = await listPublicSuffixSupportRequests();
  return json(payload);
}

export async function POST(request: RouteRequest): Promise<Response> {
  let body: { query?: string } = {};
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return json({ error: "query is required" }, { status: 400 });
  }

  const clientIp = getVisitorIpFromHeaders(request.headers);
  const result = await createSuffixSupportRequest({ query, clientIp });

  if (!result.ok) {
    if (result.reason === "already_supported") {
      return json(
        {
          error: "This suffix is already supported",
          errorCode: "ALREADY_SUPPORTED"
        },
        { status: 409 }
      );
    }
    return json({ error: "Invalid query" }, { status: 400 });
  }

  if (!result.created) {
    return json({
      ok: true,
      created: false,
      reason: result.reason,
      suffix: result.suffix,
      query: result.query
    });
  }

  return json({
    ok: true,
    created: true,
    suffix: result.suffix,
    query: result.query
  });
}
