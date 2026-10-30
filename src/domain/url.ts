import { type Dock, DOCKS, Zone } from "@sincpro/web-composer/domain/enums";
import { formatRef, parseRef } from "@sincpro/web-composer/domain/resource";
import {
  DEFAULT_ZONES,
  EMPTY,
  PAGE,
  type Panel,
  type Placement,
  type Workspace,
  type Zones,
} from "@sincpro/web-composer/domain/workspace";

/**
 * The URL carries what is worth sending a colleague so they see the same workspace — the page,
 * the panels, the sizes — not the trail, the selection or what was typed.
 *
 * Separators are characters a reference cannot contain, because `formatRef` percent-encodes
 * them: `;` between panels, `!` between a panel's fields, `,` inside a placement. The panel
 * separator cannot be `+`: `URLSearchParams` decodes it as a space.
 */

const FLAG: Record<Dock, string> = {
  [Zone.Left]: "l",
  [Zone.Right]: "r",
  [Zone.Bottom]: "b",
};

const ZONE: Record<string, Dock> = { l: Zone.Left, r: Zone.Right, b: Zone.Bottom };

const n2 = (n: number) => n.toFixed(2);

function packPlacement(placement: Placement): string {
  const collapsed = placement.collapsed === true ? ",c" : "";
  if (placement.zone === Zone.Floating) {
    const { x, y, w, h, z } = placement;
    return `f,${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)},${z}${collapsed}`;
  }
  return `${FLAG[placement.zone]},${n2(placement.share)}${collapsed}`;
}

function unpackPlacement(text: string): Placement | null {
  const [flag, ...rest] = text.split(",");

  if (flag === "f") {
    const [x, y, w, h, z] = rest.map(Number);
    if ([x, y, w, h].some((v) => v === undefined || Number.isNaN(v))) return null;
    return {
      zone: Zone.Floating,
      x: x!,
      y: y!,
      w: w!,
      h: h!,
      z: z === undefined || Number.isNaN(z) ? 1 : z,
      ...(rest.includes("c") ? { collapsed: true } : {}),
    };
  }

  const zone = flag === undefined ? undefined : ZONE[flag];
  const share = Number(rest[0]);
  if (zone === undefined || rest[0] === undefined || Number.isNaN(share)) return null;
  return rest.includes("c") ? { zone, share, collapsed: true } : { zone, share };
}

const packPanels = (panels: readonly Panel[]) =>
  panels.map((p) => `${p.id}!${formatRef(p.view)}!${packPlacement(p.placement)}`).join(";");

function unpackPanels(text: string): Panel[] {
  const panels: Panel[] = [];
  for (const chunk of text.split(";")) {
    const [id, refText, placementText] = chunk.split("!");
    const view = refText === undefined ? null : parseRef(refText);
    const placement = placementText === undefined ? null : unpackPlacement(placementText);
    if (id !== undefined && id !== "" && view !== null && placement !== null)
      panels.push({ id, view, placement });
  }
  return panels;
}

const packZones = (zones: Zones) => DOCKS.map((z) => n2(zones[z])).join(",");

function unpackZones(text: string): Zones {
  const values = text.split(",").map(Number);
  const next = { ...DEFAULT_ZONES };
  DOCKS.forEach((zone, i) => {
    const v = values[i];
    if (v !== undefined && !Number.isNaN(v)) next[zone] = v;
  });
  return next;
}

export function toHash(w: Workspace): string {
  const parts: string[] = [];
  if (w.page !== null) parts.push(`p=${formatRef(w.page)}`);
  if (w.panels.length > 0) parts.push(`s=${packPanels(w.panels)}`);
  parts.push(`z=${packZones(w.zones)}`);
  if (w.peek !== null) parts.push(`k=${formatRef(w.peek)}`);
  if (w.focus !== PAGE) parts.push(`f=${w.focus}`);
  if (w.maximized !== null) parts.push(`m=${w.maximized}`);
  return `#/w?${parts.join("&")}`;
}

export function fromHash(hash: string): Workspace {
  if (!hash.startsWith("#/w")) return EMPTY;
  const query = new URLSearchParams(hash.slice(hash.indexOf("?") + 1));

  const page = query.get("p");
  const peek = query.get("k");
  const panels = unpackPanels(query.get("s") ?? "");
  const focus = query.get("f");
  const maximized = query.get("m");
  const zones = query.get("z");

  const has = (id: string | null) => id !== null && panels.some((p) => p.id === id);
  return {
    ...EMPTY,
    page: page === null ? null : parseRef(page),
    panels,
    zones: zones === null ? DEFAULT_ZONES : unpackZones(zones),
    peek: peek === null ? null : parseRef(peek),
    focus: has(focus) ? focus! : PAGE,
    maximized: maximized === PAGE || has(maximized) ? maximized : null,
  };
}
