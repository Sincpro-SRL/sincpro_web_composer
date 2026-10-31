import { Zone } from "@sincpro/web-composer/domain/index";
import { type ComposerCopy, composerCopy } from "@sincpro/web-composer/shell/copy";
import type { IconProps } from "@sincpro/web-composer/shell/icons";
import { type SkinIcons, useSkin } from "@sincpro/web-composer/shell/skin";
import { useDraggablePanel } from "@sincpro/web-composer/state/drag";
import {
  type ComponentType,
  type KeyboardEvent,
  memo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * The frame of a side panel or a window. Five controls, always the same: more, open as page,
 * then in OS order minimize, enlarge, close. «Open as page» is out of the menu because it is
 * what a record in a panel is asked for most — every view was drawing its own button for it.
 * The page has no frame: a list or a record draws its own header.
 *
 * Minimized into a narrow strip (`rail`) the title reads vertically and only restore and close
 * remain: there is no room for the rest, and nothing else makes sense until it is restored.
 */

export type PanelActions = {
  onMove: (zone: Zone) => void;
  onCollapse: () => void;
  /** Grow into the page, keeping where it came from. */
  onExpand: () => void;
  onClose: () => void;
};

const DESTINATIONS = (c: ComposerCopy["panel"], icons: SkinIcons) =>
  [
    { zone: Zone.Left, icon: icons.left, label: c.left, hint: c.leftHint },
    { zone: Zone.Right, icon: icons.right, label: c.right, hint: c.rightHint },
    { zone: Zone.Bottom, icon: icons.bottom, label: c.bottom, hint: c.bottomHint },
    { zone: Zone.Floating, icon: icons.window, label: c.window, hint: c.windowHint },
  ] as const;

type ControlProps = {
  icon: ComponentType<IconProps>;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
};

/* `onPointerDown` stops here: a control sits on the header, and the header drags. */
function Control({
  icon: Icon,
  label,
  active = false,
  danger = false,
  onClick,
}: ControlProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="sc-control"
      {...(danger ? { "data-danger": "" } : {})}
    >
      <Icon />
    </button>
  );
}

/**
 * «Move to»: a menu button. Closes on a choice, on a press outside and on Escape — which it
 * CLAIMS, so the workspace does not also close the peek or restore a maximized view.
 */
function MoveMenu({ zone, onMove }: { zone: Zone; onMove: (zone: Zone) => void }) {
  const copy = composerCopy().panel;
  const icons = useSkin().icons;
  const MoreIcon = icons.more;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      box.current?.querySelector<HTMLElement>("button")?.focus();
      return;
    }
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const items = [
      ...(box.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
    ];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + step + items.length) % items.length]?.focus();
  }

  return (
    <div ref={box} onPointerDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="sc-control"
        aria-label={copy.more}
        title={copy.more}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreIcon />
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={copy.moveTo} className="sc-menu">
          <div className="sc-menu-label">{copy.moveTo}</div>
          {DESTINATIONS(copy, icons).map(({ zone: z, icon: Icon, label, hint }) => (
            <button
              key={z}
              type="button"
              role="menuitemradio"
              aria-checked={zone === z}
              className="sc-menu-item"
              onClick={() => {
                setOpen(false);
                onMove(z);
              }}
            >
              <Icon />
              {label}
              <span className="sc-menu-hint">{hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type PanelFrameProps = {
  title: string;
  actions: PanelActions;
  zone: Zone;
  maximized: boolean;
  collapsed: boolean;
  /** Minimized into a narrow strip: the title is drawn vertically. */
  rail?: boolean;
  focused: boolean;
  /** The id a docked panel is dragged by. A window has none: it moves with the pointer. */
  dragId?: string;
  onMaximize: () => void;
  onFocus: () => void;
  /** Pointer down on the title of a window: the host moves it. */
  onMoveStart?: (e: ReactPointerEvent) => void;
  /** A modal over this panel's view. It blocks the view only: the header still moves, minimizes
   *  and closes the panel. */
  modal?: ReactNode;
  children: ReactNode;
};

function Frame({
  title,
  actions,
  zone,
  maximized,
  collapsed,
  rail = false,
  focused,
  dragId,
  onMaximize,
  onFocus,
  onMoveStart,
  modal,
  children,
}: PanelFrameProps) {
  const copy = composerCopy().panel;
  const icons = useSkin().icons;
  const header = useRef<HTMLElement>(null);
  const floating = zone === Zone.Floating;
  const dragging = useDraggablePanel(header, dragId ?? "", dragId !== undefined && !floating);
  const flag = (on: boolean) => (on ? "" : undefined);

  return (
    <section
      role="region"
      aria-label={title}
      onPointerDownCapture={onFocus}
      className="sc-frame"
      data-focused={flag(focused)}
      data-floating={flag(floating)}
      data-dragging={flag(dragging)}
    >
      {rail ? (
        <header ref={header} className="sc-header" data-rail="">
          <Control
            icon={icons.minimize}
            label={copy.restore}
            active
            onClick={actions.onCollapse}
          />
          <span className="sc-title">{title}</span>
          <Control icon={icons.close} label={copy.close} danger onClick={actions.onClose} />
        </header>
      ) : (
        <header
          ref={header}
          className="sc-header"
          data-floating={flag(floating)}
          onPointerDown={floating ? onMoveStart : undefined}
        >
          <span className="sc-title">{title}</span>
          <MoveMenu zone={zone} onMove={actions.onMove} />
          <Control icon={icons.expand} label={copy.expand} onClick={actions.onExpand} />
          <Control
            icon={icons.minimize}
            label={collapsed ? copy.restore : copy.minimize}
            active={collapsed}
            onClick={actions.onCollapse}
          />
          <Control
            icon={maximized ? icons.restore : icons.maximize}
            label={maximized ? copy.restore : copy.enlarge}
            active={maximized}
            onClick={onMaximize}
          />
          <Control icon={icons.close} label={copy.close} danger onClick={actions.onClose} />
        </header>
      )}

      {/* A container here, not in the view: a view asks for the PANEL width, which is the
          only one that matters with four open on a 1600px screen. */}
      <div hidden={collapsed} className="sc-body-wrap">
        <div inert={modal !== undefined && modal !== null} className="sc-body">
          {children}
        </div>
        {modal}
      </div>
    </section>
  );
}

export const PanelFrame = memo(Frame);
