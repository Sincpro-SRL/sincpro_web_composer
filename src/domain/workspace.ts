import { type Dock, DOCKS, Zone } from "@sincpro/web-composer/domain/enums";
import {
  formatRef,
  type ResourceRef,
  rootRef,
  sameRef,
} from "@sincpro/web-composer/domain/resource";

export { DOCKS, Zone };
export type { Dock };

/**
 * One page, and what is open around it.
 *
 * The PAGE is what I am working on — a list, a record — and its `trail` is the way I came, so a
 * breadcrumb can take me back. Around it, any number of PANELS: docked beside it (`Side`) or
 * floating over it (`Window`). A peek is a drawer to read without leaving, with its own trail of
 * what was drilled inside it.
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

/**
 * A view over ONE surface — the page, the peek or a panel — blocking only it: a question, a
 * chooser, a short form. One per surface: a modal over a modal is the road to simulated windows,
 * so opening another one over the same surface replaces it.
 *
 * It belongs to what its host shows (`over`): when the host shows another resource or goes away
 * the modal is gone, and coming back to that resource does not bring it back.
 */
export type Modal = {
  /** `PAGE`, `PEEK` or a panel id. */
  host: string;
  /** What the host showed when the modal opened — its context (`api.over`). */
  over: ResourceRef;
  view: ResourceRef;
  /** Blur what it covers. Off unless asked: the host is blocked, not hidden. */
  blur: boolean;
  /** The size its view asked for; without it, the modal's own. */
  size?: Size;
};

/** A size a view asks for, in pixels. What does not fit is shrunk to what there is. */
export type Size = { w: number; h: number };

/** What a selection belongs to, and the references selected. */
export type Selected = { by: string; refs: readonly ResourceRef[] };

export type Workspace = {
  page: ResourceRef | null;
  /** The pages I came through to reach `page`, oldest first. Session memory. */
  trail: readonly ResourceRef[];
  panels: readonly Panel[];
  zones: Zones;
  peek: ResourceRef | null;
  /** What I drilled through INSIDE the peek to reach `peek`, oldest first. Session memory. */
  peekTrail: readonly ResourceRef[];
  /** `PAGE`, `PEEK` or a panel id: who the shortcuts talk to. Not the browser's focus, which
   *  lives inside the view, almost always in a field. */
  focus: string;
  /** A panel id, or `PAGE`. It takes the whole workspace while it lasts. */
  maximized: string | null;
  /** The last selection any surface published. A chat or a detail panel follows THIS, not the
   *  focus: clicking into the chat must not make it lose what it was following. */
  selected: Selected | null;
  /** The names views gave their resources once loaded (`api.setTitle`), by `formatRef`. The
   *  crumbs and the frames show them instead of the slug. Session memory, not in the URL. */
  titles: Readonly<Record<string, string>>;
  /** At most one per host. Session memory, not in the URL: a modal is a moment, not a place. */
  modals: readonly Modal[];
};

/** The page is not a panel and has no id; it needs one so it can be focused and maximized. */
export const PAGE = "page";
/** Nor is the peek; it needs one to take the focus and publish a selection. */
export const PEEK = "peek";
/** A modal is known by its host: `modal:page`, `modal:p2`. */
export const MODAL = "modal:";
export const modalId = (host: string): string => `${MODAL}${host}`;
const isModalId = (id: string) => id.startsWith(MODAL);
/** The surface under a modal; any other surface is its own host. */
export const hostOf = (id: string): string => (isModalId(id) ? id.slice(MODAL.length) : id);

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
/** Below this a window's controls overlap; a size asked for is never smaller. */
export const MIN_WINDOW: Size = { w: 280, h: 160 };
const WINDOW_OFFSET = 28;

