import * as model from "@sincpro/web-composer/domain/index";
import {
  type Crumb,
  Destination,
  formatRef,
  PAGE,
  type Registry,
  type ResourceRef,
  Surface,
  type ViewSpec,
  type WorkspaceApi,
  Zone,
} from "@sincpro/web-composer/domain/index";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";

/**
 * The API each view receives is built once per surface and kept. Recreating it on every
 * workspace change swapped the prop on every mounted view, so moving one panel redrew the
 * other five.
 *
 * Anything that needs current state reads it with `store.get()` at call time, never captured —
 * that is what lets the object stay stable without going stale.
 */

export type Target =
  | { surface: typeof Surface.Page }
  | { surface: typeof Surface.Panel; panelId: string }
  | { surface: typeof Surface.Peek };

const cacheKey = (target: Target) =>
  target.surface === Surface.Panel ? `${Surface.Panel}:${target.panelId}` : target.surface;

export type ApiFactory = {
  for: (resource: ResourceRef, target: Target) => WorkspaceApi;
  /** Zone to open into when nobody asks: the one the domain prefers. */
  zoneFor: (spec: ViewSpec | null) => Zone;
  /** Stops listening to the store. Call it when the workspace goes away. */
  dispose: () => void;
};

export type ApiFactoryOptions = {
  /** Gives the breadcrumb its titles and `open(ref, { to: "side" })` the zone a domain prefers. */
  registry?: Registry;
  /** Where `open(ref)` goes without a `to`. The page: what people expect of a click. */
  defaultOpen?: Destination;
};

/** A chooser open in a panel, waiting for its answer. */
type Pending = (value: ResourceRef) => void;

export function createApiFactory(
  store: WorkspaceStore,
  { registry, defaultOpen = Destination.Page }: ApiFactoryOptions = {},
): ApiFactory {
  const cache = new Map<string, { resource: ResourceRef; api: WorkspaceApi }>();
  const choosers = new Map<string, Pending>();

  const zoneFor: ApiFactory["zoneFor"] = (spec) => spec?.preferredZone ?? Zone.Right;
  const titleOf = (ref: ResourceRef) => registry?.resolve(ref)?.title(ref) ?? formatRef(ref);

  /* A chooser whose panel is gone is forgotten, and so is a cached API of a surface that no
     longer exists — or every panel ever opened would stay in memory. */
  const stop = store.subscribe(() => {
    const w = store.get();
    for (const id of choosers.keys()) {
      if (id !== `${PAGE}:peek` && model.findPanel(w, id) === null) choosers.delete(id);
    }
    for (const key of cache.keys()) {
      const id = key.startsWith(`${Surface.Panel}:`)
        ? key.slice(Surface.Panel.length + 1)
        : null;
      if (id !== null && model.findPanel(w, id) === null) cache.delete(key);
    }
  });

  const context: WorkspaceApi["context"] = {
    focused: () => model.focusedRef(store.get()),
    selection: () => model.selectionOf(store.get()),
    subscribe: store.subscribe,
  };

  function build(resource: ResourceRef, target: Target): WorkspaceApi {
    const me = target.surface === Surface.Panel ? target.panelId : PAGE;

    function openSide(ref: ResourceRef, zone: Zone) {
      store.openPanel(ref, zone);
    }

    function open(ref: ResourceRef, to: Destination) {
      if (to === Destination.Peek) store.peek(ref);
      else if (to === Destination.Window) openSide(ref, Zone.Floating);
      else if (to === Destination.Side)
        openSide(ref, zoneFor(registry?.resolve(ref) ?? null));
      else if (target.surface === Surface.Peek) {
        store.closePeek();
        store.push(ref);
      } else store.push(ref);
    }

    const api: WorkspaceApi = {
      self: resource,
      surface: target.surface,
      context,

      open: (ref, options) => open(ref, options?.to ?? defaultOpen),

      navigate: (to) => {
        if (target.surface === Surface.Panel) store.navigatePanel(target.panelId, to);
        else if (target.surface === Surface.Peek) store.peek(to);
        else store.apply((w) => model.push(w, to));
      },

      back: () => {
        if (target.surface === Surface.Page) store.back();
      },

      expand: () => {
        if (target.surface === Surface.Panel) store.expandPanel(target.panelId);
        else if (target.surface === Surface.Peek) store.peekToPage();
      },

      close: () => {
        if (target.surface === Surface.Panel) store.closePanel(target.panelId);
        else if (target.surface === Surface.Peek) store.closePeek();
      },

      focus: () => store.focusPanel(me),

      crumbs: () => {
        /* A panel, a window or the peek already carry the record's name in their frame: a
           breadcrumb of one would only repeat it. The way back belongs to the page. */
        if (target.surface !== Surface.Page) return [];
        const w = store.get();
        return [
          ...w.trail.map((past, i): Crumb => ({
            label: titleOf(past),
            onClick: () => store.goTo(i),
          })),
          { label: titleOf(w.page ?? api.self) },
        ];
      },

      select: (refs) => store.apply((w) => model.select(w, me, refs)),

      pick: (ref, onPick, options) => {
        const to = options?.to ?? Destination.Window;
        if (to === Destination.Peek) {
          store.peek(ref);
          choosers.set(PAGE + ":peek", onPick);
          return;
        }
        open(ref, to);
        const id = store.get().focus;
        if (id !== PAGE) choosers.set(id, onPick);
      },

      answer: (value) => {
        const key = target.surface === Surface.Peek ? `${PAGE}:peek` : me;
        const onPick = choosers.get(key);
        if (onPick === undefined) return;
        /* Forget it BEFORE closing, so closing is not mistaken for anything else. */
        choosers.delete(key);
        onPick(value);
        if (target.surface === Surface.Peek) store.closePeek();
        else if (target.surface === Surface.Panel) store.closePanel(target.panelId);
      },
    };
    return api;
  }

  return {
    for: (resource, target) => {
      const key = cacheKey(target);
      const cached = cache.get(key);

      if (cached === undefined) {
        const api = build(resource, target);
        cache.set(key, { resource, api });
        return api;
      }

      if (cached.resource !== resource) {
        cached.api.self = resource;
        cached.resource = resource;
      }
      return cached.api;
    },

    zoneFor,
    dispose: stop,
  };
}
