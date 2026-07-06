import { defineHandler } from "nitro";

import { GET } from "@/api/handlers/whoami";

export default defineHandler(({ req }) => GET(req));
