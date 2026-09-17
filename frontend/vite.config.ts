import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Proxy /api to the Express backend during development
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } },
  },
});
