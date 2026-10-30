import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createApiFactory,
  createWorkspaceStore,
  PanelHost,
  ViewHost,
} from "@sincpro/web-composer";
import {
  createRegistry,
  Destination,
  EMPTY,
  openPanel,
  push,
  Surface,
  type ViewSpec,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const ASIENTOS = { domain: "contabilidad", kind: "asientos" };
const FAC = { domain: "contabilidad", kind: "asiento", id: "FAC-12" };
const PAG = { domain: "contabilidad", kind: "asiento", id: "PAG-7" };
const APUNTE = { domain: "contabilidad", kind: "apunte", id: "A-1" };

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
    preferredZone: Zone.Bottom,
    load: async () => View,
  },
  {
    domain: "contabilidad",
    kind: "apunte",
    title: (r) => `Apunte ${r.id}`,
    load: async () => View,
  },
];
const REGISTRY = createRegistry(SPECS);
const paint = (el: ReactElement) => renderToStaticMarkup(el);

function setup(defaults: Parameters<typeof createApiFactory>[1] = { registry: REGISTRY }) {
  const store = createWorkspaceStore({ initial: push(EMPTY, ASIENTOS) });
  const factory = createApiFactory(store, defaults);
  return { store, factory, page: factory.for(ASIENTOS, { surface: Surface.Page }) };
}

test("`open` goes to the page unless it is told otherwise", () => {
  const { store, page } = setup();

  page.open(FAC);
  assert.equal(store.get().page?.id, "FAC-12", "the default is the page");
  assert.equal(store.get().trail.length, 1, "with the way back");

  page.open(PAG, { to: Destination.Peek });
  assert.equal(store.get().peek?.id, "PAG-7");

  page.open(PAG, { to: Destination.Window });
  assert.equal(store.get().panels.at(-1)!.placement.zone, Zone.Floating);

  page.open(APUNTE, { to: Destination.Side });
  assert.equal(store.get().panels.at(-1)!.placement.zone, Zone.Right);
  page.open({ ...FAC, id: "FAC-13" }, { to: Destination.Side });
  assert.equal(
    store.get().panels.at(-1)!.placement.zone,
    Zone.Bottom,
    "the zone the domain prefers",
  );
});

test("`defaultOpen` changes what a plain `open` does", () => {
  const { store, page } = setup({ registry: REGISTRY, defaultOpen: Destination.Peek });
  page.open(FAC);
  assert.ok(store.get().peek !== null);
  assert.equal(store.get().page?.kind, "asientos", "no page was opened");
});

test("opening the page from a peek leaves the peek", () => {
  const { store, factory } = setup();
  store.peek(FAC);
  factory.for(FAC, { surface: Surface.Peek }).open(APUNTE);
  assert.equal(store.get().peek, null);
  assert.equal(store.get().page?.id, "A-1");
});

test("the breadcrumb is the trail plus this page, and a crumb goes back", () => {
  const { store, page } = setup();
  page.open(FAC);
  page.open(APUNTE);

  const crumbs = page.crumbs();
  assert.deepEqual(
    crumbs.map((c) => c.label),
    ["Asientos", "Asiento FAC-12", "Apunte A-1"],
  );
  assert.equal(crumbs.at(-1)!.onClick, undefined, "where I am is not a link");

  crumbs[0]!.onClick!();
  assert.equal(store.get().page?.kind, "asientos");

  page.open(FAC);
  page.back();
  assert.equal(store.get().page?.kind, "asientos");
});

test("outside the page there is no breadcrumb: the frame already says it", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Window });
  const id = store.get().panels[0]!.id;
  assert.deepEqual(factory.for(FAC, { surface: Surface.Panel, panelId: id }).crumbs(), []);
  page.open(PAG, { to: Destination.Peek });
  assert.deepEqual(factory.for(PAG, { surface: Surface.Peek }).crumbs(), []);
});

