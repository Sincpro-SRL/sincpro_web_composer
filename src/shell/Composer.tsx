import {
  type Action,
  Destination,
  destinationOnPhone,
  focusedRef,
  modalOver,
  PEEK,
  PHONE_WIDTH,
  type Registry,
  type ResourceRef,
  Surface,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { ModalLayer } from "@sincpro/web-composer/shell/Modal";
import { WorkspacePalette } from "@sincpro/web-composer/shell/Palette";
import { PanelHost } from "@sincpro/web-composer/shell/PanelHost";
import { ChromeButton, ConfirmDialog, PeekDrawer } from "@sincpro/web-composer/shell/Peek";
import {
  type ComposerSkin,
  resolveSkin,
  SkinProvider,
} from "@sincpro/web-composer/shell/skin";
import { ComposerStyles } from "@sincpro/web-composer/shell/styles";
import { ViewHost } from "@sincpro/web-composer/shell/ViewHost";
import { registerAgentTools, workspaceTools } from "@sincpro/web-composer/state/agent";
import { createApiFactory, targetOf } from "@sincpro/web-composer/state/api";
import { useDropMonitor } from "@sincpro/web-composer/state/drag";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";
import { useKeyboard } from "@sincpro/web-composer/state/useKeyboard";
import { useWorkspaceState } from "@sincpro/web-composer/state/useWorkspace";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * The workspace — the page, the panels around it, the peek and ⌘K — wired against the
 * registry. Adding a domain does not touch any file in this package: register its `ViewSpec`
 * and it appears.
 */

/** A discard waiting for the person's answer. */
type Asking = { names: readonly string[]; answer: (ok: boolean) => void };

/**
 * The question before throwing away what someone typed, drawn with the design system. The store
 * calls it; a `confirmDiscard` given to the store replaces it.
 */
function useDiscardDialog(workspace: WorkspaceStore, titleOf: (ref: ResourceRef) => string) {
  const [asking, setAsking] = useState<Asking | null>(null);

  useEffect(() => {
    workspace.setConfirmDiscard(
      (lost) =>
        new Promise<boolean>((resolve) =>
          setAsking({
            names: lost.map(titleOf),
            answer: (ok) => {
              setAsking(null);
              resolve(ok);
            },
          }),
        ),
    );
    return () => workspace.setConfirmDiscard(null);
  }, [workspace, titleOf]);

  return asking;
}

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
  /** Your design over the composer: icons, the peek drawer, the confirm dialog, the notice, or
   *  `styles: false` to drop the default sheet. What is not passed keeps the default. */
  skin?: ComposerSkin;
  /** Below this width (px) of the WORKSPACE it behaves as a phone: one screen, windows and side
   *  panels open as the page, choosers as a sheet (`domain/phone.ts`). `0` never does. */
  phoneBelow?: number;
  /** Offer the workspace to the browser's agent (WebMCP): where am I, open, search, act. Off by
   *  default; without WebMCP in the browser it does nothing. One workspace per page should. */
  agentTools?: boolean;
};

/**
 * Whether the workspace is a phone, measured BEFORE paint: measuring after it drew the desk for a
 * frame and swapped it, and a click in that frame landed on a panel that was going away. A
 * workspace with no width yet (hidden, or not laid out) is not a phone.
 */
