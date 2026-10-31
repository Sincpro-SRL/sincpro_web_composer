import assert from "node:assert/strict";

import {
  createRegistry,
  localEntries,
  matches,
  PaletteSection,
  searchEntries,
  type ViewSpec,
} from "@sincpro/web-composer/domain/index";
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
