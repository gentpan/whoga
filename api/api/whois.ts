import { defineHandler } from "nitro";

import { toRouteRequest } from "@/lib/http";
import { GET } from "@/api/handlers/whois";

export default defineHandler(({ req }) => GET(toRouteRequest(req)));
