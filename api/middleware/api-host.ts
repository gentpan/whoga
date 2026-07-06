import { defineHandler } from "nitro";

import { toRouteRequest } from "@/lib/http";
import { GET as getWhois } from "@/api/handlers/whois";

export default defineHandler((event) => {
  const url = new URL(event.req.url);
  const host = event.req.headers.get("host")?.split(":")[0].toLowerCase();

  if (host !== "api.who.ga") {
    return;
  }

  const query = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
  if (!query || query.startsWith("api/")) {
    return;
  }

  const target = new URL("/api/whois", url);
  target.search = url.search;
  target.searchParams.set("domain", query);

  return getWhois(toRouteRequest(new Request(target, { headers: event.req.headers })));
});
