import { type Dock, DOCKS, Zone } from "@sincpro/web-composer/domain/enums";
import {
  formatRef,
  parseRef,
  type ResourceRef,
  sameRef,
} from "@sincpro/web-composer/domain/resource";
import {
  DEFAULT_ZONES,
  EMPTY,
  hostOf,
  PAGE,
  type Panel,
  PEEK,
  type Placement,
  refOn,
  settleModals,
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
  /* A modal is not in the URL: its host stands for it. */
  const focus = hostOf(w.focus);
  if (focus !== PAGE) parts.push(`f=${focus}`);
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
  const pageRef = page === null ? null : parseRef(page);
  /* A drawer needs a page to sit over: without one it is dropped, like any broken part. */
  const peekRef = peek === null || pageRef === null ? null : parseRef(peek);
  return {
    ...EMPTY,
    page: pageRef,
    panels,
    zones: zones === null ? DEFAULT_ZONES : unpackZones(zones),
    peek: peekRef,
    focus: has(focus) || (focus === PEEK && peekRef !== null) ? focus! : PAGE,
    maximized: maximized === PAGE || has(maximized) ? maximized : null,
  };
}

/** What the URL does not carry, written into each browser history entry. */
export type SessionMemory = {
  trail: readonly ResourceRef[];
  peekTrail: readonly ResourceRef[];
};

/** A page reached without memory — a link typed or clicked: one already in the trail goes back
 *  to it; any other is one step forward. */
function trailTo(now: Workspace, page: ResourceRef | null): readonly ResourceRef[] {
  if (page === null) return [];
  if (now.page !== null && sameRef(now.page, page)) return now.trail;
  const index = now.trail.findIndex((past) => sameRef(past, page));
  if (index >= 0) return now.trail.slice(0, index);
  return now.page === null ? [] : [...now.trail, now.page];
}

/**
 * The browser moved through its history: the URL says WHERE, the session says how I got there.
 * With the entry's own memory the trails are exact; without it they are reconciled. The
 * selection survives only while its surface still shows the same resource, and the names views
 * gave stay. So does a modal, while what it covers is still there.
 */
export function restore(
  now: Workspace,
  url: Workspace,
  memory: SessionMemory | null,
): Workspace {
  const peekTrail =
    url.peek === null
      ? []
      : (memory?.peekTrail ??
        (now.peek !== null && sameRef(now.peek, url.peek) ? now.peekTrail : []));

  const by = now.selected?.by;
  const before = by === undefined ? null : refOn(now, by);
  const after = by === undefined ? null : refOn(url, by);
  const keeps = before !== null && after !== null && sameRef(before, after);

  return settleModals({
    ...url,
    trail: url.page === null ? [] : (memory?.trail ?? trailTo(now, url.page)),
    peekTrail,
    selected: keeps ? now.selected : null,
    titles: now.titles,
    modals: now.modals,
  });
}
