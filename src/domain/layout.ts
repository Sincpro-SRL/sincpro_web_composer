import {
  Axis,
  BoxUnit,
  type Dock,
  HandleKind,
  Split,
  Zone,
} from "@sincpro/web-composer/domain/enums";
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

export type Box = {
  unit: BoxUnit;
  left: number;
  top: number;
  width: number;
  height: number;
};

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
};

const fraction = (left: number, top: number, width: number, height: number): Box => ({
  unit: BoxUnit.Fraction,
  left,
  top,
  width,
  height,
});

const FULL = fraction(0, 0, 1, 1);

/** Title bar of a window when it is minimized. Matches the header. */
const WINDOW_TITLEBAR = 36;

const extent = (w: Workspace, zone: Dock) =>
  panelsIn(w, zone).length === 0 ? 0 : w.zones[zone];

type Space = { left: number; top: number; width: number; height: number };

function split(panels: readonly Panel[], axis: Split, box: Space): Slot[] {
  let cursor = 0;
  return panels.map((panel) => {
    const share = panel.placement.zone === Zone.Floating ? 0 : panel.placement.share;
    const slotBox =
      axis === Split.Vertical
        ? fraction(box.left, box.top + box.height * cursor, box.width, box.height * share)
        : fraction(box.left + box.width * cursor, box.top, box.width * share, box.height);
    cursor += share;
    return {
      id: panel.id,
      view: panel.view,
      panel,
      box: slotBox,
      floating: false,
      z: 0,
      visible: true,
      collapsed: panel.placement.collapsed === true,
    };
  });
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
              unit: BoxUnit.Pixel,
              left: panel.placement.x,
              top: panel.placement.y,
              width: panel.placement.w,
              height:
                panel.placement.collapsed === true ? WINDOW_TITLEBAR : panel.placement.h,
            },
            floating: true,
            z: panel.placement.z,
            visible: true,
            collapsed: panel.placement.collapsed === true,
          },
        ],
  );
}

/** The fractions of the container the page and each zone take. */
function frame(w: Workspace) {
  const left = extent(w, Zone.Left);
  const right = extent(w, Zone.Right);
  const bottom = extent(w, Zone.Bottom);
  const middle = Math.max(0, 1 - left - right);
  return { left, right, bottom, middle, top: Math.max(0, 1 - bottom) };
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
            box: fraction(f.left, 0, f.middle, f.top),
            floating: false,
            z: 0,
            visible: true,
            collapsed: false,
          },
        ]),
    ...split(panelsIn(w, Zone.Left), Split.Vertical, {
      left: 0,
      top: 0,
      width: f.left,
      height: 1,
    }),
    ...split(panelsIn(w, Zone.Right), Split.Vertical, {
      left: f.left + f.middle,
      top: 0,
      width: f.right,
      height: 1,
    }),
    ...split(panelsIn(w, Zone.Bottom), Split.Horizontal, {
      left: f.left,
      top: f.top,
      width: f.middle,
      height: f.bottom,
    }),
    ...windows(w.panels),
  ];

  if (w.maximized === null || !slots.some((s) => s.id === w.maximized)) return slots;
  return slots.map((slot) =>
    slot.id === w.maximized
      ? { ...slot, box: FULL, floating: false, visible: true, collapsed: false }
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
 * Nested split containers (`react-resizable-panels`) are out: they unmount a panel when it
 * changes zone.
 */
export type Handle =
  | {
      kind: typeof HandleKind.Zone;
      zone: Dock;
      axis: Axis;
      at: number;
      origin: number;
      span: number;
      invert: boolean;
    }
  | {
      kind: typeof HandleKind.Panel;
      panelId: string;
      axis: Axis;
      at: number;
      origin: number;
      span: number;
      invert: boolean;
    };

export function sizeAt(handle: Handle, p: number): number {
  const raw = handle.invert ? handle.origin - p : p - handle.origin;
  return raw / handle.span;
}

export function handles(w: Workspace): readonly Handle[] {
  if (w.maximized !== null) return [];

  const f = frame(w);
  const result: Handle[] = [];
  const left = panelsIn(w, Zone.Left);
  const right = panelsIn(w, Zone.Right);
  const bottom = panelsIn(w, Zone.Bottom);

  if (left.length > 0)
    result.push({
      kind: HandleKind.Zone,
      zone: Zone.Left,
      axis: Axis.X,
      at: f.left,
      origin: 0,
      span: 1,
      invert: false,
    });
  if (right.length > 0)
    result.push({
      kind: HandleKind.Zone,
      zone: Zone.Right,
      axis: Axis.X,
      at: f.left + f.middle,
      origin: 1,
      span: 1,
      invert: true,
    });
  if (bottom.length > 0)
    result.push({
      kind: HandleKind.Zone,
      zone: Zone.Bottom,
      axis: Axis.Y,
      at: f.top,
      origin: 1,
      span: 1,
      invert: true,
    });

  const between = (panels: readonly Panel[], axis: Axis, origin: number, span: number) => {
    let cursor = 0;
    panels.forEach((panel, i) => {
      const share = panel.placement.zone === Zone.Floating ? 0 : panel.placement.share;
      cursor += share;
      if (i < panels.length - 1) {
        result.push({
          kind: HandleKind.Panel,
          panelId: panel.id,
          axis,
          at: origin + span * cursor,
          origin: origin + span * (cursor - share),
          span,
          invert: false,
        });
      }
    });
  };

  between(left, Axis.Y, 0, 1);
  between(right, Axis.Y, 0, 1);
  between(bottom, Axis.X, f.left, f.middle);

  return result;
}

/** How far an arrow key moves a handle. A mouse-only handle leaves the workspace
 *  half-assembled for anyone who does not use a pointer. */
export const KEYBOARD_STEP = 0.02;

export const ZONE_LIMITS = { min: MIN_ZONE, max: MAX_ZONE };
