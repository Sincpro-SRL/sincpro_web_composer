import {
  type Action,
  Destination,
  focusedRef,
  formatRef,
  type Registry,
  type ResourceRef,
  Surface,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { WorkspacePalette } from "@sincpro/web-composer/shell/Palette";
import { PanelHost } from "@sincpro/web-composer/shell/PanelHost";
import { ViewHost } from "@sincpro/web-composer/shell/ViewHost";
import { createApiFactory } from "@sincpro/web-composer/state/api";
import { useDropMonitor } from "@sincpro/web-composer/state/drag";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";
import { useKeyboard } from "@sincpro/web-composer/state/useKeyboard";
import { useWorkspaceState } from "@sincpro/web-composer/state/useWorkspace";
import { Button, Peek } from "@sincpro/web-ui";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

/**
 * The workspace — the page, the panels around it, the peek and ⌘K — wired against the
 * registry. Adding a domain does not touch any file in this package: register its `ViewSpec`
 * and it appears.
 */

export type ComposerProps = {
  workspace: WorkspaceStore;
  registry: Registry;
  /** Drawn when there is no page yet. */
  empty?: ReactNode;
  /** Keyboard shortcuts, ⌘K included. Turn off if the app already defines its own. */
  keyboard?: boolean;
  /** Where `api.open(ref)` goes when the caller does not say. The page — what people expect of
   *  a click on a record. */
  defaultOpen?: Destination;
  /** ⌘K, controlled — for a search button in the app's own bar. Without it the composer keeps
   *  the state and only the shortcut opens it. */
  palette?: boolean;
  onPaletteChange?: (open: boolean) => void;
};

export function Composer({
  workspace,
  registry,
  empty,
  keyboard = true,
  defaultOpen = Destination.Page,
  palette: paletteProp,
  onPaletteChange,
}: ComposerProps) {
  const state = useWorkspaceState(workspace);
  const copy = composerCopy();
  const [paletteState, setPaletteState] = useState(false);
  const palette = paletteProp ?? paletteState;
  const setPalette = useCallback(
    (open: boolean) => {
      setPaletteState(open);
      onPaletteChange?.(open);
    },
    [onPaletteChange],
  );

  const api = useMemo(
    () => createApiFactory(workspace, { registry, defaultOpen }),
    [workspace, registry, defaultOpen],
  );
  useEffect(() => api.dispose, [api]);

  useKeyboard({
    workspace,
    enabled: keyboard,
    onPalette: useCallback(() => setPalette(true), [setPalette]),
  });

  useDropMonitor(
    useMemo(
      () => ({
        onPanelToZone: workspace.movePanel,
        onRefToZone: (ref, zone) => workspace.openPanel(ref, zone),
      }),
      [workspace],
    ),
  );

  /** Where a chosen search result opens. Without a page yet, the first one becomes it. */
  function open(ref: ResourceRef, destination: Destination) {
    const here = workspace.get();
    if (destination === Destination.Peek) workspace.peek(ref);
    else if (destination === Destination.Window) workspace.openPanel(ref, Zone.Floating);
    else if (destination === Destination.Side && here.page !== null)
      workspace.openPanel(ref, api.zoneFor(registry.resolve(ref)));
    else workspace.push(ref);
  }

  /** An action runs with the API of the surface its resource is on, so «audit» can open beside
   *  it or navigate it. */
  function run(action: Action) {
    const w = workspace.get();
    const ref = focusedRef(w);
    if (ref === null) return;
    action.run(
      api.for(
        ref,
        w.focus === "page"
          ? { surface: Surface.Page }
          : { surface: Surface.Panel, panelId: w.focus },
      ),
    );
  }

  const peeked = state.peek;
  const peekSpec = peeked === null ? null : registry.resolve(peeked);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-ground">
      {state.page === null ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">{empty}</div>
      ) : (
        <PanelHost
          workspace={state}
          registry={registry}
          store={workspace}
          api={api}
          overlay={
            peeked === null ? null : (
              <Peek
                open
                title={peekSpec?.title(peeked) ?? formatRef(peeked)}
                onClose={workspace.closePeek}
                onPromote={() => workspace.peekToSide(peekSpec?.preferredZone ?? Zone.Right)}
                actions={
                  <Button size="sm" role="ghost" onClick={workspace.peekToPage}>
                    {copy.peek.openAsPage}
                  </Button>
                }
              >
                <ViewHost
                  resource={peeked}
                  registry={registry}
                  api={api.for(peeked, { surface: Surface.Peek })}
                />
              </Peek>
            )
          }
        />
      )}

      {palette ? (
        <WorkspacePalette
          registry={registry}
          focused={focusedRef(state)}
          onOpen={open}
          onAction={run}
          onClose={() => setPalette(false)}
        />
      ) : null}
    </div>
  );
}
