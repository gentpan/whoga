import { defineHandler } from "nitro";

import { toRouteRequest } from "@/src/lib/http";
import { GET, POST } from "@/src/server/api/suffix-requests";

export default defineHandler(async ({ req }) => {
  const request = toRouteRequest(req);
  if (request.method === "POST") {
    return POST(request);
  }
  return GET();
});
