import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    !process.env.VERCEL && dts({
      entryRoot: "src",
      tsconfigPath: resolve(__dirname, "tsconfig.build.json"),
      rollupTypes: true,
      insertTypesEntry: true,
      outputDir: "dist",
      include: ["src", "components"]
    })
  ],
  build: {
    lib: {
      entry: {
        "ola-pdf": resolve(__dirname, "src/index.ts"),
        "components/index": resolve(__dirname, "components/index.ts")
      },
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM"
        }
      }
    }
  }
});
