import type {
  Dock,
  OpenPanelOptions,
  ResourceRef,
  WindowBox,
  Workspace,
  Zone,
} from "@sincpro/web-composer/domain/index";
import * as model from "@sincpro/web-composer/domain/index";

/**
 * The pure reducers already are the state handling; this only binds them to the browser. An
 * external store, not `useState`: with state in the component every action recreated the API
 * views receive, and every panel redrew on any change.
 */

export type Unsubscribe = () => void;

export type WorkspaceStore = {
  /** Current state. Read at call time, never captured. */
  get: () => Workspace;
  subscribe: (listener: () => void) => Unsubscribe;
  /** Escape hatch: any reducer, including one of your own. */
  apply: (change: (state: Workspace) => Workspace) => void;
  /** Back to the starting workspace — the `initial` it was created with. */
  reset: () => void;

  push: (view: ResourceRef) => void;
  goTo: (index: number) => void;
  back: () => void;

  openPanel: (view: ResourceRef, options?: Zone | OpenPanelOptions) => void;
  navigatePanel: (id: string, view: ResourceRef) => void;
  movePanel: (id: string, zone: Zone) => void;
  resizeZone: (zone: Dock, size: number) => void;
  resizePanel: (id: string, share: number) => void;
  floatPanel: (id: string, box: WindowBox) => void;
  raisePanel: (id: string) => void;
  collapsePanel: (id: string) => void;
  closePanel: (id: string) => void;
  expandPanel: (id: string) => void;
  maximize: (target: string | null) => void;
  focusPanel: (target: string) => void;
  cycleFocus: (delta: number) => void;

  peek: (view: ResourceRef) => void;
  closePeek: () => void;
  peekToPage: () => void;
  peekToSide: (zone?: Zone) => void;
};

export type StoreOptions = {
  initial?: Workspace;
  /** Persist the workspace in the URL hash. Browser history and «share this link» come from
   *  here. */
  hash?: boolean;
  /** Called after every change. Hook for telemetry or saving the user's workspace. */
  onChange?: (state: Workspace) => void;
};

const inBrowser = () => typeof window !== "undefined";

function readHash(fallback: Workspace): Workspace {
  if (!inBrowser() || !window.location.hash.startsWith("#/w")) return fallback;
  return model.fromHash(window.location.hash);
}

export function createWorkspaceStore({
  initial = model.EMPTY,
  hash = false,
  onChange,
}: StoreOptions = {}): WorkspaceStore {
  let state = hash ? readHash(initial) : initial;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const l of listeners) l();
    onChange?.(state);
  };

  /** Compare the text before writing; otherwise writing the hash fires `hashchange` and the
   *  loop never ends. */
  const writeUrl = () => {
    if (!hash || !inBrowser()) return;
    const text = model.toHash(state);
    if (window.location.hash !== text) window.history.replaceState(null, "", text);
  };

  const apply = (change: (state: Workspace) => Workspace) => {
    const next = change(state);
    if (next === state) return;
    state = next;
    writeUrl();
    notify();
  };

  function onHashChange() {
    const fromUrl = readHash(state);
    if (model.toHash(fromUrl) === model.toHash(state)) return;
    state = fromUrl;
    notify();
  }

  const subscribe = (listener: () => void): Unsubscribe => {
    listeners.add(listener);
    if (listeners.size === 1 && hash && inBrowser())
      window.addEventListener("hashchange", onHashChange);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && hash && inBrowser())
        window.removeEventListener("hashchange", onHashChange);
    };
  };

  return {
    get: () => state,
    subscribe,
    apply,
    reset: () => apply(() => initial),

    push: (view) => apply((w) => model.push(w, view)),
    goTo: (index) => apply((w) => model.goTo(w, index)),
    back: () => apply(model.back),

    openPanel: (view, options) => apply((w) => model.openPanel(w, view, options)),
    navigatePanel: (id, view) => apply((w) => model.navigatePanel(w, id, view)),
    movePanel: (id, zone) => apply((w) => model.movePanel(w, id, zone)),
    resizeZone: (zone, size) => apply((w) => model.resizeZone(w, zone, size)),
    resizePanel: (id, share) => apply((w) => model.resizePanel(w, id, share)),
    floatPanel: (id, box) => apply((w) => model.floatPanel(w, id, box)),
    raisePanel: (id) => apply((w) => model.raisePanel(w, id)),
    collapsePanel: (id) => apply((w) => model.collapsePanel(w, id)),
    closePanel: (id) => apply((w) => model.closePanel(w, id)),
    expandPanel: (id) => apply((w) => model.expandPanel(w, id)),
    maximize: (target) => apply((w) => model.maximize(w, target)),
    focusPanel: (target) => apply((w) => model.focusPanel(w, target)),
    cycleFocus: (delta) => apply((w) => model.cycleFocus(w, delta)),

    peek: (view) => apply((w) => model.peek(w, view)),
    closePeek: () => apply(model.closePeek),
    peekToPage: () => apply(model.peekToPage),
    peekToSide: (zone) => apply((w) => model.peekToSide(w, zone)),
  };
}
