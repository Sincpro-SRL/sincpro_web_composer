import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Zone } from "@sincpro/web-composer/domain/index";
import { type Dock, DragKind, type ResourceRef } from "@sincpro/web-composer/domain/index";
import { type RefObject, useEffect, useState } from "react";

export type DragData =
  | { kind: typeof DragKind.Panel; panelId: string }
  | { kind: typeof DragKind.Ref; ref: ResourceRef };

export type DropData = { kind: typeof DragKind.Zone; zone: Zone };

const isDrag = (
  v: Record<string | symbol, unknown>,
): v is DragData & Record<string, unknown> =>
  v["kind"] === DragKind.Panel || v["kind"] === DragKind.Ref;

/** Only a DOCKED panel is dragged to another edge. A window moves with the pointer, and a native
 *  drag on the same header would swallow that gesture — `enabled` keeps the two apart. */
export function useDraggablePanel(
  ref: RefObject<HTMLElement | null>,
  panelId: string,
  enabled = true,
): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null || !enabled) return;

    return draggable({
      element: el,
      getInitialData: (): DragData & Record<string, unknown> => ({
        kind: DragKind.Panel,
        panelId,
      }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [ref, panelId, enabled]);

  return dragging;
}

export function useDropZone(ref: RefObject<HTMLElement | null>, zone: Dock): boolean {
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    return dropTargetForElements({
      element: el,
      getData: (): DropData & Record<string, unknown> => ({ kind: DragKind.Zone, zone }),
      canDrop: ({ source }) =>
        isDrag(source.data) &&
        (source.data.kind === DragKind.Panel || source.data.kind === DragKind.Ref),
      onDragEnter: () => setOver(true),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    });
  }, [ref, zone]);

  return over;
}

/** Makes an element drag a REFERENCE — a row, a chip — that a zone turns into a panel. */
export function useDraggableRef(
  ref: RefObject<HTMLElement | null>,
  resource: ResourceRef,
): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    return draggable({
      element: el,
      getInitialData: (): DragData & Record<string, unknown> => ({
        kind: DragKind.Ref,
        ref: resource,
      }),
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [ref, resource]);

  return dragging;
}

/** True while a panel or a reference is being dragged. Drop targets must only steal
 *  pointer events then — otherwise they sit on top of “beside” / “floating”
 *  and the buttons never fire. */
export function usePanelDragArmed(): boolean {
  const [armed, setArmed] = useState(false);

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) =>
          isDrag(source.data) &&
          (source.data.kind === DragKind.Panel || source.data.kind === DragKind.Ref),
        onDragStart: () => setArmed(true),
        onDrop: () => setArmed(false),
      }),
    [],
  );

  return armed;
}

export type DropHandlers = {
  onPanelToZone: (panelId: string, zone: Zone) => void;
  onRefToZone: (ref: ResourceRef, zone: Zone) => void;
};

/** One monitor for the whole workspace: drop is ONE event with ONE result.
 *  Split across targets, an overlapping zone and tab would both apply. */
export function useDropMonitor({ onPanelToZone, onRefToZone }: DropHandlers): void {
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isDrag(source.data),
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0];
          if (target === undefined || !isDrag(source.data)) return;

          const data = target.data as unknown as DropData;

          if (source.data.kind === DragKind.Panel && data.kind === DragKind.Zone) {
            onPanelToZone(source.data.panelId, data.zone);
            return;
          }
          if (source.data.kind === DragKind.Ref && data.kind === DragKind.Zone) {
            onRefToZone(source.data.ref, data.zone);
            return;
          }
        },
      }),
    [onPanelToZone, onRefToZone],
  );
}
