import { type Dock, DOCKS, Zone } from "@sincpro/web-composer/domain/enums";
import { type ResourceRef, sameRef } from "@sincpro/web-composer/domain/resource";

export { DOCKS, Zone };
export type { Dock };

/**
 * One page, and what is open around it.
 *
 * The PAGE is what I am working on — a list, a record — and its `trail` is the way I came, so a
 * breadcrumb can take me back. Around it, any number of PANELS: docked beside it (`Side`) or
 * floating over it (`Window`). A peek is a drawer to read without leaving.
 *
 * The space share lives in TWO places on purpose: `zones` is how much of the container each
 * docked zone takes; `Placement.share` is how much of ITS zone a panel takes. Keeping it all
 * in the panel made the size of the first one mean «the width of the zone» and the size of the
 * rest mean nothing.
 */

export type Placement =
  | { zone: Dock; share: number; collapsed?: boolean }
  | {
      zone: typeof Zone.Floating;
      x: number;
      y: number;
      w: number;
      h: number;
      z: number;
      collapsed?: boolean;
    };

export type Panel = {
  id: string;
  view: ResourceRef;
  placement: Placement;
};

/** How much of the container each docked zone takes. */
export type Zones = Record<Dock, number>;

/** What a selection belongs to, and the references selected. */
export type Selected = { by: string; refs: readonly ResourceRef[] };

export type Workspace = {
  page: ResourceRef | null;
  /** The pages I came through to reach `page`, oldest first. Session memory. */
  trail: readonly ResourceRef[];
  panels: readonly Panel[];
  zones: Zones;
  peek: ResourceRef | null;
  /** `PAGE` or a panel id: who the shortcuts talk to. Not the browser's focus, which lives
   *  inside the view, almost always in a field. */
  focus: string;
  /** A panel id, or `PAGE`. It takes the whole workspace while it lasts. */
  maximized: string | null;
  /** The last selection any surface published. A chat or a detail panel follows THIS, not the
   *  focus: clicking into the chat must not make it lose what it was following. */
  selected: Selected | null;
};

/** The page is not a panel and has no id; it needs one so it can be focused and maximized. */
export const PAGE = "page";

export const DEFAULT_ZONES: Zones = {
  [Zone.Left]: 0.28,
  [Zone.Right]: 0.36,
  [Zone.Bottom]: 0.34,
};

/** Outside these limits one of the two sides stops being usable. */
export const MIN_ZONE = 0.12;
export const MAX_ZONE = 0.72;
export const MIN_SHARE = 0.12;

const WINDOW_BOX = { x: 72, y: 56, w: 480, h: 360 };
const WINDOW_OFFSET = 28;

export const EMPTY: Workspace = {
  page: null,
  trail: [],
  panels: [],
  zones: DEFAULT_ZONES,
  peek: null,
  focus: PAGE,
  maximized: null,
  selected: null,
};

const clampZone = (n: number) => Math.max(MIN_ZONE, Math.min(MAX_ZONE, n));

/** The id comes from the content and not from a global counter, so two identical workspaces
 *  serialize identically. */
function nextId(used: readonly string[]): string {
  let n = 1;
  while (used.includes(`p${n}`)) n += 1;
  return `p${n}`;
}

export const findPanel = (w: Workspace, id: string): Panel | null =>
  w.panels.find((p) => p.id === id) ?? null;

export const panelsIn = (w: Workspace, zone: Zone): readonly Panel[] =>
  w.panels.filter((p) => p.placement.zone === zone);

function withPanel(w: Workspace, id: string, change: (p: Panel) => Panel): Workspace {
  if (!w.panels.some((p) => p.id === id)) return w;
  return { ...w, panels: normalizeAll(w.panels.map((p) => (p.id === id ? change(p) : p))) };
}

/** The shares of a zone are normalized to 1 on every change. Without that, opening a panel
 *  leaves the set summing 1.4 and the resize handle measures against a number that is no
 *  longer the one stored. */
function normalize(panels: readonly Panel[], zone: Dock): readonly Panel[] {
  const inZone = panels.filter((p) => p.placement.zone === zone);
  if (inZone.length === 0) return panels;

  const share = (p: Panel) => (p.placement.zone === Zone.Floating ? 0 : p.placement.share);
  const total = inZone.reduce((sum, p) => sum + share(p), 0);

  return panels.map((p) => {
    if (p.placement.zone !== zone) return p;
    const next = total <= 0 ? 1 / inZone.length : p.placement.share / total;
    return { ...p, placement: { ...p.placement, share: next } };
  });
}

const normalizeAll = (panels: readonly Panel[]): readonly Panel[] =>
  DOCKS.reduce<readonly Panel[]>((acc, zone) => normalize(acc, zone), panels);

function topZ(panels: readonly Panel[]): number {
  return panels.reduce(
    (max, p) => (p.placement.zone === Zone.Floating ? Math.max(max, p.placement.z) : max),
    0,
  );
}

