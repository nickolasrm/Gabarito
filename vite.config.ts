import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The build must stay static: relative base so the same output works from a project
 * Pages URL, a user Pages URL, or a plain file server (decision 0001).
 */
export default defineConfig({
  root: "apps/web",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@gabarito/geometry": resolve("./packages/geometry/src/index.ts"),
      "@gabarito/core": resolve("./packages/core/src/index.ts"),
      "@gabarito/scene": resolve("./packages/scene/src/index.ts"),
      "@gabarito/tools": resolve("./packages/tools/src/index.ts"),
      "@gabarito/ui": resolve("./packages/ui/src/index.ts"),
      "@gabarito/app": resolve("./packages/app/src/index.ts"),
    },
  },
  build: {
    outDir: resolve("./dist"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
  },
});
