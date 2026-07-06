import { defineHandler } from "nitro";

import { toRouteRequest } from "@/lib/http";
import { GET } from "@/api/handlers/dns-lookup";

export default defineHandler(({ req }) => GET(toRouteRequest(req)));
