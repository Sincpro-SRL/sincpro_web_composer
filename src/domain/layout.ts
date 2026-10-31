import { Axis, type Dock, HandleKind, Zone } from "@sincpro/web-composer/domain/enums";
import type { ResourceRef } from "@sincpro/web-composer/domain/resource";
import {
  MAX_ZONE,
  MIN_ZONE,
  PAGE,
  type Panel,
  panelsIn,
  type Workspace,
} from "@sincpro/web-composer/domain/workspace";

/**
 * Geometry is a pure function, not a nested `<div>` tree: moving a panel must not unmount it.
 * Every panel is a sibling on one layer; only its box changes, so React keeps the node — scroll,
 * filters, and typed input included.
 *
 *     ┌──────────┬───────────────────┬──────────┐
 *     │          │                   │          │   ┌────────┐
 *     │   left   │       page        │  right   │   │ window │
 *     │          ├───────────────────┤          │   └────────┘
 *     │          │  bottom           │          │
 *     └──────────┴───────────────────┴──────────┘
 */

/**
 * A fraction of the container plus pixels — `calc(fr·100% + px)`. A minimized panel is a fixed
 * strip while its neighbours are still a share, and neither unit alone can say «the zone minus
 * two headers».
 */
export type Length = { fr: number; px: number };

export type Box = { left: Length; top: Length; width: Length; height: Length };

export type Slot = {
  /** `PAGE` for the page; the panel id for everything else. */
  id: string;
  view: ResourceRef;
  panel: Panel | null;
  box: Box;
  floating: boolean;
  /** Stacking of windows. 0 for docked slots. */
  z: number;
  /** Maximized hides the rest instead of dropping them from the list, so React does not
   *  unmount them. */
  visible: boolean;
  collapsed: boolean;
  /** Minimized into a strip that is NARROW, not short: a left or right zone with every panel
   *  minimized, or one minimized among open ones at the bottom. Its title reads vertically. */
  rail: boolean;
};

const len = (fr: number, px = 0): Length => ({ fr, px });
const plus = (a: Length, b: Length): Length => len(a.fr + b.fr, a.px + b.px);
const times = (a: Length, k: number): Length => len(a.fr * k, a.px * k);

/** A length measured on a container `size` pixels long. */
export const resolve = (l: Length, size: number): number => l.fr * size + l.px;

const ZERO = len(0);
const FULL: Box = { left: ZERO, top: ZERO, width: len(1), height: len(1) };

/** What a minimized panel keeps: its title bar. It matches the frame's header. */
export const STRIP = 36;

const isCollapsed = (p: Panel) => p.placement.collapsed === true;
const shareOf = (p: Panel) => (p.placement.zone === Zone.Floating ? 0 : p.placement.share);
const allCollapsed = (panels: readonly Panel[]) =>
  panels.length > 0 && panels.every(isCollapsed);

/** A zone with every panel minimized shrinks to one strip: the page takes the room back. */
function extent(w: Workspace, zone: Dock): Length {
  const panels = panelsIn(w, zone);
  if (panels.length === 0) return ZERO;
  return allCollapsed(panels) ? len(0, STRIP) : len(w.zones[zone]);
}

/** The lengths the page and each zone take of the container. */
function frame(w: Workspace) {
  const left = extent(w, Zone.Left);
  const right = extent(w, Zone.Right);
  const bottom = extent(w, Zone.Bottom);
  const middle = len(Math.max(0, 1 - left.fr - right.fr), -(left.px + right.px));
  return { left, right, bottom, middle, top: len(1 - bottom.fr, -bottom.px) };
}

/** A zone stacks top to bottom; the bottom one lays its panels side by side. */
const stacks = (zone: Dock) => zone !== Zone.Bottom;

type Piece = { panel: Panel; start: Length; size: Length };

/**
 * Along the zone, a minimized panel is a fixed strip and the open ones share the rest, each in
 * proportion to its share among the OPEN ones — so restoring one gives back the size it had.
 * `unit` is the length a share of 1 takes, what a handle between two of them measures against.
 */
function pieces(panels: readonly Panel[], along: Length): { list: Piece[]; unit: Length } {
  const strips = panels.filter(isCollapsed).length;
  const all = strips === panels.length;
  const open = panels.reduce((sum, p) => (isCollapsed(p) ? sum : sum + shareOf(p)), 0);
  const unit = open <= 0 ? ZERO : times(plus(along, len(0, -strips * STRIP)), 1 / open);

  let cursor = ZERO;
  const list = panels.map((panel) => {
    const size = all
      ? times(along, 1 / panels.length)
      : isCollapsed(panel)
        ? len(0, STRIP)
        : times(unit, shareOf(panel));
    const piece = { panel, start: cursor, size };
    cursor = plus(cursor, size);
    return piece;
  });
  return { list, unit };
}

function zoneSpace(f: ReturnType<typeof frame>, zone: Dock): Box {
  if (zone === Zone.Left) return { left: ZERO, top: ZERO, width: f.left, height: len(1) };
  if (zone === Zone.Right)
    return { left: plus(f.left, f.middle), top: ZERO, width: f.right, height: len(1) };
  return { left: f.left, top: f.top, width: f.middle, height: f.bottom };
}

