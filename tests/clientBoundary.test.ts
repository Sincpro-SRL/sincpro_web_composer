import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { test } from "vitest";

/**
 * Context: in a React Server Components app (Next.js App Router) a module that runs a hook,
 * creates a context or attaches an event handler must start with `"use client"` — without it a
 * Server Component cannot even import the package: the app fails at build, in the consumer's
 * code, far from the cause. The same rule `@sincpro/web-ui` keeps.
 *
 * The reverse is kept too: the model, the store, the API, the copy and `platformKeys` stay free
 * of the directive, so a server can call them.
 */

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const DIRECTIVE = '"use client";';

/* `use…<T>(` counts: a hook called with a type argument is still a hook. */
const CLIENT_ONLY = /\buse[A-Z]\w*\s*[<(]|\bcreateContext\b|\bon[A-Z][a-zA-Z]+=\{/;

/** The code, without its comments: a docstring that names `useCrumbs(api)` runs no hook. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function modules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return modules(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const ALL = modules(SRC);
const needsTheClient = (file: string) => CLIENT_ONLY.test(codeOf(readFileSync(file, "utf8")));
const name = (file: string) => relative(SRC, file);

test('every module that needs the client starts with "use client"', () => {
  const missing = ALL.filter(
    (file) => needsTheClient(file) && !readFileSync(file, "utf8").startsWith(DIRECTIVE),
  ).map(name);
  assert.deepEqual(missing, [], `add \`${DIRECTIVE}\` as the first line of these modules`);
});

test("pure logic stays without it, callable from a server", () => {
  const marked = ALL.filter(
    (file) => !needsTheClient(file) && readFileSync(file, "utf8").startsWith(DIRECTIVE),
  ).map(name);
  assert.deepEqual(marked, [], "no hook, no context, no handler: no directive");
  assert.ok(
    ALL.filter((file) => name(file).startsWith("domain")).every((f) => !needsTheClient(f)),
    "the model never needs the client",
  );
});

test("the build keeps it at the top of every module it emits", () => {
  const build = ts.readConfigFile(join(ROOT, "tsconfig.build.json"), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(build.config, ts.sys, ROOT);
  const client = ALL.filter(needsTheClient);
  assert.ok(client.length > 0);

  const lost = client.filter((file) => {
    const emitted = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: options,
      fileName: file,
    }).outputText;
    return !emitted.startsWith(DIRECTIVE);
  });
  assert.deepEqual(lost.map(name), [], "`make build` (tsc) must emit the directive first");
});
