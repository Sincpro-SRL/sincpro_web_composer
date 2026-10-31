import { PAGE, PEEK } from "@sincpro/web-composer/domain/index";
import type { WorkspaceStore } from "@sincpro/web-composer/state/store";
import { useEffect } from "react";

/**
 * Shortcuts talk to the WORKSPACE, not to the browser-focused panel: that focus lives INSIDE the
 * view — almost always in a text field — and the keys belong to it there.
 *
 * Escape is shared by everything on the page: a menu, a search field, a cell being edited. The
 * contract is that whoever consumes it CLAIMS it (`preventDefault`), and the workspace only
 * takes an Escape nobody claimed — otherwise closing a menu inside the peek closed the peek too.
 */

export type UseKeyboardOptions = {
  workspace: WorkspaceStore;
  enabled?: boolean;
  /** ⌘K. Works while typing too: the palette is where you go FROM a field. */
  onPalette?: () => void;
};

/** Inside a field only Escape survives. Stealing a key from someone who is typing is worse than
 *  having no shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function useKeyboard({ workspace, enabled = true, onPalette }: UseKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const state = workspace.get();

      if (e.key === "Escape") {
        if (e.defaultPrevented) return;
        if (state.peek !== null) {
          workspace.closePeek();
          e.preventDefault();
        } else if (state.maximized !== null) {
          workspace.maximize(state.maximized);
          e.preventDefault();
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (onPalette !== undefined && mod && e.code === "KeyK") {
        onPalette();
        e.preventDefault();
        return;
      }

      if (isTyping(e.target)) return;

      if (e.altKey && !mod && e.code === "ArrowLeft") {
        if (state.focus === PEEK && state.peekTrail.length > 0) workspace.peekBack();
        else workspace.back();
        e.preventDefault();
      } else if (mod && e.altKey && (e.code === "BracketLeft" || e.code === "BracketRight")) {
        workspace.cycleFocus(e.code === "BracketRight" ? 1 : -1);
        e.preventDefault();
      } else if (mod && e.shiftKey && e.code === "Enter") {
        workspace.maximize(state.maximized ?? state.focus);
        e.preventDefault();
      } else if (mod && e.shiftKey && e.code === "Backspace" && state.focus !== PAGE) {
        if (state.focus === PEEK) workspace.closePeek();
        else workspace.closePanel(state.focus);
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, workspace, onPalette]);
}
