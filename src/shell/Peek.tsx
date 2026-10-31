import { composerCopy } from "@sincpro/web-composer/shell/copy";
import type { IconProps } from "@sincpro/web-composer/shell/icons";
import { type ConfirmProps, type PeekProps, useSkin } from "@sincpro/web-composer/shell/skin";
import { type ComponentType, type ReactNode, useEffect, useId, useRef } from "react";

/**
 * The drawer a peek is read in. It does NOT dim or block what is behind it — that is what makes
 * it a peek and not a dialog: the list it came from keeps answering. So it is a landmark
 * (`<aside>`), not a modal:
 *
 * - on open it takes the focus, so a keyboard user does not have to tab through the list;
 * - on close the focus goes back to whatever opened it;
 * - Escape closes it while the focus is inside, and CLAIMS the key (`preventDefault`), so
 *   whatever listens further up does not act on it too.
 */

export function ChromeButton({
  role = "secondary",
  icon: Icon,
  onClick,
  children,
}: {
  role?: "secondary" | "ghost" | "danger";
  icon?: ComponentType<IconProps>;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="sc-button" data-role={role} onClick={onClick}>
      {Icon === undefined ? null : <Icon />}
      {children}
    </button>
  );
}

export function PeekDrawer({ title, onClose, actions, children }: PeekProps) {
  const copy = composerCopy().peek;
  const { close: CloseIcon } = useSkin().icons;
  const box = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement;
    box.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <aside
      ref={box}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="sc-peek"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || e.defaultPrevented) return;
        e.preventDefault();
        onClose();
      }}
    >
      <header className="sc-peek-head">
        <h2 id={titleId} className="sc-peek-title">
          {title}
        </h2>
        <button
          type="button"
          className="sc-control"
          aria-label={copy.close}
          title={copy.close}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>
      {actions === undefined ? null : <div className="sc-peek-actions">{actions}</div>}
      <div className="sc-peek-body">{children}</div>
    </aside>
  );
}

/**
 * The one question the composer asks: discard what was typed? A native modal `<dialog>` —
 * the browser gives it the top layer, the backdrop, the focus trap and the focus on the first
 * button, which is the safe answer.
 */
export function ConfirmDialog({
  open,
  title,
  detail,
  keep,
  discard,
  onAnswer,
}: ConfirmProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (d === null) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="sc-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onAnswer(false);
      }}
    >
      <h2 id={titleId} className="sc-dialog-title">
        {title}
      </h2>
      <p className="sc-dialog-body">{detail}</p>
      <div className="sc-dialog-foot">
        <ChromeButton onClick={() => onAnswer(false)}>{keep}</ChromeButton>
        <ChromeButton role="danger" onClick={() => onAnswer(true)}>
          {discard}
        </ChromeButton>
      </div>
    </dialog>
  );
}
