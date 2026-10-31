import assert from "node:assert/strict";

import {
  back,
  closePanel,
  closePeek,
  collapsePanel,
  cycleFocus,
  DEFAULT_ZONES,
  drillPeek,
  EMPTY,
  expandPanel,
  floatPanel,
  focusedRef,
  focusPanel,
  formatRef,
  fromHash,
  goTo,
  type Handle,
  handles,
  layout,
  maximize,
  movePanel,
  navigatePanel,
  openPanel,
  PAGE,
  PEEK,
  peek,
  peekBack,
  peekToPage,
  peekToSide,
  push,
  raisePanel,
  replace,
  resizePanel,
  resizeZone,
  resolve,
  restore,
  select,
  selectionOf,
  sizeAt,
  start,
  STRIP,
  toHash,
  type Workspace,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { test } from "vitest";

const ref = (domain: string, kind: string, id?: string) =>
  id === undefined ? { domain, kind } : { domain, kind, id };

const MOVES = ref("contabilidad", "asientos");
const FAC = ref("contabilidad", "asiento", "FAC-12");
const PAG = ref("contabilidad", "asiento", "PAG-7");
const APUNTES = ref("contabilidad", "apuntes");

const fmt = formatRef;
const panelOf = (w: Workspace, i = 0) => w.panels[i]!;

test("1 · a page keeps the way back, and a crumb goes to it", () => {
  let w = push(EMPTY, MOVES);
  assert.deepEqual(w.trail, [], "the first page has nothing behind it");

  w = push(push(w, FAC), APUNTES);
  assert.deepEqual(w.trail.map(fmt), [fmt(MOVES), fmt(FAC)]);
  assert.equal(push(w, APUNTES), w, "the same page changes nothing");

  assert.equal(fmt(back(w).page!), fmt(FAC));
  w = goTo(w, 0);
  assert.equal(fmt(w.page!), fmt(MOVES));
  assert.deepEqual(w.trail, [], "what came after the crumb is dropped");
  assert.equal(back(w), w, "nothing to go back to is not an error");
});

test("2 · opening the same resource twice focuses the panel instead of duplicating it", () => {
  let w = openPanel(push(EMPTY, MOVES), FAC, Zone.Right);
  const id = panelOf(w).id;
  w = openPanel(w, FAC, Zone.Left);

  assert.equal(w.panels.length, 1);
  assert.equal(panelOf(w).placement.zone, Zone.Left, "it moved to the zone asked");
  assert.equal(w.focus, id);

  w = openPanel(w, FAC, { zone: Zone.Right, allowDuplicate: true });
  assert.equal(w.panels.length, 2, "unless a duplicate is asked for");
});

test("3 · the shares of a zone always add up to 1", () => {
  let w = push(EMPTY, MOVES);
  for (const r of [FAC, PAG, APUNTES]) w = openPanel(w, r, Zone.Right);
  const total = w.panels.reduce(
    (sum, p) => sum + (p.placement.zone === Zone.Floating ? 0 : p.placement.share),
    0,
  );
  assert.ok(Math.abs(total - 1) < 1e-9);

  w = closePanel(w, panelOf(w).id);
  const after = w.panels.reduce(
    (sum, p) => sum + (p.placement.zone === Zone.Floating ? 0 : p.placement.share),
    0,
  );
  assert.ok(Math.abs(after - 1) < 1e-9, "closing one gives its room back");
});

test("4 · a zone is clamped, so the workspace never runs out of room", () => {
  const w = openPanel(push(EMPTY, MOVES), FAC, Zone.Right);
  assert.ok(resizeZone(w, Zone.Right, 5).zones.right <= 0.72);
  assert.ok(resizeZone(w, Zone.Right, -5).zones.right >= 0.12);
  assert.equal(resizeZone(w, Zone.Right, w.zones.right), w);
});

test("5 · a window moves anywhere, and resizes", () => {
  let w = openPanel(push(EMPTY, MOVES), FAC, Zone.Floating);
  const id = panelOf(w).id;
  w = floatPanel(w, id, { x: 400, y: 10 });
  w = floatPanel(w, id, { w: 700, h: 300 });
  const p = panelOf(w).placement;
  assert.equal(p.zone, Zone.Floating);
  assert.deepEqual(p.zone === Zone.Floating ? [p.x, p.y, p.w, p.h] : [], [400, 10, 700, 300]);
  assert.equal(
    floatPanel(openPanel(push(EMPTY, MOVES), FAC, Zone.Right), "p1", { x: 1 }).panels[0]!
      .placement.zone,
    Zone.Right,
    "a docked panel ignores it",
  );
});

test("6 · windows are brought to the front", () => {
  let w = push(EMPTY, MOVES);
  w = openPanel(openPanel(w, FAC, Zone.Floating), PAG, Zone.Floating);
  const [a, b] = w.panels;
  const z = (p: typeof a) => (p!.placement.zone === Zone.Floating ? p!.placement.z : 0);
  assert.ok(z(b) > z(a), "the last one opened is above");

  w = raisePanel(w, a!.id);
  assert.ok(z(w.panels[0]) > z(w.panels[1]), "raising puts it above");
  assert.equal(raisePanel(w, a!.id), w, "already on top changes nothing");
});

test("7 · moving a panel does NOT change its place among siblings", () => {
  const w = openPanel(openPanel(push(EMPTY, MOVES), FAC, Zone.Right), PAG, Zone.Bottom);
  const ids = (x: Workspace) =>
    layout(x)
      .map((s) => s.id)
      .sort();
  const moved = movePanel(w, panelOf(w).id, Zone.Left);
  assert.deepEqual(ids(moved), ids(w), "same surfaces, only boxes change");
});

test("8 · maximize hides the rest without dropping it, and closing the maximized restores", () => {
  let w = openPanel(push(EMPTY, MOVES), FAC, Zone.Right);
  const id = panelOf(w).id;
  w = maximize(w, id);

  const slots = layout(w);
  assert.equal(slots.length, 2, "nothing is dropped from the list");
  assert.equal(slots.find((s) => s.id === id)!.visible, true);
  assert.equal(slots.find((s) => s.id === PAGE)!.visible, false);
  assert.deepEqual(handles(w), [], "no handles while maximized");

  assert.equal(maximize(w, id).maximized, null, "calling it again gives it back");
  assert.equal(closePanel(w, id).maximized, null);
  assert.equal(closePanel(w, id).focus, PAGE);
});

test("9 · a collapsed panel is still there and takes no content room", () => {
  const w = collapsePanel(openPanel(push(EMPTY, MOVES), FAC, Zone.Floating), "p1");
  const slot = layout(w).find((s) => s.id === "p1")!;
  assert.equal(slot.collapsed, true);
  assert.deepEqual(
    slot.box.height,
    { fr: 0, px: STRIP },
    "a window shrinks to its title bar",
  );
});

test("10 · focus cycles between the page and the panels, and survives a close", () => {
  let w = openPanel(openPanel(push(EMPTY, MOVES), FAC, Zone.Right), PAG, Zone.Bottom);
  w = focusPanel(w, PAGE);
  w = cycleFocus(w, 1);
  assert.equal(w.focus, "p1");
  assert.equal(cycleFocus(cycleFocus(w, 1), 1).focus, PAGE, "and wraps around");
  assert.equal(focusPanel(w, "nobody"), w, "an unknown surface changes nothing");
  assert.equal(closePanel(w, "p1").focus, PAGE);
});

test("11 · a panel expands into the page, keeping the page it came from", () => {
  let w = openPanel(push(EMPTY, MOVES), FAC, Zone.Floating);
  w = expandPanel(w, "p1");

  assert.equal(w.panels.length, 0, "the panel is gone");
  assert.equal(fmt(w.page!), fmt(FAC));
  assert.equal(fmt(w.trail[0]!), fmt(MOVES), "and the way back is there");
});

test("12 · the peek is one, becomes the page, or docks beside", () => {
  const w = peek(peek(push(EMPTY, MOVES), FAC), PAG);
  assert.equal(fmt(w.peek!), fmt(PAG), "peeking again replaces it");
  assert.equal(closePeek(closePeek(w)).peek, null);

  const asPage = peekToPage(w);
  assert.equal(asPage.peek, null);
  assert.equal(fmt(asPage.page!), fmt(PAG));
  assert.equal(peekToPage(asPage), asPage);

  const asSide = peekToSide(w);
  assert.equal(asSide.peek, null);
  assert.equal(asSide.panels.length, 1);
  assert.equal(fmt(asSide.page!), fmt(MOVES), "the page did not move");
});

test("13 · a panel navigates without dragging the page along", () => {
  const w = navigatePanel(openPanel(push(EMPTY, MOVES), FAC, Zone.Right), "p1", PAG);
  assert.equal(fmt(panelOf(w).view), fmt(PAG));
  assert.equal(fmt(w.page!), fmt(MOVES));
});

test("14 · the context follows the last selection, not the focus", () => {
  let w = openPanel(push(EMPTY, APUNTES), ref("tools", "chat"), Zone.Right);
  const rows = [FAC, PAG];
  w = select(w, PAGE, rows);
  w = focusPanel(w, "p1");

  assert.deepEqual(selectionOf(w).map(fmt), rows.map(fmt), "clicking into the chat keeps it");
  assert.equal(fmt(focusedRef(w)!), "tools:chat", "while the focus is the chat's");
  assert.equal(select(w, PAGE, [...rows]), w, "the same selection changes nothing");
  assert.equal(select(w, "p1", []), w, "clearing someone else's selection changes nothing");

  assert.deepEqual(selectionOf(select(w, PAGE, [])), []);
  assert.deepEqual(selectionOf(push(w, MOVES)), [], "leaving the page drops its selection");
});

test("15 · a handle returns exactly the size that is stored", () => {
  let w = push(EMPTY, MOVES);
  w = openPanel(openPanel(w, FAC, Zone.Right), PAG, Zone.Right);
  w = resizeZone(w, Zone.Right, 0.4);

  const px = 1000;
  const at = (h: Handle) => sizeAt(h, resolve(h.at, px), px);

  const right = handles(w).find((h) => h.kind === "zone" && h.zone === Zone.Right)!;
  assert.ok(Math.abs(at(right) - 0.4) < 1e-9);

  const between = handles(w).find((h) => h.kind === "panel")!;
  const first = panelOf(w).placement;
  assert.ok(first.zone !== Zone.Floating);
  assert.ok(Math.abs(at(between) - first.share) < 1e-9);
});

test("16 · splitting two panels in a zone moves BOTH", () => {
  let w = openPanel(openPanel(push(EMPTY, MOVES), FAC, Zone.Right), PAG, Zone.Right);
  const share = (x: Workspace, i: number) => {
    const p = x.panels[i]!.placement;
    return p.zone === Zone.Floating ? 0 : p.share;
  };
  const before = share(w, 1);
  w = resizePanel(w, "p1", 0.7);
  assert.ok(Math.abs(share(w, 0) - 0.7) < 1e-9);
  assert.ok(share(w, 1) < before, "the neighbour paid for it");
  assert.ok(share(resizePanel(w, "p1", 0.999), 1) >= 0.12, "and never below the minimum");
});

test("17 · the page and every zone fit in one container", () => {
  let w = push(EMPTY, MOVES);
  for (const [r, z] of [
    [FAC, Zone.Left],
    [PAG, Zone.Right],
    [APUNTES, Zone.Bottom],
  ] as const)
    w = openPanel(w, r, z);
  const page = layout(w).find((s) => s.id === PAGE)!;
  const f = DEFAULT_ZONES;
  assert.ok(Math.abs(page.box.width.fr - (1 - f.left - f.right)) < 1e-9);
  assert.ok(Math.abs(page.box.height.fr - (1 - f.bottom)) < 1e-9);
});

test("18 · the workspace fits in the URL and comes back the same", () => {
  let w = push(push(EMPTY, MOVES), FAC);
  w = openPanel(openPanel(w, PAG, Zone.Right), APUNTES, Zone.Floating);
  w = floatPanel(w, "p2", { x: 120.4, y: 33, w: 500, h: 321 });
  w = resizeZone(w, Zone.Right, 0.4);
  w = peek(w, MOVES);

  const back_ = fromHash(toHash(w));
  assert.equal(toHash(back_), toHash(w));
  assert.equal(fmt(back_.page!), fmt(FAC));
  assert.equal(back_.panels.length, 2);
  assert.equal(back_.zones.right, 0.4);
  assert.deepEqual(back_.trail, [], "the way back is session memory, not for a colleague");
});

test("19 · a broken URL loads what is valid and drops the rest", () => {
  assert.equal(fromHash("#/otra-cosa"), EMPTY);
  const w = fromHash(
    "#/w?p=contabilidad%3Aasiento%2FFAC-12&s=p1!%%%!r,1.00;p2!contabilidad:asientos!r,1.00&f=nope&m=nope",
  );
  assert.equal(fmt(w.page!), "contabilidad:asiento/FAC-12");
  assert.equal(w.panels.length, 1, "the invalid panel is gone, the valid one stays");
  assert.equal(w.focus, PAGE);
  assert.equal(w.maximized, null);
  assert.equal(fromHash("#/w?p=%%%").page, null);
});

test("20 · the peek closes when the page becomes ANOTHER resource, not another face of it", () => {
  const open = peek(push(push(EMPTY, MOVES), FAC), PAG);

  assert.equal(push(open, APUNTES).peek, null, "opening another row");
  assert.equal(goTo(open, 0).peek, null, "a crumb");
  assert.equal(back(open).peek, null, "back");
  assert.equal(replace(open, APUNTES).peek, null, "replacing it");
  assert.equal(start(open, APUNTES).peek, null, "starting over from a menu");

  const filtered = replace(open, { ...FAC, params: { tab: "lineas" } });
  assert.equal(fmt(filtered.peek!), fmt(PAG), "a filter or a tab keeps the drawer");
});

test("21 · the peek keeps its own way back; opened from outside it starts fresh", () => {
  let w = peek(push(EMPTY, MOVES), FAC);
  w = drillPeek(drillPeek(w, PAG), APUNTES);
  assert.deepEqual(w.peekTrail.map(fmt), [fmt(FAC), fmt(PAG)]);
  assert.equal(fmt(peekBack(w).peek!), fmt(PAG));
  assert.equal(peek(w, FAC).peekTrail.length, 0, "a new row is a new drawer");
  assert.equal(closePeek(w).peekTrail.length, 0);
});

test("22 · the peek takes the focus and gives it back; without a page it IS the page", () => {
  const w = peek(push(EMPTY, MOVES), FAC);
  assert.equal(w.focus, PEEK);
  assert.equal(fmt(focusedRef(w)!), fmt(FAC), "⌘K acts on what I am reading");
  assert.equal(closePeek(w).focus, PAGE);

  const alone = peek(EMPTY, FAC);
  assert.equal(alone.peek, null, "a drawer over nothing would be invisible");
  assert.equal(fmt(alone.page!), fmt(FAC));
});

test("23 · a minimized panel is a 36 px strip and the open ones share the rest", () => {
  let w = push(EMPTY, MOVES);
  w = openPanel(
    openPanel(openPanel(w, FAC, Zone.Right), PAG, Zone.Right),
    APUNTES,
    Zone.Right,
  );
  w = collapsePanel(w, "p2");
  const h = 900;
  const height = (id: string) => resolve(layout(w).find((s) => s.id === id)!.box.height, h);

  assert.equal(height("p2"), STRIP);
  assert.ok(Math.abs(height("p1") + height("p2") + height("p3") - h) < 1e-6, "no gap");
  assert.ok(
    !handles(w).some((x) => x.kind === "panel"),
    "no handle beside a minimized panel",
  );
});

test("24 · a zone with every panel minimized shrinks to a rail and the page takes the room", () => {
  let w = openPanel(push(EMPTY, MOVES), FAC, Zone.Left);
  w = collapsePanel(w, "p1");
  const width = 1200;
  const slots = layout(w);
  const rail = slots.find((s) => s.id === "p1")!;
  const page = slots.find((s) => s.id === PAGE)!;

  assert.equal(rail.rail, true);
  assert.equal(resolve(rail.box.width, width), STRIP);
  assert.equal(resolve(page.box.width, width), width - STRIP);
  assert.ok(!handles(w).some((x) => x.kind === "zone" && x.zone === Zone.Left), "no handle");

  let b = openPanel(push(EMPTY, MOVES), FAC, Zone.Bottom);
  b = collapsePanel(b, "p1");
  const row = layout(b).find((s) => s.id === "p1")!;
  assert.equal(row.rail, false, "at the bottom it is a row of title bars");
  assert.equal(resolve(row.box.height, 800), STRIP);
});

test("25 · the browser's Back restores the place and keeps the session's memory", () => {
  const list = push(EMPTY, MOVES);
  const record = select(peek(push(list, FAC), PAG), PAGE, [APUNTES]);

  const withMemory = restore(record, fromHash(toHash(list)), { trail: [], peekTrail: [] });
  assert.equal(fmt(withMemory.page!), fmt(MOVES));
  assert.deepEqual(withMemory.trail, []);

  const fromLink = restore(record, fromHash(toHash(list)), null);
  assert.deepEqual(fromLink.trail, [], "a page already in the trail goes back to it");

  const same = restore(record, fromHash(toHash(record)), null);
  assert.deepEqual(same.trail.map(fmt), [fmt(MOVES)], "the trail is not in the URL");
  assert.ok(same.selected !== null, "the selection stays while its page does");
});
