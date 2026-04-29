import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // Forward all /api requests to the Hono backend
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output to backend's /public folder so Hono serves it in production
    outDir: "../public",
    emptyOutDir: true,
  },
});
