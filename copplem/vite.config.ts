// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "development" ? "/" : "./",
  server: {
    port: 5173, 
    strictPort: true, 
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
