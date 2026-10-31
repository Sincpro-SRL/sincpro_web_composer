import {
  Axis,
  type Box,
  type Handle,
  HandleKind,
  handles,
  KEYBOARD_STEP,
  layout,
  type Length,
  PAGE,
  type Registry,
  sizeAt,
  type Slot,
  stableOrder,
  Surface,
  type Workspace,
  Zone,
} from "@sincpro/web-composer/domain/index";
import { type ComposerCopy, composerCopy } from "@sincpro/web-composer/shell/copy";
import { PanelFrame } from "@sincpro/web-composer/shell/PanelFrame";
import { ViewHost } from "@sincpro/web-composer/shell/ViewHost";
import type { ApiFactory } from "@sincpro/web-composer/state/api";
import { useDropZone, usePanelDragArmed } from "@sincpro/web-composer/state/drag";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
} from "react";

/**
 * Every surface is a sibling on one layer, ordered by id, positioned with CSS. Changing zone
 * only changes its box: React keeps the node, and with it its scroll, filter, and typed input.
 * Nesting containers per zone would unmount it on every move.
 *
 * Each surface is its own stacking context (`isolate`): a list's sticky bar carries a z-index,
 * and without the boundary it painted OVER the windows — covering their title, so they could
 * not be grabbed.
 */

export type PanelHostProps = {
  workspace: Workspace;
  /** Drawn over the PAGE only — the peek. Anchored to the page's box, it reads beside the list
   *  it came from and never covers the panels docked around it. */
  overlay?: ReactNode;
  registry: Registry;
  store: WorkspaceStore;
  api: ApiFactory;
};

const HANDLE_THICKNESS = 9;
/** A window never gets smaller than this: below it the controls overlap. */
const MIN_WINDOW = { w: 280, h: 160 };
/** How much of a window must stay inside the host, so it can always be grabbed back. */
const KEEP_VISIBLE = 80;

/** A share of the host plus pixels, as CSS. `calc()` only when both are there. */
function css({ fr, px }: Length, nudge = 0): string {
  const pixels = px + nudge;
  if (pixels === 0) return `${fr * 100}%`;
  if (fr === 0) return `${pixels}px`;
  return `calc(${fr * 100}% + ${pixels}px)`;
}

function boxStyle(box: Box): CSSProperties {
  return {
    left: css(box.left),
    top: css(box.top),
    width: css(box.width),
    height: css(box.height),
  };
}

const WHOLE: Box = {
  left: { fr: 0, px: 0 },
  top: { fr: 0, px: 0 },
  width: { fr: 1, px: 0 },
  height: { fr: 1, px: 0 },
};

/** Padding of a docked slot. A strip keeps it only across: along, its 36 px are the header. */
const slotPadding = (slot: Slot) =>
  slot.floating ? undefined : slot.rail ? "y" : slot.collapsed ? "x" : "all";

/**
 * A drag that follows the pointer until it is released, wherever it goes. The listeners live on
 * `window`, so leaving the header — or the iframe — does not drop the gesture; pointer capture is
 * only a bonus, because Chrome refuses it for a pointer it no longer tracks («No active pointer
 * with the given id») and a refusal must not cancel the move — that was the window that would
 * not budge.
 */
function useDrag(hostRef: RefObject<HTMLDivElement | null>) {
  return useCallback(
    (e: ReactPointerEvent, move: (host: DOMRect, ev: PointerEvent) => void) => {
      const host = hostRef.current?.getBoundingClientRect();
      if (host === undefined || e.button !== 0) return;
      e.preventDefault();

      const target = e.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* Not captured: the window listeners below still follow the pointer. */
      }

      const onMove = (ev: PointerEvent) => move(host, ev);
      const stop = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        window.removeEventListener("blur", stop);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      window.addEventListener("blur", stop);
    },
    [hostRef],
  );
}

const handleLabel = (handle: Handle, copy: ComposerCopy["panel"]) =>
  handle.kind === HandleKind.Zone ? copy.resizeZone(handle.zone) : copy.resizeBetween;

