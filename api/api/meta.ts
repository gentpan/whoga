import { defineHandler } from "nitro";

import { GET } from "@/api/handlers/meta";

export default defineHandler(() => GET());
