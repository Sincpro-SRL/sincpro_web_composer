import assert from "node:assert/strict";

import {
  createRegistry,
  localEntries,
  matches,
  PaletteSection,
  searchEntries,
  type ViewSpec,
} from "@sincpro/web-composer/domain/index";
import { platformKeys } from "@sincpro/web-composer/shell/keys";
import { test, vi } from "vitest";

const View = () => null;

const SPECS: readonly ViewSpec[] = [
  {
    domain: "contabilidad",
    kind: "asientos",
    title: () => "Asientos contables",
    goto: true,
    load: async () => View,
  },
  {
    domain: "contabilidad",
    kind: "asiento",
    title: (r) => `Asiento ${r.id}`,
    actions: (r) => [
      {
        id: "audit",
        label: "Auditar",
        keywords: ["revisar"],
        run: (api) => api.open({ ...r }, { to: "peek" }),
      },
    ],
    search: async (q) => [
      {
        ref: { domain: "contabilidad", kind: "asiento", id: q },
        label: `Asiento ${q}`,
        detail: "ACME",
      },
    ],
    load: async () => View,
  },
  {
    domain: "roto",
    kind: "cosa",
    title: () => "x",
    search: async () => Promise.reject(new Error("down")),
    load: async () => View,
  },
];

const REGISTRY = createRegistry(SPECS);
const ON = { domain: "contabilidad", kind: "asiento", id: "FAC-12" };

test("the palette offers the screens, and the actions of what I am on", () => {
  assert.deepEqual(
    localEntries(REGISTRY, null).map((e) => e.section),
    [PaletteSection.Goto],
  );
  assert.deepEqual(
    localEntries(REGISTRY, ON).map((e) => e.label),
    ["Auditar", "Asientos contables"],
    "actions first",
  );
});

test("a query matches every word, ignoring accents, case and order", () => {
  const [audit, goto] = localEntries(REGISTRY, ON);
  assert.ok(matches(goto!, "contables asientos"));
  assert.ok(matches(goto!, "CONTABLES"));
  assert.ok(matches(audit!, "revisar"), "keywords count");
  assert.ok(!matches(goto!, "factura"));
});

test("a failing domain does not take the others' results with it", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const found = await searchEntries(REGISTRY, "FAC-99");
  assert.equal(found.length, 1);
  assert.equal(found[0]!.label, "Asiento FAC-99");
  assert.equal(warn.mock.calls.length, 1, "the failure is logged, not swallowed");
  assert.deepEqual(await searchEntries(REGISTRY, "F"), [], "one letter asks nobody");
  warn.mockRestore();
});

test("a found record says what it is, by its own kind and not the searching domain's", async () => {
  const maria = (kind: string) => ({ domain: "cauor", kind, id: "7" });
  const registry = createRegistry([
    {
      domain: "cauor",
      kind: "colegiado",
      noun: "Colegiado",
      title: () => "María",
      search: async () => [
        { ref: maria("colegiado"), label: "María", detail: "MFAQ0123" },
        { ref: maria("cuenta"), label: "María" },
      ],
      load: async () => View,
    },
    {
      domain: "cauor",
      kind: "cuenta",
      noun: "Cuenta",
      title: () => "x",
      load: async () => View,
    },
  ]);
  const found = await searchEntries(registry, "maria");
  assert.deepEqual(
    found.map((e) => (e.section === PaletteSection.Actions ? null : [e.noun, e.detail])),
    [
      ["Colegiado", "MFAQ0123"],
      ["Cuenta", undefined],
    ],
  );
});

test("each domain's answer shows as it arrives: a slow one does not hold back the others", async () => {
  let release = () => {};
  const slow = new Promise<void>((resolve) => (release = resolve));
  const hit = (kind: string, label: string) => ({
    ref: { domain: "d", kind, id: "1" },
    label,
  });
  const registry = createRegistry([
    {
      domain: "d",
      kind: "lento",
      title: () => "x",
      search: async () => {
        await slow;
        return [hit("lento", "Lento")];
      },
      load: async () => View,
    },
    {
      domain: "d",
      kind: "rapido",
      title: () => "x",
      search: async () => [hit("rapido", "Rápido")],
      load: async () => View,
    },
  ]);
  const heard: string[][] = [];
  const all = searchEntries(registry, "ab", (sofar) => heard.push(sofar.map((e) => e.label)));
  await vi.waitFor(() => assert.deepEqual(heard, [["Rápido"]]));
  release();
  assert.deepEqual(
    (await all).map((e) => e.label),
    ["Rápido", "Lento"],
    "appended: nothing moves under the cursor",
  );
  assert.deepEqual(heard, [["Rápido"], ["Rápido", "Lento"]]);
});

test("off a Mac the shortcuts name Ctrl, Alt and Shift; on one they stay", () => {
  const hint = "↵ page · ⌥↵ peek · ⇧↵ beside · ⌘↵ window";
  assert.equal(
    platformKeys(hint, false),
    "↵ page · Alt+↵ peek · Shift+↵ beside · Ctrl+↵ window",
  );
  assert.equal(platformKeys("⌘⌥[ / ⌘⌥]", false), "Ctrl+Alt+[ / Ctrl+Alt+]");
  assert.equal(platformKeys(hint, true), hint);
  assert.equal(platformKeys("Esc", false), "Esc", "a key without a modifier is untouched");
});

test("Mod is ⌘ on a Mac and Ctrl elsewhere: the web's notation works too", () => {
  assert.equal(platformKeys("Mod+Shift+⏎ · Alt+↵", true), "⌘⇧⏎ · ⌥↵");
  assert.equal(platformKeys("Mod+Shift+⏎ · Alt+↵", false), "Ctrl+Shift+⏎ · Alt+↵");
  assert.equal(platformKeys("mod+k", false), "Ctrl+k", "any case");
});
