import assert from "node:assert/strict";

import { type ConfirmDiscard, createWorkspaceStore } from "@sincpro/web-composer";
import { EMPTY, PAGE, push, toHash } from "@sincpro/web-composer/domain/index";
import { test } from "vitest";

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

const FORM = { domain: "contabilidad", kind: "factura-nueva" };

/** A form half filled on the page, over the list. */
function editing(confirmDiscard?: ConfirmDiscard) {
  const store = createWorkspaceStore({
    initial: push(push(EMPTY, ASIENTOS), FORM),
    ...(confirmDiscard === undefined ? {} : { confirmDiscard }),
  });
  store.setDirty(PAGE, FORM, true);
  return store;
}

test("a crumb over a dirty form asks, and «keep editing» changes nothing", () => {
  const asked: string[][] = [];
  const store = editing((lost) => {
    asked.push(lost.map((r) => r.kind));
    return false;
  });
  store.goTo(0);
  assert.deepEqual(asked, [["factura-nueva"]]);
  assert.equal(store.get().page?.kind, "factura-nueva");
});

test("«discard» goes on, and the form is no longer dirty", () => {
  let asked = 0;
  const store = editing(() => (asked += 1) > 0);
  store.back();
  assert.equal(store.get().page?.kind, "asientos");
  store.push(FORM);
  store.back();
  assert.equal(asked, 1, "a fresh form is not dirty until it says so");
});

test("another face of the dirty view keeps what was typed: nothing to ask", () => {
  let asked = 0;
  const store = editing(() => (asked += 1) > 0);
  store.replace({ ...FORM, params: { tab: "lineas" } });
  store.openPanel(FAC);
  assert.equal(asked, 0);
});

test("an answer that takes a while keeps the order of what came after it", async () => {
  let answer: (ok: boolean) => void = () => {};
  const store = editing(() => new Promise<boolean>((resolve) => (answer = resolve)));
  store.back();
  store.push(FAC);
  assert.equal(store.get().page?.kind, "factura-nueva", "nothing moves while asking");

  answer(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(store.get().page?.id, "FAC-12");
  assert.deepEqual(
    store.get().trail.map((r) => r.kind),
    ["asientos"],
    "back THEN open, in that order",
  );
});

/** Just enough of a browser for the store: the hash, its history and its events. */
function fakeBrowser() {
  const calls: string[] = [];
  const handlers = new Map<string, (e: unknown) => void>();
  const location = { hash: "" };
  const win = {
    location,
    history: {
      pushState: (_s: unknown, _t: string, url: string) => {
        calls.push("push");
        location.hash = url;
      },
      replaceState: (_s: unknown, _t: string, url: string) => {
        calls.push("replace");
        location.hash = url;
      },
    },
    addEventListener: (type: string, h: (e: unknown) => void) => handlers.set(type, h),
    removeEventListener: (type: string) => handlers.delete(type),
  };
  (globalThis as { window?: unknown }).window = win;
  return {
    calls,
    location,
    fire: (type: string, e: unknown) => handlers.get(type)?.(e),
    done: () => delete (globalThis as { window?: unknown }).window,
  };
}

test("the browser's Back works: a new place is a history entry, a size is not", () => {
  const browser = fakeBrowser();
  try {
    const store = createWorkspaceStore({ hash: true });
    store.subscribe(() => {});
    store.push(ASIENTOS);
    store.push(FAC);
    store.resizeZone("right", 0.4);
    assert.deepEqual(browser.calls, ["push", "push", "replace"]);

    const list = toHash(push(EMPTY, ASIENTOS));
    browser.location.hash = list;
    browser.fire("popstate", { state: { trail: [], peekTrail: [] } });
    assert.equal(store.get().page?.kind, "asientos");
  } finally {
    browser.done();
  }
});
