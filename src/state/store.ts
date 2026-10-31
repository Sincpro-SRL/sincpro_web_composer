import type {
  Dock,
  OpenModalOptions,
  OpenPanelOptions,
  ResourceRef,
  SessionMemory,
  WindowBox,
  Workspace,
  Zone,
} from "@sincpro/web-composer/domain/index";
import * as model from "@sincpro/web-composer/domain/index";

/**
 * The pure reducers already are the state handling; this only binds them to the browser. An
 * external store, not `useState`: with state in the component every action recreated the API
 * views receive, and every panel redrew on any change.
 *
 * Two things live here and not in the model, because they are about the browser and not about
 * the workspace: the history entries, and what a view has typed and not saved.
 */

export type Unsubscribe = () => void;

/** Asked before throwing away views with unsaved changes; `lost` is what they show. */
export type ConfirmDiscard = (lost: readonly ResourceRef[]) => boolean | Promise<boolean>;

export type WorkspaceStore = {
  /** Current state. Read at call time, never captured. */
  get: () => Workspace;
  subscribe: (listener: () => void) => Unsubscribe;
  /** Escape hatch: any reducer, including one of your own. */
  apply: (change: (state: Workspace) => Workspace) => void;
  /** Back to the starting workspace — the `initial` it was created with. */
  reset: () => void;
  /** Start over from `view`, the way a menu does: no breadcrumb behind it, no peek. The panels
   *  stay. */
  start: (view: ResourceRef) => void;

  push: (view: ResourceRef) => void;
  /** The page shows `view` with no crumb and no browser history entry. */
  replace: (view: ResourceRef) => void;
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
  drillPeek: (view: ResourceRef) => void;
  replacePeek: (view: ResourceRef) => void;
  peekGoTo: (index: number) => void;
  peekBack: () => void;
  closePeek: () => void;
  peekToPage: () => void;
  peekToSide: (zone?: Zone) => void;

  /** `view` over `host` (`PAGE`, `PEEK`, a panel id — or a modal's id, to replace it), blocking
   *  only that surface. */
  openModal: (host: string, view: ResourceRef, options?: OpenModalOptions) => void;
  closeModal: (host: string) => void;

  /** The name a view gives `ref` (see `api.setTitle`). */
  setTitle: (ref: ResourceRef, title: string | null) => void;
  /** `surface` (`PAGE`, `PEEK` or a panel id) has unsaved changes for `ref`. Ignored if it no
   *  longer shows it. */
  setDirty: (surface: string, ref: ResourceRef, dirty: boolean) => void;
  /** Where `<Composer>` installs its own dialog. A `confirmDiscard` given to the store wins. */
  setConfirmDiscard: (confirm: ConfirmDiscard | null) => void;
};

export type StoreOptions = {
  initial?: Workspace;
  /** Persist the workspace in the URL hash. The browser's Back and «share this link» come
   *  from here. */
  hash?: boolean;
  /** Called after every change. Hook for telemetry or saving the user's workspace. */
  onChange?: (state: Workspace) => void;
  /** Asked before a change throws away a view with unsaved changes. Without it, `<Composer>`
   *  asks with its own dialog; with neither, nothing is asked. */
  confirmDiscard?: ConfirmDiscard;
};

const inBrowser = () => typeof window !== "undefined";

/** A history entry records a new PLACE — another page or another peek. Sizes, focus and
 *  selection are corrections of the same place: they replace the entry. */
const History = { Auto: "auto", Replace: "replace" } as const;
type History = (typeof History)[keyof typeof History];

const placeOf = (w: Workspace) =>
  `${w.page === null ? "" : model.formatRef(w.page)} ${w.peek === null ? "" : model.formatRef(w.peek)}`;

const memoryOf = (w: Workspace): SessionMemory => ({
  trail: w.trail,
  peekTrail: w.peekTrail,
});

function isMemory(value: unknown): value is SessionMemory {
  const m = value as SessionMemory | null;
  return typeof m === "object" && m !== null && Array.isArray(m.trail);
}

function readHash(fallback: Workspace): Workspace {
  if (!inBrowser() || !window.location.hash.startsWith("#/w")) return fallback;
  return model.fromHash(window.location.hash);
}

const onBeforeUnload = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = "";
};

