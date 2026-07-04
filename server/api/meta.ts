import { defineHandler } from "nitro";

import { GET } from "@/src/server/api/meta";

export default defineHandler(() => GET());