function placementFor(zone: Zone, panels: readonly Panel[]): Placement {
  if (zone !== Zone.Floating) return { zone, share: 1 };

  const floating = panels.filter((p) => p.placement.zone === Zone.Floating).length;
  return {
    zone,
    x: WINDOW_BOX.x + floating * WINDOW_OFFSET,
    y: WINDOW_BOX.y + floating * WINDOW_OFFSET,
    w: WINDOW_BOX.w,
    h: WINDOW_BOX.h,
    z: topZ(panels) + 1,
  };
}

/* ── The page ───────────────────────────────────────────────────────── */

/**
 * Opens `view` as the page and keeps where I was, so the breadcrumb can take me back. The first
 * page has nothing behind it. When there is nothing to change it returns THE SAME object —
 * every reducer here does, and that is what makes it possible to subscribe to a part of the
 * workspace: if every call returned a new one, any action would redraw everything.
 */
export function push(w: Workspace, view: ResourceRef): Workspace {
  if (w.page === null) return { ...w, page: view };
  if (sameRef(w.page, view)) return w;
  return { ...w, page: view, trail: [...w.trail, w.page], selected: dropSelection(w, PAGE) };
}

/** Back to the page at `index` of the trail; the pages after it are dropped. A crumb is this. */
export function goTo(w: Workspace, index: number): Workspace {
  const target = w.trail[index];
  if (target === undefined) return w;
  return {
    ...w,
    page: target,
    trail: w.trail.slice(0, index),
    selected: dropSelection(w, PAGE),
  };
}

/** One page back. Nothing to go back to is not an error: it changes nothing. */
export const back = (w: Workspace): Workspace =>
  w.trail.length === 0 ? w : goTo(w, w.trail.length - 1);

/* ── Panels ─────────────────────────────────────────────────────────── */

export type OpenPanelOptions = {
  zone?: Zone;
  /** Deduplicating is the right default for a column and the wrong one for «the same table
   *  with two filters». */
  allowDuplicate?: boolean;
};

/** Opens a resource as a panel. If it is already open it moves it to the requested zone and
 *  focuses it, unless a duplicate is explicitly asked for. */
export function openPanel(
  w: Workspace,
  view: ResourceRef,
  options: Zone | OpenPanelOptions = {},
): Workspace {
  const opts: OpenPanelOptions = typeof options === "string" ? { zone: options } : options;
  const zone = opts.zone ?? Zone.Right;

  if (opts.allowDuplicate !== true) {
    const existing = w.panels.find((p) => sameRef(p.view, view));
    if (existing) return focusPanel(movePanel(w, existing.id, zone), existing.id);
  }

  const id = nextId(w.panels.map((p) => p.id));
  const panel: Panel = { id, view, placement: placementFor(zone, w.panels) };
  return focusPanel({ ...w, panels: normalizeAll([...w.panels, panel]) }, id);
}

export function movePanel(w: Workspace, id: string, zone: Zone): Workspace {
  const panel = findPanel(w, id);
  if (panel === null || panel.placement.zone === zone) return w;
  return withPanel(w, id, (p) => ({ ...p, placement: placementFor(zone, w.panels) }));
}

/** Closing the maximized or the focused one has to give the rest back, or the workspace ends
 *  up empty with panels inside it. */
export function closePanel(w: Workspace, id: string): Workspace {
  if (findPanel(w, id) === null) return w;
  return {
    ...w,
    panels: normalizeAll(w.panels.filter((p) => p.id !== id)),
    maximized: w.maximized === id ? null : w.maximized,
    focus: w.focus === id ? PAGE : w.focus,
    selected: dropSelection(w, id),
  };
}

/** Changes what a panel looks at without moving or closing it. */
export function navigatePanel(w: Workspace, id: string, view: ResourceRef): Workspace {
  const panel = findPanel(w, id);
  if (panel === null || sameRef(panel.view, view)) return w;
  return { ...withPanel(w, id, (p) => ({ ...p, view })), selected: dropSelection(w, id) };
}

/** How much of the container a docked zone takes. */
export function resizeZone(w: Workspace, zone: Dock, size: number): Workspace {
  const clamped = clampZone(size);
  if (w.zones[zone] === clamped) return w;
  return { ...w, zones: { ...w.zones, [zone]: clamped } };
}

/**
 * How much of ITS zone a panel takes. What it gains it takes from the neighbour below, like
 * any divider between two panels: moving a handle has to affect both sides and nobody else.
 */
export function resizePanel(w: Workspace, id: string, share: number): Workspace {
  const panel = findPanel(w, id);
  if (panel === null || panel.placement.zone === Zone.Floating) return w;

  const zone = panel.placement.zone;
  const neighbors = panelsIn(w, zone);
  const next = neighbors[neighbors.findIndex((p) => p.id === id) + 1];
  if (next === undefined || next.placement.zone === Zone.Floating) return w;

  const together = panel.placement.share + next.placement.share;
  const mine = Math.max(MIN_SHARE, Math.min(together - MIN_SHARE, share));

  return {
    ...w,
    panels: w.panels.map((p) =>
      p.id === id
        ? { ...p, placement: { ...panel.placement, share: mine } }
        : p.id === next.id
          ? { ...p, placement: { ...next.placement, share: together - mine } }
          : p,
    ),
  };
}