function ResizeHandle({
  handle,
  value,
  onDrag,
  onStep,
}: {
  handle: Handle;
  value: number;
  onDrag: (e: ReactPointerEvent, handle: Handle) => void;
  onStep: (handle: Handle, delta: number) => void;
}) {
  const horizontal = handle.axis === Axis.X;
  const copy = composerCopy().panel;

  function onKeyDown(e: React.KeyboardEvent) {
    const minus = horizontal ? "ArrowLeft" : "ArrowUp";
    const plus = horizontal ? "ArrowRight" : "ArrowDown";
    if (e.key !== minus && e.key !== plus) return;
    e.preventDefault();
    onStep(handle, (e.key === plus ? 1 : -1) * (handle.invert ? -1 : 1) * KEYBOARD_STEP);
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label={handleLabel(handle, copy)}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => onDrag(e, handle)}
      onKeyDown={onKeyDown}
      style={
        horizontal
          ? {
              left: css(handle.at, -HANDLE_THICKNESS / 2),
              top: 0,
              width: HANDLE_THICKNESS,
              height: "100%",
            }
          : {
              top: css(handle.at, -HANDLE_THICKNESS / 2),
              left: 0,
              height: HANDLE_THICKNESS,
              width: "100%",
            }
      }
      className="sc-handle"
      data-axis={handle.axis}
    />
  );
}

/** The three grips of a window: right edge, bottom edge, and the corner. */
const GRIPS = [
  { id: "e", dx: 1, dy: 0 },
  { id: "s", dx: 0, dy: 1 },
  { id: "se", dx: 1, dy: 1 },
] as const;

