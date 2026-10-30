import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Context: Storybook looks at THIS package ONLY. The domains it draws (support, accounting)
 * are fakes in `stories/support/`, declared the same way a real application declares its own —
 * `createRegistry` does not tell them apart, and neither does the composer.
 *
 * The sidebar is ordered by USE CASE, not by component: each story is one scenario of a person
 * working, and shows what the workspace lets them do.
 */
const config: StorybookConfig = {
  stories: ["../stories/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-mcp"],
  framework: { name: "@storybook/react-vite", options: {} },
};

export default config;
