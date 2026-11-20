"use client";

import {
  type Crumb,
  type ResourceRef,
  sectionOf,
  type Workspace,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
import {
  createWorkspaceStore,
  hydrationOf,
  type StoreOptions,
  type WorkspaceStore,
} from "@sincpro/web-composer/state/store";
import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * `useSyncExternalStore` is React, not a state library. What it adds over
 * `useState` is the one thing we needed: subscribe to a slice, so moving one
 * panel does not redraw the other five.
 *
 * Its server snapshot is what the server drew: the store as it is, or — `serverRendered` —
 * `initial`, so a part hydrated late (a Suspense boundary) still matches the server's HTML
 * after the store took the URL's place.
 */

/** The workspace an app holds. Server-rendered, `{ hash: true, serverRendered: true }`: the
 *  first render is the server's, and the URL's place comes once mounted — before the effects of
 *  the component that holds it, which may ask `get()` where it is. */
export function useWorkspace(options: StoreOptions = {}): WorkspaceStore {
  const saved = useRef<WorkspaceStore>(null);
  saved.current ??= createWorkspaceStore(options);
  const store = saved.current;
  useEffect(() => hydrationOf(store)?.takeUrl(), [store]);
  return store;
}

export function useWorkspaceState(store: WorkspaceStore): Workspace {
  return useSyncExternalStore(
    store.subscribe,
    store.get,
    hydrationOf(store)?.server ?? store.get,
  );
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

/** Whether the workspace is a phone right now, redrawn when it changes (`api.layout`): for what
 *  a view offers, not for how it is drawn — that is `@container sc-view`, which a narrow side
 *  panel on a desktop answers too. */
export function usePhone(api: WorkspaceApi): boolean {
  return useSyncExternalStore(api.layout.subscribe, api.layout.phone, api.layout.phone);
}

/** The entry of the app's menu the person is under (`sectionOf`), for a bar or a sidebar to
 *  mark. One of `sections` itself, so it redraws when the entry changes, not on every move of a
 *  panel. */
export function useSection<T extends ResourceRef>(
  store: WorkspaceStore,
  sections: readonly T[],
): T | null {
  const read = () => sectionOf(store.get(), sections);
  const server = hydrationOf(store)?.server;
  const drawn = server === undefined ? read : () => sectionOf(server(), sections);
  return useSyncExternalStore(store.subscribe, read, drawn);
}

export type { StoreOptions as UseWorkspaceOptions, WorkspaceStore };
