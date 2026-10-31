import {
  type Modal,
  modalId,
  type Registry,
  Surface,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { type ModalProps, useSkin } from "@sincpro/web-composer/shell/skin";
import { ViewHost } from "@sincpro/web-composer/shell/ViewHost";
import type { ApiFactory } from "@sincpro/web-composer/state/api";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * The composer's own modal: a small window centred over the surface that asked for it — on a
 * phone, a sheet from the bottom. It moves
 * by its title — what is underneath may be what the person needs to read to answer — but never
 * further than its surface: it belongs to it, and leaving it would cover a neighbour that is
 * not blocked. It does not dim the rest of the workspace; that is the point of it.
 */

/** How much of the window must stay inside its surface, so it can always be grabbed back. */
const KEEP_VISIBLE = 48;

type Offset = { x: number; y: number };

/** Follows the pointer until it is released, on `window`: leaving the title does not drop the
 *  gesture. */
function useMoveByTitle(box: RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  function start(e: ReactPointerEvent) {
    const el = box.current;
    const layer = el?.parentElement?.getBoundingClientRect();
    if (el === null || layer === undefined || e.button !== 0) return;
    e.preventDefault();

    const from = { x: e.clientX, y: e.clientY };
    const origin = offset;
    const rect = el.getBoundingClientRect();
    /* Where the window is with no offset, so the limits are absolute and not cumulative. */
    const base = { left: rect.left - origin.x, top: rect.top - origin.y };

    const onMove = (ev: PointerEvent) => {
      const left = base.left + origin.x + ev.clientX - from.x;
      const top = base.top + origin.y + ev.clientY - from.y;
      const x = Math.max(
        layer.left - rect.width + KEEP_VISIBLE,
        Math.min(left, layer.right - KEEP_VISIBLE),
      );
      const y = Math.max(layer.top, Math.min(top, layer.bottom - KEEP_VISIBLE));
      setOffset({ x: x - base.left, y: y - base.top });
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  return { offset, start };
}

export function ModalWindow({ title, blur, size, phone, onClose, children }: ModalProps) {
  const copy = composerCopy().modal;
  const { close: CloseIcon } = useSkin().icons;
  const box = useRef<HTMLElement>(null);
  const titleId = useId();
  const { offset, start } = useMoveByTitle(box);

  useEffect(() => {
    const opener = document.activeElement;
    box.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <div
      className="sc-modal-scrim"
      {...(blur ? { "data-blur": "" } : {})}
      {...(phone ? { "data-phone": "" } : {})}
    >
      <section
        ref={box}
        role="dialog"
        tabIndex={-1}
        aria-labelledby={titleId}
        className="sc-modal"
        style={
          phone
            ? undefined
            : {
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                ...(size === undefined ? {} : { width: size.w, height: size.h }),
              }
        }
        onKeyDown={(e) => {
          if (e.key !== "Escape" || e.defaultPrevented) return;
          e.preventDefault();
          onClose();
        }}
      >
        {/* On a phone it is a sheet from the bottom: it does not move. */}
        <header className="sc-modal-head" onPointerDown={phone ? undefined : start}>
          <h2 id={titleId} className="sc-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="sc-control"
            aria-label={copy.close}
            title={copy.close}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="sc-modal-body">{children}</div>
      </section>
    </div>
  );
}

export type ModalLayerProps = {
  modal: Modal;
  registry: Registry;
  store: WorkspaceStore;
  api: ApiFactory;
  /** Geometry only: where the host is, when the layer is not already inside it. */
  style?: CSSProperties;
  phone?: boolean;
};

/** Where a modal stands: over its host's box, taking the workspace focus when touched. The skin
 *  draws what is inside it. */
export function ModalLayer({
  modal,
  registry,
  store,
  api,
  style,
  phone = false,
}: ModalLayerProps) {
  const Window = useSkin().Modal ?? ModalWindow;
  const { host, view } = modal;

  return (
    <div
      className="sc-modal-layer"
      {...(style === undefined ? {} : { style })}
      onPointerDownCapture={() => store.focusPanel(modalId(host))}
    >
      <Window
        title={api.titleOf(view)}
        blur={modal.blur}
        {...(modal.size === undefined ? {} : { size: modal.size })}
        phone={phone}
        onClose={() => store.closeModal(host)}
      >
        <ViewHost
          resource={view}
          registry={registry}
          api={api.for(view, { surface: Surface.Modal, host })}
        />
      </Window>
    </div>
  );
}