test("`expand` turns a window or the peek into the page; `close` closes ITS container", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Window });
  const id = store.get().panels[0]!.id;
  const win = factory.for(FAC, { surface: Surface.Panel, panelId: id });

  win.expand();
  assert.equal(store.get().panels.length, 0);
  assert.equal(store.get().page?.id, "FAC-12");

  page.open(PAG, { to: Destination.Peek });
  const peeked = factory.for(PAG, { surface: Surface.Peek });
  peeked.close();
  assert.equal(store.get().peek, null);
  assert.equal(store.get().page?.id, "FAC-12", "closing a peek does not close the page");
});

test("each surface navigates ITS OWN container", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Window });
  const id = store.get().panels[0]!.id;

  factory.for(FAC, { surface: Surface.Panel, panelId: id }).navigate(PAG);
  assert.equal(store.get().panels[0]!.view.id, "PAG-7");
  assert.equal(store.get().page?.kind, "asientos", "the page did not move");
});

test("a surface's API is THE SAME object across calls, and forgets closed panels", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Window });
  const id = store.get().panels[0]!.id;

  const first = factory.for(FAC, { surface: Surface.Panel, panelId: id });
  store.movePanel(id, Zone.Right);
  assert.equal(
    factory.for(FAC, { surface: Surface.Panel, panelId: id }),
    first,
    "moving it keeps identity",
  );
  assert.equal(
    factory.for(PAG, { surface: Surface.Panel, panelId: id }).self,
    PAG,
    "but `self` is up to date",
  );

  store.closePanel(id);
  store.apply((w) => openPanel(w, FAC, Zone.Right));
  assert.notEqual(
    factory.for(FAC, { surface: Surface.Panel, panelId: id }),
    first,
    "a closed panel's API is gone",
  );
});

test("`pick` opens a chooser whose answer closes it", () => {
  const { store, factory, page } = setup();
  const got: string[] = [];

  page.pick(PAG, (v) => got.push(v.id ?? ""));
  const chooser = store.get().panels.at(-1)!;
  assert.equal(chooser.placement.zone, Zone.Floating, "a window by default");

  const inside = factory.for(PAG, { surface: Surface.Panel, panelId: chooser.id });
  inside.answer(FAC);
  assert.deepEqual(got, ["FAC-12"]);
  assert.equal(store.get().panels.length, 0, "answering closes it");

  inside.answer(FAC);
  assert.equal(got.length, 1, "and it answers once");
});

test("`pick` also works from a peek", () => {
  const { store, factory, page } = setup();
  let got = "";
  page.pick(PAG, (v) => (got = v.id ?? ""), { to: Destination.Peek });
  factory.for(PAG, { surface: Surface.Peek }).answer(FAC);
  assert.equal(got, "FAC-12");
  assert.equal(store.get().peek, null);
});

test("a view reads the context and publishes its selection", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Window });
  const id = store.get().panels[0]!.id;
  const win = factory.for(FAC, { surface: Surface.Panel, panelId: id });

  page.select([APUNTE]);
  win.focus();
  assert.equal(win.context.focused()?.id, "FAC-12");
  assert.equal(win.context.selection()[0]?.id, "A-1", "focus moved, the selection stayed");
});

test("the shell mounts the page and every zone at once", () => {
  const { store, factory } = setup();
  let w = store.get();
  for (const [r, z] of [
    [FAC, Zone.Left],
    [PAG, Zone.Right],
    [APUNTE, Zone.Bottom],
    [{ ...FAC, id: "9" }, Zone.Floating],
  ] as const)
    w = openPanel(w, r, z);

  const html = paint(
    createElement(PanelHost, { workspace: w, registry: REGISTRY, store, api: factory }),
  );
  for (const label of ["Asiento FAC-12", "Asiento PAG-7", "Apunte A-1", "Asiento 9"])
    assert.ok(html.includes(label), label);
  assert.equal((html.match(/role="separator"/g) ?? []).length, 3, "one handle per zone");
});

test("an ownerless reference draws as a notice, not a hole", () => {
  const { factory } = setup();
  const resource = { domain: "nobody", kind: "thing" };
  const html = paint(
    createElement(ViewHost, {
      resource,
      registry: REGISTRY,
      api: factory.for(resource, { surface: Surface.Page }),
    }),
  );
  assert.ok(html.includes("Nobody can resolve this reference"));
  assert.ok(
    html.includes("nobody:thing"),
    "with the whole reference, which is what lets you fix it",
  );
});