function usePhone(root: RefObject<HTMLElement | null>, below: number): boolean {
  const [phone, setPhone] = useState(false);
  useLayoutEffect(() => {
    const el = root.current;
    if (el === null) return;
    const measure = (width: number) => setPhone(width > 0 && width < below);
    measure(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      if (entry !== undefined) measure(entry.contentRect.width);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [root, below]);
  return phone;
}

/** On a phone the panels that were open wait here: one tap brings each to the page. */
function PhoneDock({
  panels,
  titleOf,
  onBring,
}: {
  panels: readonly { id: string; view: ResourceRef }[];
  titleOf: (ref: ResourceRef) => string;
  onBring: (id: string) => void;
}) {
  const copy = composerCopy().phone;
  return (
    <nav aria-label={copy.alsoOpen} className="sc-dock">
      <span className="sc-dock-label">{copy.alsoOpen}</span>
      {panels.map((p) => (
        <ChromeButton key={p.id} onClick={() => onBring(p.id)}>
          {titleOf(p.view)}
        </ChromeButton>
      ))}
    </nav>
  );
}

export function Composer({
  workspace,
  registry,
  empty,
  keyboard = true,
  defaultOpen = Destination.Page,
  palette: paletteProp,
  onPaletteChange,
  skin: skinProp,
  phoneBelow = PHONE_WIDTH,
  agentTools = false,
}: ComposerProps) {
  const skin = useMemo(() => resolveSkin(skinProp), [skinProp]);
  const Drawer = skin.Peek ?? PeekDrawer;
  const Confirm = skin.Confirm ?? ConfirmDialog;
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

  const root = useRef<HTMLDivElement>(null);
  const phone = usePhone(root, phoneBelow);
  /* The API reads it at call time: a view's API is not rebuilt when the window is resized. */
  const phoneNow = useRef(phone);
  useLayoutEffect(() => {
    phoneNow.current = phone;
  }, [phone]);

  const api = useMemo(
    () =>
      createApiFactory(workspace, {
        registry,
        defaultOpen,
        isPhone: () => phoneNow.current,
      }),
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

  const asking = useDiscardDialog(workspace, api.titleOf);

  /** Where a chosen search result opens. Without a page yet, the first one becomes it —
   *  whatever was asked: a peek or a window over nothing would be invisible. */
  function open(ref: ResourceRef, asked: Destination) {
    const destination = phone ? destinationOnPhone(asked) : asked;
    if (workspace.get().page === null) workspace.push(ref);
    else if (destination === Destination.Peek) workspace.peek(ref);
    else if (destination === Destination.Window) workspace.openPanel(ref, Zone.Floating);
    else if (destination === Destination.Side)
      workspace.openPanel(ref, api.zoneFor(registry.resolve(ref)));
    else workspace.push(ref);
  }

  /** An action runs with the API of the surface its resource is on — the page, the peek I am
   *  reading, a panel or a modal — so «audit» can open beside it or navigate it. */
  function run(action: Action) {
    const w = workspace.get();
    const ref = focusedRef(w);
    if (ref === null) return;
    action.run(api.for(ref, targetOf(w.focus)));
  }

  /* The tools call the latest `open` and `run`, which close over the current phone state. */
  const latest = useRef({ open, run });
  useLayoutEffect(() => {
    latest.current = { open, run };
  });
  useEffect(() => {
    if (!agentTools) return;
    return registerAgentTools(
      workspaceTools({
        store: workspace,
        registry,
        titleOf: api.titleOf,
        open: (ref, to) => latest.current.open(ref, to),
        run: (action) => latest.current.run(action),
      }),
    );
  }, [agentTools, workspace, registry, api]);

  const peeked = state.peek;
  const peekModal = modalOver(state, PEEK);
  const peekSpec = peeked === null ? null : registry.resolve(peeked);
  const cameFrom = state.peekTrail.at(-1);

  return (
    <SkinProvider value={skin}>
      <div ref={root} className="sc-root" {...(phone ? { "data-phone": "" } : {})}>
        {skin.styles ? <ComposerStyles /> : null}
        {state.page === null ? (
          <div className="sc-empty">{empty}</div>
        ) : (
          <PanelHost
            workspace={state}
            registry={registry}
            store={workspace}
            api={api}
            phone={phone}
            overlay={
              peeked === null ? null : (
                <>
                  {/* `contents`: no box of its own, so the drawer still lays out against the
                      page; it only hears the pointer, to hand the shortcuts to what is being
                      read. A modal over the drawer covers the page it sits on: the drawer has
                      no frame to hold it. */}
                  <div
                    style={{ display: "contents" }}
                    inert={peekModal !== null}
                    onPointerDownCapture={() => workspace.focusPanel(PEEK)}
                  >
                    <Drawer
                      title={api.titleOf(peeked)}
                      onClose={workspace.closePeek}
                      actions={
                        <>
                          {/* On a phone there is no side to dock it to. */}
                          {phone ? null : (
                            <ChromeButton
                              onClick={() =>
                                workspace.peekToSide(peekSpec?.preferredZone ?? Zone.Right)
                              }
                            >
                              {copy.peek.openAsPanel}
                            </ChromeButton>
                          )}
                          {cameFrom === undefined ? null : (
                            <ChromeButton
                              role="ghost"
                              icon={skin.icons.back}
                              onClick={workspace.peekBack}
                            >
                              {copy.peek.back(api.titleOf(cameFrom))}
                            </ChromeButton>
                          )}
                          <ChromeButton role="ghost" onClick={workspace.peekToPage}>
                            {copy.peek.openAsPage}
                          </ChromeButton>
                        </>
                      }
                    >
                      <ViewHost
                        resource={peeked}
                        registry={registry}
                        api={api.for(peeked, { surface: Surface.Peek })}
                      />
                    </Drawer>
                  </div>
                  {peekModal === null ? null : (
                    <ModalLayer
                      modal={peekModal}
                      registry={registry}
                      store={workspace}
                      api={api}
                      phone={phone}
                    />
                  )}
                </>
              )
            }
          />
        )}

        {phone && state.page !== null && state.panels.length > 0 ? (
          <PhoneDock
            panels={state.panels}
            titleOf={api.titleOf}
            onBring={workspace.expandPanel}
          />
        ) : null}

        <Confirm
          open={asking !== null}
          title={copy.discard.title}
          detail={asking === null ? "" : copy.discard.detail(asking.names)}
          keep={copy.discard.keep}
          discard={copy.discard.discard}
          onAnswer={(ok) => asking?.answer(ok)}
        />

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
    </SkinProvider>
  );
}
