import {
  Destination,
  type ResourceRef,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { useSkin } from "@sincpro/web-composer/shell/skin";
import { useDraggableRef } from "@sincpro/web-composer/state/drag";
import { type KeyboardEvent, type MouseEvent, type ReactNode, useRef } from "react";

/**
 * The name of a record, wherever it appears — a row, a chip of a many2one, a search result. It
 * is the same control everywhere so people learn it once:
 *
 *   click          the default (the page, unless the caller says `to`)
 *   Space          a peek, without leaving the place
 *   ⇧ click        a panel beside
 *   ⌘ / Ctrl click a window
 *   the icons      every destination by name, for who does not know the keys
 *   drag           to an edge of the workspace: a panel (`draggable={false}` turns it off)
 *
 * The icons appear on hover and on focus, never taking room from the name.
 */

const ICONS = [
  { to: Destination.Peek, icon: "peek", label: "peek" },
  { to: Destination.Side, icon: "right", label: "side" },
  { to: Destination.Window, icon: "window", label: "window" },
] as const;

export type RecordLinkProps = {
  api: WorkspaceApi;
  resource: ResourceRef;
  /** What a plain click does. Without it, the workspace's default. */
  to?: Destination;
  /** Hide the icons — for a dense table where only the keys are wanted. */
  compact?: boolean;
  /** Dragging the name to an edge opens it as a panel. Off inside something that drags itself —
   *  a kanban card, a calendar event: the gesture belongs to the card, not to the name in it. */
  draggable?: boolean;
  children: ReactNode;
};

export function RecordLink({
  api,
  resource,
  to,
  compact = false,
  draggable = true,
  children,
}: RecordLinkProps) {
  const copy = composerCopy().link;
  const icons = useSkin().icons;
  const box = useRef<HTMLSpanElement>(null);
  const dragging = useDraggableRef(box, resource, draggable);

  /* The name sits inside a row that has its own click (open, peek). Whatever this control
     does, the row must not do it too. */
  function onClick(e: MouseEvent) {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) api.open(resource, { to: Destination.Window });
    else if (e.shiftKey) api.open(resource, { to: Destination.Side });
    else api.open(resource, to === undefined ? {} : { to });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== " ") return;
    api.open(resource, { to: Destination.Peek });
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <span ref={box} className="sc-link" data-dragging={dragging ? "" : undefined}>
      <button type="button" onClick={onClick} onKeyDown={onKeyDown} className="sc-link-name">
        {children}
      </button>
      {compact ? null : (
        <span className="sc-link-icons">
          {ICONS.map(({ to: destination, icon, label }) => {
            const Icon = icons[icon];
            return (
              <button
                key={destination}
                type="button"
                aria-label={copy[label]}
                title={copy[label]}
                onClick={(e) => {
                  e.stopPropagation();
                  api.open(resource, { to: destination });
                }}
                className="sc-control"
              >
                <Icon />
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}
