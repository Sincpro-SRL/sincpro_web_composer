import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

/**
 * Context: ONE runner for everything, the same in every Sincpro Node repo:
 *
 *   model      the rules of the workspace, in Node — no browser, under a second
 *   storybook  every story rendered in a real Chrome, its `play` and its a11y check — the story
 *              IS the test, nothing is written twice. The same tests run from Storybook's
 *              sidebar («Run tests»), so what CI checks is what you look at.
 *
 * `channel: "chrome"` uses the Chrome already installed (and on the CI runner) instead of
 * downloading one per project.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: { name: "model", environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
        },
        {
          extends: true,
          plugins: [storybookTest({ configDir: ".storybook" })],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({ launchOptions: { channel: "chrome" } }),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  }),
);
