import assert from "node:assert/strict";

import {
  Composer,
  createWorkspaceStore,
  type StoreOptions,
  useSection,
  useWorkspace,
} from "@sincpro/web-composer";
import {
  createRegistry,
  EMPTY,
  openPanel,
  push,
  type SessionMemory,
  toHash,
  type ViewSpec,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, test, vi } from "vitest";

/**
 * Context: a server-rendered app (Next.js, any SSR) draws the composer on a server — no
 * `window`, no `document`, no bundler for what it imports — and the browser then hydrates that
 * HTML: its first render must be the server's. React draws both with the server snapshot of
 * `useSyncExternalStore`, so `renderToString` with a browser around it is that first render.
 */

const loaded = vi.hoisted(() => ({ dragAdapter: 0 }));

/* Counted, not replaced: a server must never ask for it. */
vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", async (original) => {
  loaded.dragAdapter += 1;
  return original();
});

const ASIENTOS = { domain: "contabilidad", kind: "asientos" };
const FAC = { domain: "contabilidad", kind: "asiento", id: "FAC-12" };

const View = () => createElement("p", null, "view");
const SPECS: readonly ViewSpec[] = [
  {
    domain: "contabilidad",
    kind: "asientos",
    title: () => "Asientos",
    load: async () => View,
  },
  {
    domain: "contabilidad",
    kind: "asiento",
    title: (r) => `Asiento ${r.id}`,
    load: async () => View,
  },
];
const REGISTRY = createRegistry(SPECS);

/** The browser as the store sees it: a URL with a hash and the memory of its history entry. */
function openInBrowser(hash: string, memory: SessionMemory | null = null) {
  (globalThis as { window?: unknown }).window = {
    location: { hash },
    history: { state: memory, pushState: () => {}, replaceState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** An app as it is written: it holds the workspace, marks its menu and draws the composer. */
function App({ options }: { options: StoreOptions }) {
  const workspace = useWorkspace(options);
  const section = useSection(workspace, [ASIENTOS, FAC]);
  return createElement(
    Fragment,
    null,
    createElement("nav", null, section === null ? "no section" : section.kind),
    createElement(Composer, {
      workspace,
      registry: REGISTRY,
      empty: createElement("p", null, "nothing open"),
    }),
  );
}

const draw = (options: StoreOptions) => renderToString(createElement(App, { options }));

test("the composer draws on a server: no browser, the same HTML twice, no drag and drop", () => {
  assert.equal(typeof window, "undefined", "a server");
  assert.equal(typeof document, "undefined");

  const initial = openPanel(push(EMPTY, ASIENTOS), FAC, Zone.Right);
  const once = () =>
    renderToString(
      createElement(Composer, {
        workspace: createWorkspaceStore({ initial }),
        registry: REGISTRY,
      }),
    );
  const html = once();

  assert.ok(html.includes("sc-root"), "the workspace");
  assert.ok(html.includes("Asiento FAC-12"), "and the panel beside the page");
  assert.equal(once(), html, "two renders, one HTML: nothing in it depends on when or where");
  assert.equal(
    loaded.dragAdapter,
    0,
    "drag and drop is loaded by a browser, never on import",
  );
});

test("server-rendered, a link in the hash: the browser's first render is the server's", () => {
  const options = { hash: true, serverRendered: true };
  const server = draw(options);
  assert.ok(server.includes("<nav>no section</nav>"), "the server never sees the hash");
  assert.ok(server.includes("nothing open"));

  openInBrowser(toHash(push(EMPTY, FAC)));
  assert.equal(draw(options), server, "hydrating, the browser draws what the server drew");
});

test("a single-page app still draws the link on its first frame — the form a server must not use", () => {
  openInBrowser(toHash(push(EMPTY, FAC)));
  const html = draw({ hash: true });
  assert.ok(html.includes("<nav>asiento</nav>"), "the link's record at once, no empty flash");
  assert.ok(!html.includes("nothing open"));
});

test("server-rendered, the store takes the link's place once someone listens in the browser", () => {
  openInBrowser(toHash(push(EMPTY, FAC)), { trail: [ASIENTOS], peekTrail: [] });
  const changes: string[] = [];
  const store = createWorkspaceStore({
    hash: true,
    serverRendered: true,
    onChange: (w) => changes.push(toHash(w)),
  });
  assert.equal(store.get(), EMPTY, "created, it is what the server drew");

  store.subscribe(() => {});
  assert.equal(store.get().page?.id, "FAC-12", "listened to, the link's place");
  assert.deepEqual(store.get().trail, [ASIENTOS], "a reload keeps its breadcrumb here too");
  assert.equal(changes.length, 1, "announced like any change");

  store.subscribe(() => {});
  assert.equal(changes.length, 1, "taken once");
});

test("server-rendered, a change before anyone listens starts from the link, never over it", () => {
  openInBrowser(toHash(push(EMPTY, FAC)));
  const store = createWorkspaceStore({ hash: true, serverRendered: true });
  store.openPanel(ASIENTOS, Zone.Right);
  assert.equal(store.get().page?.id, "FAC-12", "the link's page is still the page");
  assert.equal(store.get().panels.length, 1);
});

test("server-rendered, a URL with no workspace in it changes nothing", () => {
  openInBrowser("");
  let calls = 0;
  const initial = push(EMPTY, ASIENTOS);
  const store = createWorkspaceStore({ initial, hash: true, serverRendered: true });
  store.subscribe(() => (calls += 1));
  assert.equal(store.get(), initial);
  assert.equal(calls, 0);
});
