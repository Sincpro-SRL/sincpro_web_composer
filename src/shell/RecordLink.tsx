import {
  Destination,
  type ResourceRef,
  type WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { useDraggableRef } from "@sincpro/web-composer/state/drag";
import { AppWindow, Eye, PanelRight } from "lucide-react";
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
 *   drag           to an edge of the workspace: a panel
 *
 * The icons appear on hover and on focus, never taking room from the name.
 */

const ICONS = [
  { to: Destination.Peek, icon: Eye, label: "peek" },
  { to: Destination.Side, icon: PanelRight, label: "side" },
  { to: Destination.Window, icon: AppWindow, label: "window" },
] as const;

export type RecordLinkProps = {
  api: WorkspaceApi;
  resource: ResourceRef;
  /** What a plain click does. Without it, the workspace's default. */
  to?: Destination;
  /** Hide the icons — for a dense table where only the keys are wanted. */
  compact?: boolean;
  children: ReactNode;
};

export function RecordLink({
  api,
  resource,
  to,
  compact = false,
  children,
}: RecordLinkProps) {
  const copy = composerCopy().link;
  const box = useRef<HTMLSpanElement>(null);
  const dragging = useDraggableRef(box, resource);

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
    <span
      ref={box}
      className={`group/link inline-flex min-w-0 items-center gap-1 ${dragging ? "opacity-40" : ""}`}
    >
      <button
        type="button"
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="min-w-0 cursor-pointer truncate rounded-mark text-left text-primary hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {children}
      </button>
      {compact ? null : (
        <span className="inline-flex shrink-0 items-center opacity-0 transition-opacity duration-(--duration-instant) group-focus-within/link:opacity-100 group-hover/link:opacity-100">
          {ICONS.map(({ to: destination, icon: Icon, label }) => (
            <button
              key={destination}
              type="button"
              aria-label={copy[label]}
              title={copy[label]}
              onClick={(e) => {
                e.stopPropagation();
                api.open(resource, { to: destination });
              }}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon className="size-(--size-icon-sm)" strokeWidth={2} aria-hidden />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
