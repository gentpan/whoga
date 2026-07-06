import { defineHandler } from "nitro";

import { GET } from "@/api/handlers/suffixes";

export default defineHandler(() => GET());
