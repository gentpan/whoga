import { defineHandler } from "nitro";

import { toRouteRequest } from "@/src/lib/http";
import { GET } from "@/src/server/api/dns-lookup";

export default defineHandler(({ req }) => GET(toRouteRequest(req)));
