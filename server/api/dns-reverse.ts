import { defineHandler } from "nitro";

import { toRouteRequest } from "@/src/lib/http";
import { GET } from "@/src/server/api/dns-reverse";

export default defineHandler(({ req }) => GET(toRouteRequest(req)));
