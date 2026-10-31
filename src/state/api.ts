import * as model from "@sincpro/web-composer/domain/index";
import {
  type Crumb,
  Destination,
  formatRef,
  PAGE,
  PEEK,
  type Registry,
  type ResourceRef,
  Surface,
  type ViewSpec,
  type WorkspaceApi,
  Zone,
} from "@sincpro/web-composer/domain/index";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";

/**
 * The API each view receives is built once per surface AND resource, and kept while the
 * surface shows it. Recreating it on every workspace change swapped the prop on every mounted
 * view, so moving one panel redrew the other five. Rebuilding it when the resource changes is
 * what lets a late call from the view that WAS there — a name that arrives after navigating —
 * be recognised and ignored.
 *
 * Anything that needs current state reads it with `store.get()` at call time, never captured —
 * that is what lets the object stay stable without going stale.
 */

export type Target =
  | { surface: typeof Surface.Page }
  | { surface: typeof Surface.Panel; panelId: string }
  | { surface: typeof Surface.Peek }
  | { surface: typeof Surface.Modal; host: string };

/** The id the workspace knows the surface by: `PAGE`, `PEEK`, the panel id or `modal:<host>`. */
const surfaceId = (target: Target) =>
  target.surface === Surface.Panel
    ? target.panelId
    : target.surface === Surface.Peek
      ? PEEK
      : target.surface === Surface.Modal
        ? model.modalId(target.host)
        : PAGE;

/** The other way: the target of a surface the workspace knows by `id` — the focus, say. */
export function targetOf(id: string): Target {
  if (id === PAGE) return { surface: Surface.Page };
  if (id === PEEK) return { surface: Surface.Peek };
  if (id.startsWith(model.MODAL)) return { surface: Surface.Modal, host: model.hostOf(id) };
  return { surface: Surface.Panel, panelId: id };
}

export type ApiFactory = {
  for: (resource: ResourceRef, target: Target) => WorkspaceApi;
  /** Zone to open into when nobody asks: the one the domain prefers. */
  zoneFor: (spec: ViewSpec | null) => Zone;
  /** The name the shell draws for `ref`: the one its view gave, else its `ViewSpec` title. */
  titleOf: (ref: ResourceRef) => string;
  /** Stops listening to the store. Call it when the workspace goes away. */
  dispose: () => void;
};

export type ApiFactoryOptions = {
  /** Gives the breadcrumb its titles and `open(ref, { to: "side" })` the zone a domain prefers. */
  registry?: Registry;
  /** Where `open(ref)` goes without a `to`. The page: what people expect of a click. */
  defaultOpen?: Destination;
};

/** A panel's or a modal's frame already says what it shows. One array, so it reads as
 *  «unchanged». */
const NO_CRUMBS: readonly Crumb[] = [];

/** A chooser open in a panel, waiting for its answer. */
type Pending = (value: ResourceRef) => void;

