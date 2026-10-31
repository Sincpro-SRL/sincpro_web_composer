import type { Crumb, Workspace, WorkspaceApi } from "@sincpro/web-composer/domain/index";
import {
  createWorkspaceStore,
  type StoreOptions,
  type WorkspaceStore,
} from "@sincpro/web-composer/state/store";
import { useMemo, useRef, useSyncExternalStore } from "react";

/**
 * `useSyncExternalStore` is React, not a state library. What it adds over
 * `useState` is the one thing we needed: subscribe to a slice, so moving one
 * panel does not redraw the other five.
 */

export function useWorkspace(options: StoreOptions = {}): WorkspaceStore {
  const saved = useRef<WorkspaceStore>(null);
  saved.current ??= createWorkspaceStore(options);
  return saved.current;
}

/**
 * Watch a slice of the workspace and redraw only when THAT slice changes.
 * The selector must return something comparable by identity. Reducers are
 * pure and leave untouched data alone, so `tab.panels` stays the same array
 * until someone moves a panel.
 */
export function useWorkspaceSlice<T>(
  store: WorkspaceStore,
  select: (state: Workspace) => T,
): T {
  const read = useMemo(() => () => select(store.get()), [store, select]);
  return useSyncExternalStore(store.subscribe, read, read);
}

export function useWorkspaceState(store: WorkspaceStore): Workspace {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** For a global panel — the chat, the assistant — that follows what the user
 *  is working on. Redraws only when the focused resource or its selection change. */
export function useWorkspaceContext(api: WorkspaceApi) {
  const { subscribe, focused, selection } = api.context;
  return {
    focused: useSyncExternalStore(subscribe, focused, focused),
    selection: useSyncExternalStore(subscribe, selection, selection),
  };
}

/** The breadcrumb that FOLLOWS the workspace: a name a view gives later (`setTitle`) redraws
 *  it. `api.crumbs()` read during render is what it was then — nothing redraws a view when a
 *  title changes, and the API it holds stays the same object on purpose. */
export function useCrumbs(api: WorkspaceApi): readonly Crumb[] {
  return useSyncExternalStore(api.context.subscribe, api.crumbs, api.crumbs);
}

export type { StoreOptions as UseWorkspaceOptions, WorkspaceStore };
