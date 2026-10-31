import assert from "node:assert/strict";

import {
  Composer,
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
  PEEK,
  push,
  Surface,
  type ViewSpec,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

const ASIENTOS = { domain: "contabilidad", kind: "asientos" };
const FAC = { domain: "contabilidad", kind: "asiento", id: "FAC-12" };
const PAG = { domain: "contabilidad", kind: "asiento", id: "PAG-7" };
const APUNTE = { domain: "contabilidad", kind: "apunte", id: "A-1" };
const NUEVO = { domain: "contabilidad", kind: "nuevo" };

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
  { domain: "contabilidad", kind: "nuevo", title: () => "Nuevo", load: async () => View },
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

test("inside the peek a click drills IN the drawer; only the page, asked by name, leaves it", () => {
  const { store, factory } = setup();
  store.peek(FAC);
  factory.for(FAC, { surface: Surface.Peek }).open(APUNTE);
  assert.equal(store.get().peek?.id, "A-1", "reading does not throw the reader out");
  assert.equal(store.get().page?.kind, "asientos");

  factory.for(APUNTE, { surface: Surface.Peek }).back();
  assert.equal(store.get().peek?.id, "FAC-12", "and ← comes back");

  factory.for(FAC, { surface: Surface.Peek }).open(APUNTE, { to: Destination.Page });
  assert.equal(store.get().peek, null, "the drawer sat over a page that is gone");
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

test("a panel has no breadcrumb; the peek's crumbs leave the drawer or step back in it", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Window });
  const id = store.get().panels[0]!.id;
  assert.deepEqual(factory.for(FAC, { surface: Surface.Panel, panelId: id }).crumbs(), []);

  page.open(PAG, { to: Destination.Peek });
  factory.for(PAG, { surface: Surface.Peek }).navigate(APUNTE);
  const crumbs = factory.for(APUNTE, { surface: Surface.Peek }).crumbs();
  assert.deepEqual(
    crumbs.map((c) => c.label),
    ["Asientos", "Asiento PAG-7", "Apunte A-1"],
  );

  crumbs[1]!.onClick!();
  assert.equal(store.get().peek?.id, "PAG-7", "a step of the drawer stays in it");
  factory.for(PAG, { surface: Surface.Peek }).crumbs()[0]!.onClick!();
  assert.equal(store.get().peek, null, "the page's crumb leaves it");
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

test("`replace` and `setParams` change the page without a crumb", () => {
  const { store, factory, page } = setup();
  page.setParams({ tipo: "factura" });
  assert.equal(store.get().page?.params?.["tipo"], "factura");
  assert.equal(store.get().trail.length, 0, "a filter is not a step back");

  page.open(NUEVO);
  factory.for(NUEVO, { surface: Surface.Page }).replace(FAC);
  assert.equal(store.get().page?.id, "FAC-12");
  assert.deepEqual(
    store.get().trail.map((r) => r.kind),
    ["asientos"],
    "the form the record replaced is not in the way back",
  );
});

test("a name given by a view shows in the crumbs, and a late one is ignored", () => {
  const { store, factory, page } = setup();
  page.open(FAC);
  const fac = factory.for(FAC, { surface: Surface.Page });
  fac.setTitle("Factura Acme");
  page.open(PAG);
  fac.setTitle("too late");

  const labels = factory
    .for(PAG, { surface: Surface.Page })
    .crumbs()
    .map((c) => c.label);
  assert.deepEqual(labels, ["Asientos", "Factura Acme", "Asiento PAG-7"]);
  assert.equal(store.get().titles["contabilidad:asiento/PAG-7"], undefined);
});

test("`close` on the page goes back: «Cancel» is one call wherever the form is", () => {
  const { store, factory, page } = setup();
  page.open(NUEVO);
  factory.for(NUEVO, { surface: Surface.Page }).close();
  assert.equal(store.get().page?.kind, "asientos");
});

test("from the peek, the selection and ⌘K's subject are the peek's, not the page's", () => {
  const { store, factory, page } = setup();
  page.open(FAC, { to: Destination.Peek });
  factory.for(FAC, { surface: Surface.Peek }).select([APUNTE]);

  assert.equal(store.get().selected?.by, PEEK);
  assert.equal(page.context.focused()?.id, "FAC-12", "what I am reading");
  store.closePeek();
  assert.equal(store.get().selected, null, "and it goes with the drawer");
  assert.equal(page.context.focused()?.kind, "asientos");
});

test("the design is the app's: a skin replaces icons and pieces, the rest stays default", () => {
  const nobody = { domain: "nobody", kind: "thing" };
  const store = createWorkspaceStore({
    initial: openPanel(push(EMPTY, nobody), FAC, Zone.Right),
  });
  const html = paint(
    createElement(Composer, {
      workspace: store,
      registry: REGISTRY,
      skin: {
        icons: { close: () => createElement("i", null, "my-close") },
        Notice: ({ heading }) => createElement("mark", null, `my-notice: ${heading}`),
        styles: false,
      },
    }),
  );
  assert.ok(html.includes("my-close"), "an icon of the app");
  assert.ok(
    html.includes("my-notice: Nobody can resolve this reference"),
    "a piece of the app",
  );
  assert.ok(html.includes('aria-label="Minimize"'), "what was not passed keeps the default");
  assert.ok(!html.includes("sincpro-web-composer"), "and without the default sheet");
});
