import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "ola-pdf": resolve(__dirname, "../src"),
      "ola-pdf/components": resolve(__dirname, "../components")
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true
  }
});
