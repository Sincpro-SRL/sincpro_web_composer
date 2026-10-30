/**
 * Context: `tsc` is green for a story that compiles and blows up when it renders. This opens
 * every story in a real browser and fails if the console complained or the story drew
 * nothing — the only way to know a story works. `make smoke` runs it.
 *
 * It uses the system Chrome instead of downloading one (~130 MB per project); `CHROME_PATH`
 * points it elsewhere. If a Storybook already answers on the port it is reused, otherwise
 * one is started and stopped.
 *
 * A story tagged `throws` MUST fail: it documents error isolation, and one that stopped
 * failing means the isolation broke.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import puppeteer from "puppeteer-core";

const CHROMES = [
  process.env["CHROME_PATH"],
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

/** What every page prints and says nothing about the story. */
const NOISE = [/favicon/i, /Failed to load resource.*404/i];

const port = process.argv[2] ?? "6099";
const base = `http://localhost:${port}`;

const chrome = CHROMES.find((p) => p !== undefined && existsSync(p));
if (chrome === undefined) {
  console.error("Chrome not found. Install it or point CHROME_PATH at the binary.");
  process.exit(2);
}

type Index = {
  entries: Record<string, { id: string; title: string; name: string; tags?: string[] }>;
};

async function index(): Promise<Index | undefined> {
  try {
    const response = await fetch(`${base}/index.json`);
    return response.ok ? ((await response.json()) as Index) : undefined;
  } catch {
    return undefined;
  }
}

let server: ReturnType<typeof spawn> | undefined;
let entries = await index();
if (entries === undefined) {
  server = spawn("npx", ["storybook", "dev", "-p", port, "--no-open", "--ci", "--quiet"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  process.on("exit", () => server?.kill("SIGTERM"));
  for (let attempt = 0; attempt < 90 && entries === undefined; attempt += 1) {
    await new Promise((ready) => setTimeout(ready, 1000));
    entries = await index();
  }
  if (entries === undefined) throw new Error(`Storybook did not come up on ${port}`);
}

/* Autodocs pages repeat their stories; a standalone MDX page (the introduction) is its own
   content and gets opened in docs mode. */
const stories = Object.values(entries.entries)
  .filter((e) => !e.id.endsWith("--docs") || (e.tags ?? []).includes("unattached-mdx"))
  .map((e) => ({
    id: e.id,
    title: `${e.title} · ${e.name}`,
    docs: e.id.endsWith("--docs"),
    throws: (e.tags ?? []).includes("throws"),
  }));

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const bad: { title: string; problems: string[] }[] = [];

/* A second pass in dark over the screens a person works on (views and templates) and the
   theme page: a token that fails to flip shows up as a console error or a blank story. The
   theme comes from the toolbar global, so it goes through the same decorator an app uses. */
const jobs = [
  ...stories.map((story) => ({ ...story, theme: "light" })),
  ...stories
    .filter(
      (story) =>
        !story.docs &&
        !story.throws &&
        /^(?:[45] · |1 · Fundamentos\/Tema)/.test(story.title),
    )
    .map((story) => ({ ...story, title: `${story.title} [dark]`, theme: "dark" })),
];

for (const { id, title, docs, throws, theme } of jobs) {
  const noise: string[] = [];
  const note = (text: string) => {
    if (!NOISE.some((r) => r.test(text))) noise.push(text);
  };
  const onError = (e: unknown) => note(String(e));
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error" || m.type() === "warn") note(m.text());
  };

  page.on("pageerror", onError);
  page.on("console", onConsole);
  const mode = docs ? "docs" : "story";
  await page.goto(
    `${base}/iframe.html?id=${encodeURIComponent(id)}&viewMode=${mode}&globals=theme:${theme}`,
    { waitUntil: "networkidle0", timeout: 45000 },
  );
  await new Promise((ready) => setTimeout(ready, 350));

  const blank = await page.evaluate(
    (root_) => {
      const root = document.querySelector(root_);
      return (
        (root?.textContent ?? "").trim() === "" &&
        (root?.querySelectorAll("*").length ?? 0) < 3
      );
    },
    docs ? "#storybook-docs" : "#storybook-root",
  );
  page.off("pageerror", onError);
  page.off("console", onConsole);

  if (blank) noise.push("the story drew nothing");

  if (theme === "dark") {
    const applied = await page.evaluate(() => document.documentElement.dataset["theme"]);
    if (applied !== "dark")
      noise.push(`asked for dark and <html data-theme> is "${applied}"`);
  }

  /* ONE primary action per screen (docs/PRINCIPLES.md §2). Checked on the views and the
     templates — the screens a person actually works on — and not on the primitives, where a
     story lines up the four button roles on purpose. */
  if (/^[45] · /.test(title)) {
    const primaries = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-emphasis="primary"]')].filter(
          (el) => (el as HTMLElement).offsetParent !== null,
        ).length,
    );
    if (primaries > 1)
      noise.push(`${primaries} primary actions on screen — the rule is one per view`);
  }

  const problems = throws
    ? noise.length === 0
      ? ["tagged `throws` and did not fail: the isolation is no longer tested"]
      : []
    : [...new Set(noise)];

  if (problems.length > 0) bad.push({ title, problems });
  process.stdout.write(problems.length > 0 ? "✗" : throws ? "!" : ".");
}

await browser.close();
server?.kill("SIGTERM");

console.log(`\n\n${jobs.length} stories (light + dark passes), ${bad.length} with problems`);
for (const { title, problems } of bad) {
  console.log(`\n  ${title}`);
  for (const p of problems) console.log(`     ${p.slice(0, 400)}`);
}
process.exit(bad.length === 0 ? 0 : 1);
