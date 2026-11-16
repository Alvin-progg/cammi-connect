import { defineConfig } from "vitest/config";

/** `npm run eval:routing` only: real-model evaluations, kept out of `npm test`. */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
  },
});
