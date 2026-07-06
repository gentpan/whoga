import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    nitro({
      serverDir: "./api",
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        "/assets/**": {
          headers: { "Cache-Control": "public, max-age=31536000, immutable" }
        },
        "/**": {
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
        }
      }
    }),
    tanstackStart({
      srcDirectory: "web"
    }),
    viteReact()
  ],
  server: {
    port: 3410
  }
});

export default config;
