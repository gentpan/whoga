import { defineHandler } from "nitro";

import { GET } from "@/api/handlers/stats";

export default defineHandler(() => GET());
