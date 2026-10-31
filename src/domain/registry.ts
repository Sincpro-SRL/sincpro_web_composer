import type { Destination, Surface, Zone } from "@sincpro/web-composer/domain/enums";
import type { ResourceRef } from "@sincpro/web-composer/domain/resource";
import type { ComponentType } from "react";

export { Surface } from "@sincpro/web-composer/domain/enums";

/**
 * Each domain declares itself. A `switch (ref.domain)` would force the host to import every
 * domain, and one bundle would drag the others in.
 */

export type OpenOptions = {
  /** Where it opens. Without it, the workspace's default: the page. */
  to?: Destination;
  /** A modal only: blur what it covers. Off by default — the surface underneath is blocked,
   *  not hidden. */
  blur?: boolean;
};

export type PickOptions = {
  /** Where the chooser opens. A window unless said otherwise. */
  to?:
    | typeof Destination.Peek
    | typeof Destination.Window
    | typeof Destination.Side
    | typeof Destination.Modal;
  /** A modal only: blur what it covers. */
  blur?: boolean;
};

/** One step of a breadcrumb, ready for `List.Crumbs` or `Record.Crumbs`. */
export type Crumb = { label: string; onClick?: () => void };

/**
 * What the workspace lends a view. It can open things and navigate; it cannot read the
 * workspace — if it could, two domains would couple through it instead of through a reference.
 */
export type WorkspaceApi = {
  self: ResourceRef;
  surface: Surface;
  /**
   * In a modal, what it was opened over — the record of the window, panel or page underneath:
   * its context. `null` on any other surface. Anything else the two share travels in the
   * modal's reference (`params`) and comes back with `answer`.
   */
  over: ResourceRef | null;

  /**
   * The one way to open a resource: `open(ref)` goes where the workspace opens by default (the
   * page), `open(ref, { to })` where the caller says. Opening the page from a window leaves the
   * window where it is; from the peek it closes the drawer — it sat over a page that is no longer
   * there. Inside the peek a plain `open(ref)` drills IN the drawer, and ← comes back: reading
   * does not throw the reader out. `{ to: "modal" }` opens it over THIS surface, blocking only
   * it; from inside a modal, it replaces that modal.
   */
  open: (ref: ResourceRef, options?: OpenOptions) => void;
  /** Show `ref` HERE, remembering where it was: a crumb on the page, a step back in the peek. A
   *  panel or a modal has no way back: it just changes. */
  navigate: (ref: ResourceRef) => void;
  /** Show `ref` HERE without a step to come back to: the record a form just created, a filter. */
  replace: (ref: ResourceRef) => void;
  /** This resource with `params` merged (`""` removes one), in place: filters live in the
   *  reference — they survive a reload, a link and a move to another surface. */
  setParams: (params: Record<string, string>) => void;
  /** One step back: the page's breadcrumb or the peek's own trail. Nothing in a panel or a
   *  modal. */
  back: () => void;
  /** A window, a side panel or the peek grows into the page. Nothing on the page itself, nor in
   *  a modal: it is a moment over something, not a place. */
  expand: () => void;
  /** Leave what this view is in: its panel, the peek or the modal closes; the page goes one
   *  step back. «Cancel» on a form is this one call wherever the form was opened. */
  close: () => void;
  /** Request workspace focus so shortcuts talk to this view. */
  focus: () => void;

  /**
   * The way here, ready for `List.Crumbs` / `Record.Crumbs`: the pages before, each a link, and
   * this one. In the peek the page's crumbs leave the drawer and its own steps stay in it. Empty
   * in a panel or a modal: its frame already says what it shows.
   *
   * What it is NOW, and the same array until it changes. A view draws it with `useCrumbs(api)`,
   * which follows it: read during render, a name given later (`setTitle`) would not show.
   */
  crumbs: () => readonly Crumb[];
  /** The name this resource goes by once loaded — the crumbs, the frame and the peek show it
   *  instead of the `ViewSpec` title. `null` gives the title back. Ignored once this surface
   *  shows something else, so a late answer cannot rename the wrong record. */
  setTitle: (title: string | null) => void;
  /** Something typed here would be lost. While it is, anything that would throw this view away
   *  — a crumb, a close, a reset, the browser's back or a reload — asks first. Set it back to
   *  `false` after saving, BEFORE leaving. */
  setDirty: (dirty: boolean) => void;

  /** Publish what THIS surface has selected, so a detail panel or an assistant can follow it.
   *  An empty list clears it. */
  select: (refs: readonly ResourceRef[]) => void;
  /** What the user is working on — references only. Read-only on purpose. */
  context: {
    focused: () => ResourceRef | null;
    selection: () => readonly ResourceRef[];
    subscribe: (listener: () => void) => () => void;
  };

  /** Open `ref` as a chooser: when its view calls `answer`, `onPick` receives the value and
   *  the chooser closes. */
  pick: (
    ref: ResourceRef,
    onPick: (value: ResourceRef) => void,
    options?: PickOptions,
  ) => void;
  /** From a chooser: deliver the value to whoever asked, and close this surface. */
  answer: (value: ResourceRef) => void;
};

