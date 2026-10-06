import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate from vitest.config.mts so `npm test` (and CI) never depend on local session files.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["eval/**/*.eval.ts"], silent: false, reporters: ["dot"] },
});
