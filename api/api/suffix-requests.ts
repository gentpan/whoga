import { defineHandler } from "nitro";

import { toRouteRequest } from "@/lib/http";
import { GET, POST } from "@/api/handlers/suffix-requests";

export default defineHandler(async ({ req }) => {
  const request = toRouteRequest(req);
  if (request.method === "POST") {
    return POST(request);
  }
  return GET();
});