/** Named `resource` rather than `ref` because `ref` is a reserved React prop. */
export type ViewProps = {
  resource: ResourceRef;
  api: WorkspaceApi;
};

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

/** Something a domain lets the user do with one of its resources: «Audit», «Reconcile».
 *  ⌘K offers the actions of the resource the user is on. */
export type Action = {
  id: string;
  label: string;
  icon?: Icon;
  /** Drawn, not bound: the palette is where the shortcut gets learned. */
  shortcut?: string;
  keywords?: readonly string[];
  /** Receives the API of the surface the resource is on. */
  run: (api: WorkspaceApi) => void;
};

/** A record a domain found for a ⌘K query. */
export type SearchHit = {
  ref: ResourceRef;
  label: string;
  /** What tells two hits with the same label apart: the customer, the date. */
  detail?: string;
};

export type ViewSpec = {
  domain: string;
  kind: string;
  title: (ref: ResourceRef) => string;
  icon?: Icon;
  /** Where to open when asked beside the page with no zone. */
  preferredZone?: Zone;
  /** Listed under «Go to» in ⌘K, opened as `domain:kind` with no id. */
  goto?: boolean;
  actions?: (ref: ResourceRef) => readonly Action[];
  /** ⌘K asks every domain that declares it; one that fails does not take the others'
   *  results with it. */
  search?: (query: string) => Promise<readonly SearchHit[]>;
  /** Lazy: the point where a remote module enters without changing anything else. */
  load: () => Promise<ComponentType<ViewProps>>;
};

export type Registry = {
  resolve: (ref: ResourceRef) => ViewSpec | null;
  domains: () => readonly string[];
  all: () => readonly ViewSpec[];
};

const specKey = (spec: Pick<ViewSpec, "domain" | "kind">) => `${spec.domain}:${spec.kind}`;

/** A function, not a singleton, so two workspaces with different domains can
 *  mount on the same page. */
export function createRegistry(specs: readonly ViewSpec[]): Registry {
  const byKey = new Map<string, ViewSpec>();

  for (const spec of specs) {
    const key = specKey(spec);
    if (byKey.has(key)) {
      console.warn(`[composer] ${key} is already registered; ignoring the duplicate`);
      continue;
    }
    byKey.set(key, spec);
  }

  return {
    resolve: (ref) => byKey.get(specKey(ref)) ?? null,
    domains: () => [...new Set(specs.map((s) => s.domain))],
    all: () => [...byKey.values()],
  };
}

/**
 * Cache against the `ViewSpec` object, not `domain:kind`. With a string key,
 * two registries declaring the same pair — which `createRegistry` promises to
 * allow — shared an entry and the second received the first's component.
 *
 * A failing module is not cached, so retry can work.
 */
const modules = new WeakMap<ViewSpec, Promise<ComponentType<ViewProps>>>();

export function loadView(spec: ViewSpec): Promise<ComponentType<ViewProps>> {
  const cached = modules.get(spec);
  if (cached !== undefined) return cached;

  const loading = spec.load();
  modules.set(spec, loading);
  loading.catch(() => modules.delete(spec));
  return loading;
}
