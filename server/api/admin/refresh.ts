import { defineHandler } from "nitro";

import { toRouteRequest } from "@/src/lib/http";
import { GET, POST } from "@/src/server/api/admin/refresh";

export default defineHandler(({ req }) => {
  const request = toRouteRequest(req);
  return req.method === "POST" ? POST(request) : GET(request);
});