export function createApiFactory(
  store: WorkspaceStore,
  { registry, defaultOpen = Destination.Page }: ApiFactoryOptions = {},
): ApiFactory {
  const cache = new Map<string, { resource: ResourceRef; api: WorkspaceApi }>();
  const choosers = new Map<string, Pending>();

  const zoneFor: ApiFactory["zoneFor"] = (spec) => spec?.preferredZone ?? Zone.Right;
  const titleOf = (ref: ResourceRef) =>
    model.nameOf(store.get(), ref) ?? registry?.resolve(ref)?.title(ref) ?? formatRef(ref);

  /* A chooser whose surface is gone is forgotten, and so is a cached API of a surface that no
     longer exists — or every panel ever opened would stay in memory. */
  const stop = store.subscribe(() => {
    const w = store.get();
    for (const id of choosers.keys()) if (model.refOn(w, id) === null) choosers.delete(id);
    for (const key of cache.keys()) if (model.refOn(w, key) === null) cache.delete(key);
  });

  const context: WorkspaceApi["context"] = {
    focused: () => model.focusedRef(store.get()),
    selection: () => model.selectionOf(store.get()),
    subscribe: store.subscribe,
  };

  function build(resource: ResourceRef, target: Target): WorkspaceApi {
    const me = surfaceId(target);
    const inPeek = target.surface === Surface.Peek;
    const inModal = target.surface === Surface.Modal;

    /** Still showing what this API was lent for. */
    const here = () => {
      const now = model.refOn(store.get(), me);
      return now !== null && model.sameRef(now, resource);
    };

    /** In a modal, its blur stays what it was opened with when its view changes. */
    const blurNow = () => model.modalOver(store.get(), model.hostOf(me))?.blur ?? false;

    function open(ref: ResourceRef, to: Destination, blur = false) {
      if (to === Destination.Modal) store.openModal(me, ref, { blur });
      else if (to === Destination.Peek) {
        if (inPeek) store.drillPeek(ref);
        else store.peek(ref);
      } else if (to === Destination.Window) store.openPanel(ref, Zone.Floating);
      else if (to === Destination.Side)
        store.openPanel(ref, zoneFor(registry?.resolve(ref) ?? null));
      else store.push(ref);
    }

    function replace(ref: ResourceRef) {
      if (target.surface === Surface.Panel) store.navigatePanel(target.panelId, ref);
      else if (inModal) store.openModal(me, ref, { blur: blurNow() });
      else if (inPeek) store.replacePeek(ref);
      else store.replace(ref);
    }

    /** In the peek the page's crumbs leave the drawer — a crumb is the page — and its own steps
     *  stay in it. */
    function freshCrumbs(): readonly Crumb[] {
      const w = store.get();
      const page = w.page ?? resource;
      const pageCrumbs = w.trail.map((past, i): Crumb => ({
        label: titleOf(past),
        onClick: () => store.goTo(i),
      }));
      if (!inPeek) return [...pageCrumbs, { label: titleOf(page) }];

      return [
        ...pageCrumbs,
        { label: titleOf(page), onClick: store.closePeek },
        ...w.peekTrail.map((past, i): Crumb => ({
          label: titleOf(past),
          onClick: () => store.peekGoTo(i),
        })),
        { label: titleOf(w.peek ?? resource) },
      ];
    }

    /** The SAME array until a label or the length of the trail changes: `useCrumbs` subscribes
     *  with it, and a new array per read would redraw forever. The links are by position, so
     *  equal labels on an equal trail are an equal breadcrumb. */
    let last: { key: string; crumbs: readonly Crumb[] } | null = null;
    function crumbs(): readonly Crumb[] {
      if (target.surface === Surface.Panel || inModal) return NO_CRUMBS;
      const next = freshCrumbs();
      const key = `${store.get().trail.length}\u0000${next.map((c) => c.label).join("\u0000")}`;
      if (last?.key === key) return last.crumbs;
      last = { key, crumbs: next };
      return next;
    }

    return {
      self: resource,
      surface: target.surface,
      over: inModal ? (model.modalOver(store.get(), target.host)?.over ?? null) : null,
      context,

      open: (ref, options) =>
        open(
          ref,
          options?.to ??
            (inPeek && defaultOpen === Destination.Page ? Destination.Peek : defaultOpen),
          options?.blur,
        ),

      navigate: (to) => {
        if (target.surface === Surface.Panel) store.navigatePanel(target.panelId, to);
        else if (inModal) replace(to);
        else if (inPeek) store.drillPeek(to);
        else store.push(to);
      },

      replace,

      setParams: (params) => {
        const now = model.refOn(store.get(), me);
        if (now === null || !model.sameRef(model.rootRef(now), model.rootRef(resource)))
          return;
        replace(model.withParams(now, params));
      },

      back: () => {
        if (target.surface === Surface.Page) store.back();
        else if (inPeek) store.peekBack();
      },

      expand: () => {
        if (target.surface === Surface.Panel) store.expandPanel(target.panelId);
        else if (inPeek) store.peekToPage();
      },

      close: () => {
        if (target.surface === Surface.Panel) store.closePanel(target.panelId);
        else if (inModal) store.closeModal(me);
        else if (inPeek) store.closePeek();
        else store.back();
      },

      focus: () => store.focusPanel(me),

      crumbs,

      setTitle: (title) => {
        if (here()) store.setTitle(resource, title);
      },

      setDirty: (dirty) => store.setDirty(me, resource, dirty),

      select: (refs) => store.apply((w) => model.select(w, me, refs)),

      pick: (ref, onPick, options) => {
        const to = options?.to ?? Destination.Window;
        if (to === Destination.Modal) {
          open(ref, to, options?.blur);
          choosers.set(model.modalId(model.hostOf(me)), onPick);
          return;
        }
        if (to === Destination.Peek) {
          store.peek(ref);
          choosers.set(PEEK, onPick);
          return;
        }
        open(ref, to);
        const id = store.get().focus;
        if (id !== PAGE && id !== PEEK) choosers.set(id, onPick);
      },

      answer: (value) => {
        const onPick = choosers.get(me);
        if (onPick === undefined) return;
        /* Forget it BEFORE closing, so closing is not mistaken for anything else. */
        choosers.delete(me);
        onPick(value);
        if (inModal) store.closeModal(me);
        else if (inPeek) store.closePeek();
        else if (target.surface === Surface.Panel) store.closePanel(target.panelId);
      },
    };
  }

  return {
    for: (resource, target) => {
      const key = surfaceId(target);
      const cached = cache.get(key);
      if (cached !== undefined && model.sameRef(cached.resource, resource)) return cached.api;

      const api = build(resource, target);
      cache.set(key, { resource, api });
      return api;
    },

    zoneFor,
    titleOf,
    dispose: stop,
  };
}
