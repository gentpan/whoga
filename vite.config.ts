import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    nitro({
      serverDir: "./server",
      rollupConfig: { external: [/^@sentry\//] }
    }),
    tanstackStart(),
    viteReact()
  ],
  server: {
    port: 3410
  }
});

export default config;
