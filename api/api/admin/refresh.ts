import { defineHandler } from "nitro";

import { toRouteRequest } from "@/lib/http";
import { GET, POST } from "@/api/handlers/admin/refresh";

export default defineHandler(({ req }) => {
  const request = toRouteRequest(req);
  return req.method === "POST" ? POST(request) : GET(request);
});
