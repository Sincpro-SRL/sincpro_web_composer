import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = fileURLToPath(new URL("./src", import.meta.url));

/**
 * Context: the package is not built as an application — `make build` compiles `src/` with tsc
 * and whoever consumes it bundles it. This is only for Storybook.
 *
 * The alias exists because the package imports itself (`@sincpro/web-composer/...`): without
 * it Vite would resolve that name through `exports` to `dist/`, which Storybook must never need.
 * `dedupe` keeps ONE React: `@sincpro/web-ui` brings hooks, and a second copy breaks them.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: /^@sincpro\/web-composer$/,
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
      { find: /^@sincpro\/web-composer\//, replacement: `${src}/` },
    ],
  },
});
