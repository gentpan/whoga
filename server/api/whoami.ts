import { defineHandler } from "nitro";

import { GET } from "@/src/server/api/whoami";

export default defineHandler(({ req }) => GET(req));
