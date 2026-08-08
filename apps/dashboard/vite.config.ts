import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + websocket to the hub, so `pnpm --filter dashboard dev`
// gives hot reload while the hub runs on :4021. Production is served by the hub
// from dist/ (single port).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4021",
      "/ws": { target: "ws://localhost:4021", ws: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
