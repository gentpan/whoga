import { defineHandler } from "nitro";

import { GET } from "@/src/server/api/stats";

export default defineHandler(() => GET());
