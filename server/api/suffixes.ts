import { defineHandler } from "nitro";

import { GET } from "@/src/server/api/suffixes";

export default defineHandler(() => GET());
