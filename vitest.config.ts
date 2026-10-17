import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
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
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
    reporters: "default",
  },
});