export type WindowBox = Partial<{ x: number; y: number; w: number; h: number }>;

/** Moves or resizes a window. */
export function floatPanel(w: Workspace, id: string, box: WindowBox): Workspace {
  return withPanel(w, id, (p) =>
    p.placement.zone === Zone.Floating ? { ...p, placement: { ...p.placement, ...box } } : p,
  );
}

/** Bring to front. Without this, two overlapping windows cannot be pulled apart. */
export function raisePanel(w: Workspace, id: string): Workspace {
  const panel = findPanel(w, id);
  if (panel === null || panel.placement.zone !== Zone.Floating) return w;

  const mine = panel.placement.z;
  const above = w.panels.some(
    (p) => p.id !== id && p.placement.zone === Zone.Floating && p.placement.z >= mine,
  );
  if (!above) return w;
  return withPanel(w, id, (p) =>
    p.placement.zone === Zone.Floating
      ? { ...p, placement: { ...p.placement, z: topZ(w.panels) + 1 } }
      : p,
  );
}

/** Collapse to its header without closing it: still there, still mounted, taking no room. */
export function collapsePanel(w: Workspace, id: string): Workspace {
  return withPanel(w, id, (p) => ({
    ...p,
    placement: { ...p.placement, collapsed: p.placement.collapsed !== true },
  }));
}

/** Take the whole workspace. Calling it on what is already maximized gives it back. */
export function maximize(w: Workspace, target: string | null): Workspace {
  if (target !== null && target !== PAGE && findPanel(w, target) === null) return w;
  return { ...w, maximized: w.maximized === target ? null : target };
}

/** The WORKSPACE focus, which is who the shortcuts talk to. Opening a panel focuses it. */
export function focusPanel(w: Workspace, target: string): Workspace {
  if (w.focus === target) return w;
  if (target !== PAGE && findPanel(w, target) === null) return w;
  return { ...w, focus: target };
}

/** The next one in reading order: the page, then each panel. */
export function cycleFocus(w: Workspace, delta: number): Workspace {
  const order = [PAGE, ...w.panels.map((p) => p.id)];
  const current = Math.max(0, order.indexOf(w.focus));
  const next = order[(current + delta + order.length) % order.length];
  return next === undefined ? w : focusPanel(w, next);
}

/**
 * A panel grows into the page: its resource becomes the page, with the previous page in the
 * breadcrumb, and the panel is gone. «Enlarge» that keeps where you came from.
 */
export function expandPanel(w: Workspace, id: string): Workspace {
  const panel = findPanel(w, id);
  if (panel === null) return w;
  return push(closePanel(w, id), panel.view);
}

/* ── Peek ───────────────────────────────────────────────────────────── */

export function peek(w: Workspace, view: ResourceRef): Workspace {
  if (w.peek !== null && sameRef(w.peek, view)) return w;
  return { ...w, peek: view };
}

export const closePeek = (w: Workspace): Workspace =>
  w.peek === null ? w : { ...w, peek: null };

/** The peek becomes the page. */
export function peekToPage(w: Workspace): Workspace {
  return w.peek === null ? w : closePeek(push(w, w.peek));
}

/** It docks to the right because the drawer was already there and the piece does not move. */
export function peekToSide(w: Workspace, zone: Zone = Zone.Right): Workspace {
  return w.peek === null ? w : closePeek(openPanel(w, w.peek, { zone }));
}

/* ── Context ────────────────────────────────────────────────────────── */

const NO_REFS: readonly ResourceRef[] = [];

function dropSelection(w: Workspace, by: string): Selected | null {
  return w.selected?.by === by ? null : w.selected;
}

/**
 * What a surface has selected — the rows of a list. The workspace keeps only references, so a
 * chat in another domain can read them without knowing what they are. Selecting nothing clears
 * it only if that surface owned it.
 */
export function select(w: Workspace, by: string, refs: readonly ResourceRef[]): Workspace {
  if (refs.length === 0) {
    return w.selected?.by === by ? { ...w, selected: null } : w;
  }
  const current = w.selected;
  if (
    current?.by === by &&
    current.refs.length === refs.length &&
    current.refs.every((r, i) => sameRef(r, refs[i]!))
  )
    return w;
  return { ...w, selected: { by, refs } };
}

/** What the user is working on: the page, or the panel that has the focus. */
export function focusedRef(w: Workspace): ResourceRef | null {
  if (w.focus === PAGE) return w.page;
  return findPanel(w, w.focus)?.view ?? w.page;
}

export const selectionOf = (w: Workspace): readonly ResourceRef[] =>
  w.selected?.refs ?? NO_REFS;
