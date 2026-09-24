import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Allow `npm test` to succeed when no test files exist yet.
     * Remove this option once the first real test file is added.
     */
    passWithNoTests: true,
  },
});
