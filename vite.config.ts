import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client bundle must never receive server secrets. We deliberately do not
// use `define` or `envPrefix` to expose anything; only VITE_-prefixed vars
// (none are used) could reach the browser.
export default defineConfig({
  plugins: [react()],
  root: ".",
  build: { outDir: "dist/client", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