export const EMPTY: Workspace = {
  page: null,
  trail: [],
  panels: [],
  zones: DEFAULT_ZONES,
  peek: null,
  peekTrail: [],
  focus: PAGE,
  maximized: null,
  selected: null,
  titles: {},
  modals: [],
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

/** What a surface shows now — the page, the peek, a panel or a modal — or `null` if it is not
 *  there. */
export function refOn(w: Workspace, surface: string): ResourceRef | null {
  if (surface === PAGE) return w.page;
  if (surface === PEEK) return w.peek;
  if (isModalId(surface)) return modalOver(w, hostOf(surface))?.view ?? null;
  return findPanel(w, surface)?.view ?? null;
}

/** The modal over `host`, while its host still shows what it was opened over. */
export function modalOver(w: Workspace, host: string): Modal | null {
  const modal = w.modals.find((m) => m.host === host);
  if (modal === undefined) return null;
  const shown = refOn(w, host);
  return shown !== null && sameRef(rootRef(shown), rootRef(modal.over)) ? modal : null;
}

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

function placementFor(zone: Zone, panels: readonly Panel[], size?: Size): Placement {
  if (zone !== Zone.Floating) return { zone, share: 1 };

  const floating = panels.filter((p) => p.placement.zone === Zone.Floating).length;
  return {
    zone,
    x: WINDOW_BOX.x + floating * WINDOW_OFFSET,
    y: WINDOW_BOX.y + floating * WINDOW_OFFSET,
    w: Math.max(MIN_WINDOW.w, size?.w ?? WINDOW_BOX.w),
    h: Math.max(MIN_WINDOW.h, size?.h ?? WINDOW_BOX.h),
    z: topZ(panels) + 1,
  };
}

/* ── The page ───────────────────────────────────────────────────────── */

/**
 * The peek is a drawer over THIS page. When the page becomes another resource the drawer would
 * float over something that is no longer there, so it closes; another face of the same one —
 * only `params` change: a filter, a tab — keeps it.
 */
function leavePage(w: Workspace, next: Workspace): Workspace {
  const stays =
    w.page !== null && next.page !== null && sameRef(rootRef(w.page), rootRef(next.page));
  return stays ? next : closePeek(next);
}

/**
 * Opens `view` as the page and keeps where I was, so the breadcrumb can take me back. The first
 * page has nothing behind it. When there is nothing to change it returns THE SAME object —
 * every reducer here does, and that is what makes it possible to subscribe to a part of the
 * workspace: if every call returned a new one, any action would redraw everything.
 */
export function push(w: Workspace, view: ResourceRef): Workspace {
  if (w.page === null) return { ...w, page: view };
  if (sameRef(w.page, view)) return w;
  return leavePage(w, {
    ...w,
    page: view,
    trail: [...w.trail, w.page],
    selected: dropSelection(w, PAGE),
  });
}

/** Puts `view` where the page is WITHOUT a crumb: a filter that changed, or the record a form
 *  just created — the form should not stay in the way back. */
export function replace(w: Workspace, view: ResourceRef): Workspace {
  if (w.page === null) return { ...w, page: view };
  if (sameRef(w.page, view)) return w;
  return leavePage(w, { ...w, page: view, selected: dropSelection(w, PAGE) });
}

/** Starting over, from a menu: `view` is the page and the way back starts with it. The panels
 *  stay — they are how the person arranged the desk, not where they were. */
export function start(w: Workspace, view: ResourceRef): Workspace {
  if (w.page !== null && sameRef(w.page, view) && w.trail.length === 0 && w.peek === null)
    return w;
  return closePeek({ ...w, page: view, trail: [], selected: dropSelection(w, PAGE) });
}

/** Back to the page at `index` of the trail; the pages after it are dropped. A crumb is this. */
export function goTo(w: Workspace, index: number): Workspace {
  const target = w.trail[index];
  if (target === undefined) return w;
  return leavePage(w, {
    ...w,
    page: target,
    trail: w.trail.slice(0, index),
    selected: dropSelection(w, PAGE),
  });
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
  /** A window only: the size it opens at — and the size an open one takes when asked again. */
  size?: Size;
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
    if (existing) {
      const moved = movePanel(w, existing.id, zone);
      const sized =
        opts.size === undefined || zone !== Zone.Floating
          ? moved
          : floatPanel(moved, existing.id, {
              w: Math.max(MIN_WINDOW.w, opts.size.w),
              h: Math.max(MIN_WINDOW.h, opts.size.h),
            });
      return focusPanel(sized, existing.id);
    }
  }

  const id = nextId(w.panels.map((p) => p.id));
  const panel: Panel = { id, view, placement: placementFor(zone, w.panels, opts.size) };
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
  return settleModals({
    ...w,
    panels: normalizeAll(w.panels.filter((p) => p.id !== id)),
    maximized: w.maximized === id ? null : w.maximized,
    focus: w.focus === id ? PAGE : w.focus,
    selected: dropSelection(w, id),
  });
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

/** Take the whole workspace. Calling it on what is already maximized gives it back. The peek is
 *  a drawer: it grows into the page instead (`peekToPage`). */
export function maximize(w: Workspace, target: string | null): Workspace {
  if (target === PEEK) return w;
  if (target !== null && target !== PAGE && findPanel(w, target) === null) return w;
  return { ...w, maximized: w.maximized === target ? null : target };
}

/** The WORKSPACE focus, which is who the shortcuts talk to. Opening a panel focuses it. */
export function focusPanel(w: Workspace, target: string): Workspace {
  if (w.focus === target) return w;
  if (refOn(w, target) === null) return w;
  return { ...w, focus: target };
}

/** The next one in reading order: the page, the peek over it, then each panel. */
export function cycleFocus(w: Workspace, delta: number): Workspace {
  const order = [PAGE, ...(w.peek === null ? [] : [PEEK]), ...w.panels.map((p) => p.id)];
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

/**
 * Opened from outside — a row, ⌘K — the drawer starts fresh: its trail is only of what was
 * drilled INSIDE it. It takes the focus, so ⌘K acts on what I am reading. Without a page there
 * is nothing to read beside, so it becomes the page.
 */
export function peek(w: Workspace, view: ResourceRef): Workspace {
  if (w.page === null) return push(w, view);
  if (w.peek !== null && sameRef(w.peek, view) && w.peekTrail.length === 0) return w;
  return { ...w, peek: view, peekTrail: [], focus: PEEK, selected: dropSelection(w, PEEK) };
}

/** From inside the drawer: what it shows now goes to its trail, so ← comes back to it. */
export function drillPeek(w: Workspace, view: ResourceRef): Workspace {
  if (w.peek === null) return peek(w, view);
  if (sameRef(w.peek, view)) return w;
  return {
    ...w,
    peek: view,
    peekTrail: [...w.peekTrail, w.peek],
    selected: dropSelection(w, PEEK),
  };
}

/** Another face, or the record a form in the drawer just created: no step in its trail. */
export function replacePeek(w: Workspace, view: ResourceRef): Workspace {
  if (w.peek === null) return peek(w, view);
  if (sameRef(w.peek, view)) return w;
  return { ...w, peek: view, selected: dropSelection(w, PEEK) };
}

/** Back to the step at `index` of the drawer's trail. */
export function peekGoTo(w: Workspace, index: number): Workspace {
  const target = w.peekTrail[index];
  if (target === undefined) return w;
  return {
    ...w,
    peek: target,
    peekTrail: w.peekTrail.slice(0, index),
    selected: dropSelection(w, PEEK),
  };
}

export const peekBack = (w: Workspace): Workspace =>
  w.peekTrail.length === 0 ? w : peekGoTo(w, w.peekTrail.length - 1);

export function closePeek(w: Workspace): Workspace {
  if (w.peek === null) return w;
  return {
    ...w,
    peek: null,
    peekTrail: [],
    focus: w.focus === PEEK ? PAGE : w.focus,
    selected: dropSelection(w, PEEK),
  };
}

/** The peek becomes the page. */
export function peekToPage(w: Workspace): Workspace {
  return w.peek === null ? w : closePeek(push(w, w.peek));
}

/** It docks to the right because the drawer was already there and the piece does not move. */
export function peekToSide(w: Workspace, zone: Zone = Zone.Right): Workspace {
  return w.peek === null ? w : closePeek(openPanel(w, w.peek, { zone }));
}

/* ── Modals ─────────────────────────────────────────────────────────── */

export type OpenModalOptions = { blur?: boolean; size?: Size };

/**
 * `view` over `host`, which keeps its place and its state underneath. Asked from inside a
 * modal, it replaces that one: same host, no stacking. It takes the focus, so the shortcuts and
 * ⌘K talk to it.
 */
export function openModal(
  w: Workspace,
  host: string,
  view: ResourceRef,
  { blur = false, size }: OpenModalOptions = {},
): Workspace {
  const under = hostOf(host);
  const over = refOn(w, under);
  if (over === null) return w;

  const id = modalId(under);
  const current = modalOver(w, under);
  if (
    current !== null &&
    sameRef(current.view, view) &&
    current.blur === blur &&
    current.size?.w === size?.w &&
    current.size?.h === size?.h
  )
    return focusPanel(w, id);

  const modals = [
    ...w.modals.filter((m) => m.host !== under && modalOver(w, m.host) !== null),
    { host: under, over, view, blur, ...(size === undefined ? {} : { size }) },
  ];
  return { ...w, modals, focus: id, selected: dropSelection(w, id) };
}

/** Closes the modal over `host` (or the modal itself, by its id). The focus goes back to the
 *  surface it covered. */
export function closeModal(w: Workspace, host: string): Workspace {
  const under = hostOf(host);
  if (!w.modals.some((m) => m.host === under)) return w;
  const id = modalId(under);
  return {
    ...w,
    modals: w.modals.filter((m) => m.host !== under),
    focus: w.focus === id ? (refOn(w, under) === null ? PAGE : under) : w.focus,
    selected: dropSelection(w, id),
  };
}

/**
 * Forgets every modal whose host no longer shows what it was opened over. Without it a modal
 * left behind would come back with its record — open a record, open a modal, go to another
 * page and back, and the question would be asked again. The store runs it after every change.
 */
export function settleModals(w: Workspace): Workspace {
  const gone = w.modals.filter((m) => modalOver(w, m.host) === null);
  if (gone.length === 0) return w;
  return gone.reduce((acc, m) => closeModal(acc, m.host), w);
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

/** What the user is working on: the page, the peek or the panel that has the focus. */
export function focusedRef(w: Workspace): ResourceRef | null {
  return refOn(w, w.focus) ?? w.page;
}

/** Every resource the workspace shows or can go back to. */
const reachable = (w: Workspace): readonly ResourceRef[] => [
  ...w.trail,
  ...(w.page === null ? [] : [w.page]),
  ...w.peekTrail,
  ...(w.peek === null ? [] : [w.peek]),
  ...w.panels.map((p) => p.view),
  ...w.modals.map((m) => m.view),
];

/**
 * The name a view gives its resource once it has loaded it — «Acme S.R.L.» instead of
 * `acme`. `null` gives the `ViewSpec` title back. Names of what is no longer reachable are
 * forgotten on the way, so the map does not grow with the session.
 */
export function nameRef(w: Workspace, ref: ResourceRef, title: string | null): Workspace {
  const key = formatRef(ref);
  if ((w.titles[key] ?? null) === title) return w;

  const alive = new Set(reachable(w).map(formatRef));
  const titles: Record<string, string> = {};
  for (const [k, v] of Object.entries(w.titles)) if (k !== key && alive.has(k)) titles[k] = v;
  if (title !== null) titles[key] = title;
  return { ...w, titles };
}

export const nameOf = (w: Workspace, ref: ResourceRef): string | null =>
  w.titles[formatRef(ref)] ?? null;

export const selectionOf = (w: Workspace): readonly ResourceRef[] =>
  w.selected?.refs ?? NO_REFS;
