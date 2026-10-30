/**
 * Closed vocabularies of the composer. Call sites use `Zone.Right`, never a raw `"right"` — a
 * typo then fails at compile time instead of at runtime.
 */

export const Zone = {
  Left: "left",
  Right: "right",
  Bottom: "bottom",
  Floating: "floating",
} as const;

export type Zone = (typeof Zone)[keyof typeof Zone];

export type Dock = Exclude<Zone, typeof Zone.Floating>;

export const DOCKS: readonly Dock[] = [Zone.Left, Zone.Right, Zone.Bottom];

/**
 * Where a resource opens. `Page` is the default — what people expect of a click on a record —
 * and every other destination is one gesture away, never the only way.
 *
 *   Page    the main page of the workspace; the breadcrumb keeps the way back
 *   Peek    a drawer to read without leaving the place
 *   Window  floating: it moves anywhere, resizes, and can grow into the page
 *   Side    docked beside the page, resizable
 */
export const Destination = {
  Page: "page",
  Peek: "peek",
  Window: "window",
  Side: "side",
} as const;

export type Destination = (typeof Destination)[keyof typeof Destination];

/** What a view is drawn in. A view does not change shape by surface — density does — but it
 *  needs to know which actions to offer. */
export const Surface = {
  Page: "page",
  Panel: "panel",
  Peek: "peek",
} as const;

export type Surface = (typeof Surface)[keyof typeof Surface];

export const BoxUnit = {
  Fraction: "fraction",
  Pixel: "pixel",
} as const;

export type BoxUnit = (typeof BoxUnit)[keyof typeof BoxUnit];

export const HandleKind = {
  Zone: "zone",
  Panel: "panel",
} as const;

export type HandleKind = (typeof HandleKind)[keyof typeof HandleKind];

export const Axis = {
  X: "x",
  Y: "y",
} as const;

export type Axis = (typeof Axis)[keyof typeof Axis];

export const Split = {
  Vertical: "vertical",
  Horizontal: "horizontal",
} as const;

export type Split = (typeof Split)[keyof typeof Split];

export const DragKind = {
  /** A docked panel dragged by its header, to be dropped on another edge. */
  Panel: "panel",
  /** A reference dragged out of a row or a field, to be dropped on an edge. */
  Ref: "ref",
  Zone: "zone",
} as const;

export type DragKind = (typeof DragKind)[keyof typeof DragKind];