export function createWorkspaceStore({
  initial = model.EMPTY,
  hash = false,
  onChange,
  confirmDiscard,
}: StoreOptions = {}): WorkspaceStore {
  let state = hash ? readHash(initial) : initial;
  const listeners = new Set<() => void>();
  /** Surface → the resource it has unsaved changes for. */
  const dirty = new Map<string, ResourceRef>();
  let installed: ConfirmDiscard | null = null;
  let guarding = false;
  /** A discard being asked asynchronously: every change after it waits in line, so
   *  `back(); open(ref)` keeps its order. */
  let line: Promise<unknown> | null = null;

  const notify = () => {
    for (const l of listeners) l();
    onChange?.(state);
  };

  /** The browser asks before closing the tab only while something is unsaved. */
  function guardUnload() {
    const want = dirty.size > 0;
    if (want === guarding || !inBrowser()) return;
    guarding = want;
    if (want) window.addEventListener("beforeunload", onBeforeUnload);
    else window.removeEventListener("beforeunload", onBeforeUnload);
  }

  /** What `next` would throw away: a dirty surface gone, or showing another resource. Another
   *  face of the same one (only `params`) keeps the view mounted, and with it what was typed. */
  function lostIn(next: Workspace): [string, ResourceRef][] {
    return [...dirty].filter(([surface, ref]) => {
      const after = model.refOn(next, surface);
      return after === null || !model.sameRef(model.rootRef(after), model.rootRef(ref));
    });
  }

  /** `true`, `false`, or a promise of either; a confirm that throws is a «no». */
  function ask(lost: [string, ResourceRef][]): boolean | Promise<boolean> {
    const confirm = confirmDiscard ?? installed;
    if (confirm === null) return true;
    try {
      const answer = confirm(lost.map(([, ref]) => ref));
      return answer instanceof Promise ? answer.catch(() => false) : answer;
    } catch {
      return false;
    }
  }

  /** Only a new place is a new entry; the memory of the trails rides along in each one. */
  function writeUrl(before: Workspace, mode: History) {
    if (!hash || !inBrowser()) return;
    const text = model.toHash(state);
    if (mode === History.Auto && placeOf(before) !== placeOf(state))
      window.history.pushState(memoryOf(state), "", text);
    else window.history.replaceState(memoryOf(state), "", text);
  }

  function commit(next: Workspace, mode: History) {
    const before = state;
    state = next;
    writeUrl(before, mode);
    notify();
  }

  /** Runs `change`, asking first if it would throw away something unsaved. After a «yes» it
   *  runs again on the state of THEN — the answer may have taken a while. */
  function run(change: (w: Workspace) => Workspace, mode: History): Promise<unknown> | void {
    const next = model.settleModals(change(state));
    if (next === state) return;
    const lost = lostIn(next);
    if (lost.length === 0) return commit(next, mode);

    const proceed = (ok: boolean) => {
      if (!ok) return;
      for (const [surface] of lost) dirty.delete(surface);
      guardUnload();
      return run(change, mode);
    };
    const answer = ask(lost);
    return answer instanceof Promise ? answer.then(proceed) : proceed(answer);
  }

  function go(change: (w: Workspace) => Workspace, mode: History = History.Auto) {
    const result = line === null ? run(change, mode) : line.then(() => run(change, mode));
    if (!(result instanceof Promise)) return;
    line = result;
    void result.finally(() => {
      if (line === result) line = null;
    });
  }

  /**
   * Back or forward: the browser already moved, so this cannot be cancelled — only undone. If
   * the person keeps the unsaved changes, the place they had is pushed again (which costs the
   * forward entries; there is no other way to stay).
   */
  function onPopState(e: PopStateEvent) {
    const target = model.restore(
      state,
      readHash(initial),
      isMemory(e.state) ? e.state : null,
    );
    if (model.toHash(target) === model.toHash(state)) return;

    const settle = (ok: boolean) => {
      if (!ok) {
        window.history.pushState(memoryOf(state), "", model.toHash(state));
        return;
      }
      for (const [surface] of lostIn(target)) dirty.delete(surface);
      guardUnload();
      state = target;
      notify();
    };
    const lost = lostIn(target);
    const answer = lost.length === 0 ? true : ask(lost);
    if (answer instanceof Promise) void answer.then(settle);
    else settle(answer);
  }

  const subscribe = (listener: () => void): Unsubscribe => {
    listeners.add(listener);
    if (listeners.size === 1 && hash && inBrowser())
      window.addEventListener("popstate", onPopState);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && hash && inBrowser())
        window.removeEventListener("popstate", onPopState);
    };
  };

  return {
    get: () => state,
    subscribe,
    apply: (change) => go(change),
    reset: () => go(() => initial),
    start: (view) => go((w) => model.start(w, view)),

    push: (view) => go((w) => model.push(w, view)),
    replace: (view) => go((w) => model.replace(w, view), History.Replace),
    goTo: (index) => go((w) => model.goTo(w, index)),
    back: () => go(model.back),

    openPanel: (view, options) => go((w) => model.openPanel(w, view, options)),
    navigatePanel: (id, view) => go((w) => model.navigatePanel(w, id, view)),
    movePanel: (id, zone) => go((w) => model.movePanel(w, id, zone)),
    resizeZone: (zone, size) => go((w) => model.resizeZone(w, zone, size)),
    resizePanel: (id, share) => go((w) => model.resizePanel(w, id, share)),
    floatPanel: (id, box) => go((w) => model.floatPanel(w, id, box)),
    raisePanel: (id) => go((w) => model.raisePanel(w, id)),
    collapsePanel: (id) => go((w) => model.collapsePanel(w, id)),
    closePanel: (id) => go((w) => model.closePanel(w, id)),
    expandPanel: (id) => go((w) => model.expandPanel(w, id)),
    maximize: (target) => go((w) => model.maximize(w, target)),
    focusPanel: (target) => go((w) => model.focusPanel(w, target)),
    cycleFocus: (delta) => go((w) => model.cycleFocus(w, delta)),

    peek: (view) => go((w) => model.peek(w, view)),
    drillPeek: (view) => go((w) => model.drillPeek(w, view)),
    replacePeek: (view) => go((w) => model.replacePeek(w, view), History.Replace),
    peekGoTo: (index) => go((w) => model.peekGoTo(w, index)),
    peekBack: () => go(model.peekBack),
    closePeek: () => go(model.closePeek),
    peekToPage: () => go(model.peekToPage),
    peekToSide: (zone) => go((w) => model.peekToSide(w, zone)),

    openModal: (host, view, options) =>
      go((w) => model.openModal(w, host, view, options), History.Replace),
    closeModal: (host) => go((w) => model.closeModal(w, host), History.Replace),

    setTitle: (ref, title) => go((w) => model.nameRef(w, ref, title), History.Replace),
    setDirty: (surface, ref, on) => {
      const shown = model.refOn(state, surface);
      if (shown === null || !model.sameRef(model.rootRef(shown), model.rootRef(ref))) return;
      if (on) dirty.set(surface, ref);
      else dirty.delete(surface);
      guardUnload();
    },
    setConfirmDiscard: (confirm) => {
      installed = confirm;
    },
  };
}
