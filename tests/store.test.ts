import assert from "node:assert/strict";
import { test } from "node:test";

import { createWorkspaceStore } from "@sincpro/web-composer";
import { EMPTY, push, toHash } from "@sincpro/web-composer/domain/index";

const ASIENTOS = { domain: "contabilidad", kind: "asientos" };
const FAC = { domain: "contabilidad", kind: "asiento", id: "FAC-12" };

test("notifies only when state actually CHANGES", () => {
  const store = createWorkspaceStore();
  let calls = 0;
  store.subscribe(() => (calls += 1));

  store.push(ASIENTOS);
  store.push(ASIENTOS);
  assert.equal(calls, 1);
});

test("`get` always returns the state of now, and unsubscribing stops the notices", () => {
  const store = createWorkspaceStore();
  let calls = 0;
  const off = store.subscribe(() => (calls += 1));

  store.push(ASIENTOS);
  off();
  store.push(FAC);
  assert.equal(calls, 1);
  assert.equal(store.get().page?.id, "FAC-12");
});

test("`onChange` is the hook for telemetry or saving on the server", () => {
  const seen: string[] = [];
  const store = createWorkspaceStore({ onChange: (w) => seen.push(toHash(w)) });
  store.push(ASIENTOS);
  assert.equal(seen.length, 1);
});

test("`apply` lets any reducer run, including one from outside", () => {
  const store = createWorkspaceStore();
  store.apply((w) => push(w, FAC));
  assert.equal(store.get().page?.id, "FAC-12");
});

test("`reset` goes back to the starting workspace", () => {
  const start = push(EMPTY, ASIENTOS);
  const store = createWorkspaceStore({ initial: start });
  store.push(FAC);
  store.reset();
  assert.equal(store.get(), start);
});