function ZoneDropTarget({
  zone,
  style,
  label,
  armed,
}: {
  zone: Exclude<Zone, typeof Zone.Floating>;
  style: CSSProperties;
  label: string;
  armed: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const over = useDropZone(box, zone);

  return (
    <div
      ref={box}
      aria-hidden
      style={style}
      className="sc-drop"
      data-armed={armed ? "" : undefined}
      data-over={over ? "" : undefined}
    >
      {over ? label : null}
    </div>
  );
}

/** Targets cover the container edges, not the live zone boxes — dropping «to the left» has to
 *  work even when that zone has no panel yet. */
const DROP_ZONES = [
  {
    zone: Zone.Left,
    label: "dropLeft",
    style: { left: 0, top: 0, width: "24%", height: "100%" },
  },
  {
    zone: Zone.Right,
    label: "dropRight",
    style: { right: 0, top: 0, width: "24%", height: "100%" },
  },
  {
    zone: Zone.Bottom,
    label: "dropBottom",
    style: { left: "24%", right: "24%", bottom: 0, height: "30%" },
  },
] as const;

export function PanelHost({ workspace, overlay, registry, store, api }: PanelHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useDrag(hostRef);
  const dropArmed = usePanelDragArmed();
  const copy = composerCopy().panel;

  const slots = layout(workspace);
  const resizeHandles = handles(workspace);

  const valueOf = (handle: Handle): number => {
    if (handle.kind === HandleKind.Zone) return workspace.zones[handle.zone];
    const panel = workspace.panels.find((p) => p.id === handle.panelId);
    return panel !== undefined && panel.placement.zone !== Zone.Floating
      ? panel.placement.share
      : 0;
  };

  const applyHandle = (handle: Handle, value: number) => {
    if (handle.kind === HandleKind.Zone) store.resizeZone(handle.zone, value);
    else store.resizePanel(handle.panelId, value);
  };

  function moveWindow(e: ReactPointerEvent, slot: Slot) {
    if (!slot.floating) return;
    const [left, top, width] = [slot.box.left.px, slot.box.top.px, slot.box.width.px];
    const start = { x: e.clientX, y: e.clientY };

    store.raisePanel(slot.id);
    drag(e, (host, ev) => {
      store.floatPanel(slot.id, {
        x: Math.max(
          KEEP_VISIBLE - width,
          Math.min(left + ev.clientX - start.x, host.width - KEEP_VISIBLE),
        ),
        y: Math.max(0, Math.min(top + ev.clientY - start.y, host.height - KEEP_VISIBLE / 2)),
      });
    });
  }

  function resizeWindow(e: ReactPointerEvent, slot: Slot, dx: number, dy: number) {
    if (!slot.floating) return;
    const [width, height] = [slot.box.width.px, slot.box.height.px];
    const start = { x: e.clientX, y: e.clientY };

    e.stopPropagation();
    drag(e, (_host, ev) => {
      store.floatPanel(slot.id, {
        ...(dx === 0 ? {} : { w: Math.max(MIN_WINDOW.w, width + ev.clientX - start.x) }),
        ...(dy === 0 ? {} : { h: Math.max(MIN_WINDOW.h, height + ev.clientY - start.y) }),
      });
    });
  }

  function moveHandle(e: ReactPointerEvent, handle: Handle) {
    drag(e, (host, ev) => {
      const [p, size] =
        handle.axis === Axis.X
          ? [ev.clientX - host.left, host.width]
          : [ev.clientY - host.top, host.height];
      applyHandle(handle, sizeAt(handle, p, size));
    });
  }

  return (
    <div ref={hostRef} className="sc-host">
      {stableOrder(slots).map((slot) => {
        const isPage = slot.id === PAGE;
        const style = {
          ...boxStyle(slot.box),
          ...(slot.floating ? { zIndex: 20 + slot.z } : {}),
        };

        if (isPage) {
          return (
            <div
              key={slot.id}
              hidden={!slot.visible}
              style={style}
              onPointerDownCapture={() => store.focusPanel(PAGE)}
              className="sc-slot"
              data-page=""
            >
              <ViewHost
                resource={slot.view}
                registry={registry}
                api={api.for(slot.view, { surface: Surface.Page })}
              />
            </div>
          );
        }

        const zone = slot.panel?.placement.zone ?? Zone.Right;
        return (
          <div
            key={slot.id}
            hidden={!slot.visible}
            style={style}
            className="sc-slot"
            data-pad={slotPadding(slot)}
          >
            <PanelFrame
              title={api.titleOf(slot.view)}
              zone={zone}
              collapsed={slot.collapsed}
              rail={slot.rail}
              focused={workspace.focus === slot.id}
              maximized={workspace.maximized === slot.id}
              {...(slot.floating ? {} : { dragId: slot.id })}
              onMaximize={() => store.maximize(slot.id)}
              onFocus={() => store.focusPanel(slot.id)}
              onMoveStart={(e) => moveWindow(e, slot)}
              actions={{
                onMove: (z) => store.movePanel(slot.id, z),
                onCollapse: () => store.collapsePanel(slot.id),
                onExpand: () => store.expandPanel(slot.id),
                onClose: () => store.closePanel(slot.id),
              }}
            >
              <ViewHost
                resource={slot.view}
                registry={registry}
                api={api.for(slot.view, { surface: Surface.Panel, panelId: slot.id })}
              />
            </PanelFrame>

            {slot.floating && !slot.collapsed
              ? GRIPS.map((grip) => (
                  <div
                    key={grip.id}
                    aria-hidden
                    onPointerDown={(e) => resizeWindow(e, slot, grip.dx, grip.dy)}
                    className="sc-grip"
                    data-grip={grip.id}
                  />
                ))
              : null}
          </div>
        );
      })}

      {overlay === undefined || overlay === null ? null : (
        <div
          style={boxStyle(
            slots.find((slot) => slot.id === PAGE && slot.visible)?.box ?? WHOLE,
          )}
          className="sc-overlay"
        >
          {overlay}
        </div>
      )}

      <div className="sc-drops">
        {DROP_ZONES.map((b) => (
          <ZoneDropTarget
            key={b.zone}
            zone={b.zone}
            label={copy[b.label]}
            style={b.style}
            armed={dropArmed}
          />
        ))}
      </div>

      {resizeHandles.map((handle) => (
        <ResizeHandle
          key={handle.kind === HandleKind.Zone ? `z:${handle.zone}` : `p:${handle.panelId}`}
          handle={handle}
          value={valueOf(handle)}
          onDrag={moveHandle}
          onStep={(h, delta) => applyHandle(h, valueOf(h) + delta)}
        />
      ))}
    </div>
  );
}