function docked(w: Workspace, f: ReturnType<typeof frame>, zone: Dock): Slot[] {
  const panels = panelsIn(w, zone);
  const space = zoneSpace(f, zone);
  const vertical = stacks(zone);
  const all = allCollapsed(panels);

  return pieces(panels, vertical ? space.height : space.width).list.map(
    ({ panel, start, size }) => ({
      id: panel.id,
      view: panel.view,
      panel,
      box: vertical
        ? { left: space.left, top: plus(space.top, start), width: space.width, height: size }
        : {
            left: plus(space.left, start),
            top: space.top,
            width: size,
            height: space.height,
          },
      floating: false,
      z: 0,
      visible: true,
      collapsed: isCollapsed(panel),
      rail: isCollapsed(panel) && (vertical ? all : !all),
    }),
  );
}

function windows(panels: readonly Panel[]): Slot[] {
  return panels.flatMap((panel) =>
    panel.placement.zone !== Zone.Floating
      ? []
      : [
          {
            id: panel.id,
            view: panel.view,
            panel,
            box: {
              left: len(0, panel.placement.x),
              top: len(0, panel.placement.y),
              width: len(0, panel.placement.w),
              height: len(0, isCollapsed(panel) ? STRIP : panel.placement.h),
            },
            floating: true,
            z: panel.placement.z,
            visible: true,
            collapsed: isCollapsed(panel),
            rail: false,
          },
        ],
  );
}

export function layout(w: Workspace): readonly Slot[] {
  const f = frame(w);
  const slots: Slot[] = [
    ...(w.page === null
      ? []
      : [
          {
            id: PAGE,
            view: w.page,
            panel: null,
            box: { left: f.left, top: ZERO, width: f.middle, height: f.top },
            floating: false,
            z: 0,
            visible: true,
            collapsed: false,
            rail: false,
          },
        ]),
    ...docked(w, f, Zone.Left),
    ...docked(w, f, Zone.Right),
    ...docked(w, f, Zone.Bottom),
    ...windows(w.panels),
  ];

  if (w.maximized === null || !slots.some((s) => s.id === w.maximized)) return slots;
  return slots.map((slot) =>
    slot.id === w.maximized
      ? { ...slot, box: FULL, floating: false, visible: true, collapsed: false, rail: false }
      : { ...slot, visible: false },
  );
}

/** Sorted by id so sibling order does not change when a panel changes zone — reordering
 *  siblings is what unmounts. */
export function stableOrder(slots: readonly Slot[]): readonly Slot[] {
  return [...slots].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * A resize handle. Two kinds, two mutations:
 *
 *   `zone`   the edge between a zone and the page. Mutates `Workspace.zones`.
 *   `panel`  the edge between two panels in the SAME zone. What one gains, the neighbour loses.
 *
 * A zone shrunk to its strip has no handle, and neither does the edge of a minimized panel:
 * there is nothing to resize until it is restored.
 *
 * Nested split containers (`react-resizable-panels`) are out: they unmount a panel when it
 * changes zone.
 */
type Measure = { axis: Axis; at: Length; origin: Length; span: Length; invert: boolean };

export type Handle =
  | ({ kind: typeof HandleKind.Zone; zone: Dock } & Measure)
  | ({ kind: typeof HandleKind.Panel; panelId: string } & Measure);

/** The stored size a pointer `p` pixels into a container `size` pixels long asks for. */
export function sizeAt(handle: Handle, p: number, size: number): number {
  const origin = resolve(handle.origin, size);
  const span = resolve(handle.span, size);
  if (span <= 0) return 0;
  return (handle.invert ? origin - p : p - origin) / span;
}

export function handles(w: Workspace): readonly Handle[] {
  if (w.maximized !== null) return [];

  const f = frame(w);
  const result: Handle[] = [];
  const resizable = (zone: Dock) => {
    const panels = panelsIn(w, zone);
    return panels.length > 0 && !allCollapsed(panels);
  };

  if (resizable(Zone.Left))
    result.push({
      kind: HandleKind.Zone,
      zone: Zone.Left,
      axis: Axis.X,
      at: f.left,
      origin: ZERO,
      span: len(1),
      invert: false,
    });
  if (resizable(Zone.Right))
    result.push({
      kind: HandleKind.Zone,
      zone: Zone.Right,
      axis: Axis.X,
      at: plus(f.left, f.middle),
      origin: len(1),
      span: len(1),
      invert: true,
    });
  if (resizable(Zone.Bottom))
    result.push({
      kind: HandleKind.Zone,
      zone: Zone.Bottom,
      axis: Axis.Y,
      at: f.top,
      origin: len(1),
      span: len(1),
      invert: true,
    });

  for (const zone of [Zone.Left, Zone.Right, Zone.Bottom] as const) {
    if (!resizable(zone)) continue;
    const space = zoneSpace(f, zone);
    const vertical = stacks(zone);
    const base = vertical ? space.top : space.left;
    const { list, unit } = pieces(panelsIn(w, zone), vertical ? space.height : space.width);

    list.forEach((piece, i) => {
      const next = list[i + 1];
      if (next === undefined || isCollapsed(piece.panel) || isCollapsed(next.panel)) return;
      result.push({
        kind: HandleKind.Panel,
        panelId: piece.panel.id,
        axis: vertical ? Axis.Y : Axis.X,
        at: plus(base, next.start),
        origin: plus(base, piece.start),
        span: unit,
        invert: false,
      });
    });
  }

  return result;
}

/** How far an arrow key moves a handle. A mouse-only handle leaves the workspace
 *  half-assembled for anyone who does not use a pointer. */
export const KEYBOARD_STEP = 0.02;

export const ZONE_LIMITS = { min: MIN_ZONE, max: MAX_ZONE };
