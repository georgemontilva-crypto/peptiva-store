import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "client",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../dist/public", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/trpc": "http://localhost:3001", "/wc-api": "http://localhost:3001" },
  },
});
