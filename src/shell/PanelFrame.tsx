import { Zone } from "@sincpro/web-composer/domain/index";
import { type ComposerCopy, composerCopy } from "@sincpro/web-composer/shell/copy";
import { useDraggablePanel } from "@sincpro/web-composer/state/drag";
import { Menu } from "@sincpro/web-ui";
import {
  ArrowUpRight,
  Copy,
  Ellipsis,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PictureInPicture2,
  Square,
  X,
} from "lucide-react";
import { memo, type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from "react";

/**
 * The frame of a side panel or a window. Four icons, always the same, in OS order: more,
 * minimize, enlarge, close. The page has no frame: a list or a record draws its own header.
 */

export type PanelActions = {
  onMove: (zone: Zone) => void;
  onCollapse: () => void;
  /** Grow into the page, keeping where it came from. */
  onExpand: () => void;
  onClose: () => void;
};

const DESTINATIONS = (c: ComposerCopy["panel"]) =>
  [
    { zone: Zone.Left, icon: PanelLeft, label: c.left, hint: c.leftHint },
    { zone: Zone.Right, icon: PanelRight, label: c.right, hint: c.rightHint },
    { zone: Zone.Bottom, icon: PanelBottom, label: c.bottom, hint: c.bottomHint },
    { zone: Zone.Floating, icon: PictureInPicture2, label: c.window, hint: c.windowHint },
  ] as const;

type ControlProps = {
  icon: typeof PanelLeft;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
};

function Control({
  icon: Icon,
  label,
  active = false,
  danger = false,
  onClick,
}: ControlProps) {
  const paint = active
    ? "bg-primary/12 text-primary"
    : danger
      ? "text-muted hover:bg-bad/10 hover:text-bad"
      : "text-muted hover:bg-ink/6 hover:text-ink";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`inline-flex size-(--size-control-sm) shrink-0 items-center justify-center rounded-control transition-colors duration-(--duration-instant) focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary ${paint}`}
    >
      <Icon className="size-(--size-icon-sm)" strokeWidth={2} />
    </button>
  );
}

const MenuAction = { Expand: "expand" } as const;

export type PanelFrameProps = {
  title: string;
  actions: PanelActions;
  zone: Zone;
  maximized: boolean;
  collapsed: boolean;
  focused: boolean;
  /** The id a docked panel is dragged by. A window has none: it moves with the pointer. */
  dragId?: string;
  onMaximize: () => void;
  onFocus: () => void;
  /** Pointer down on the title of a window: the host moves it. */
  onMoveStart?: (e: ReactPointerEvent) => void;
  children: ReactNode;
};

function Frame({
  title,
  actions,
  zone,
  maximized,
  collapsed,
  focused,
  dragId,
  onMaximize,
  onFocus,
  onMoveStart,
  children,
}: PanelFrameProps) {
  const copy = composerCopy().panel;
  const header = useRef<HTMLElement>(null);
  const floating = zone === Zone.Floating;
  const dragging = useDraggablePanel(header, dragId ?? "", dragId !== undefined && !floating);

  return (
    <section
      role="region"
      aria-label={title}
      onPointerDownCapture={onFocus}
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-box border bg-surface transition-[border-color,box-shadow,opacity] duration-(--duration-instant) ${
        focused ? "border-primary/55 ring-1 ring-primary/25" : "border-line-strong"
      } ${floating ? "shadow-window" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <header
        ref={header}
        onPointerDown={floating ? onMoveStart : undefined}
        style={floating ? { touchAction: "none" } : undefined}
        className={`flex shrink-0 items-center gap-0.5 border-b border-line bg-ground py-1 pr-1 pl-2.5 select-none ${
          floating ? "cursor-move" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <span className="min-w-0 flex-1 truncate pr-1 text-micro font-medium text-ink">
          {title}
        </span>

        <div onPointerDown={(e) => e.stopPropagation()}>
          <Menu
            label={copy.more}
            icon={Ellipsis}
            iconOnly
            chevron={false}
            align="end"
            variant="text"
            groups={[
              {
                label: copy.moveTo,
                options: DESTINATIONS(copy).map((d) => ({
                  id: d.zone,
                  label: d.label,
                  hint: d.hint,
                  icon: d.icon,
                  checked: zone === d.zone,
                })),
              },
              {
                options: [{ id: MenuAction.Expand, label: copy.expand, icon: ArrowUpRight }],
              },
            ]}
            onSelect={(id) =>
              id === MenuAction.Expand ? actions.onExpand() : actions.onMove(id as Zone)
            }
          />
        </div>
        <Control
          icon={Minus}
          label={collapsed ? copy.restore : copy.minimize}
          active={collapsed}
          onClick={actions.onCollapse}
        />
        <Control
          icon={maximized ? Copy : Square}
          label={maximized ? copy.restore : copy.enlarge}
          active={maximized}
          onClick={onMaximize}
        />
        <Control icon={X} label={copy.close} danger onClick={actions.onClose} />
      </header>

      {/* `@container` here, not in the view: a view asks for the PANEL width, which is the
          only one that matters with four open on a 1600px screen. */}
      <div hidden={collapsed} className="@container min-h-0 flex-1 overflow-auto">
        {children}
      </div>
    </section>
  );
}

export const PanelFrame = memo(Frame);
