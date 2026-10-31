/**
 * The composer's own skin: the frames, the drawer, the modal, the rail, the dialog and ⌘K, with no design
 * system behind it. It is the minimum that makes the windows usable — the views inside them are
 * the application's, drawn with whatever it uses.
 *
 * Every color, radius and shadow is a CSS variable with a default, so an application themes it
 * from anywhere above the workspace (`:root` included) without a stylesheet of its own:
 *
 *     :root {
 *       --sc-surface: var(--my-surface);
 *       --sc-accent: var(--my-brand);
 *     }
 *
 * The classes (`sc-*`) are stable: they are how a skin is overridden. The sheet is a React 19
 * `<style href precedence>`: hoisted to <head> and drawn once however many workspaces there are,
 * so nothing has to be imported.
 */

const CSS = `
.sc-root {
  --_ground: var(--sc-ground, light-dark(#f6f6f4, #161615));
  --_surface: var(--sc-surface, light-dark(#ffffff, #1f1f1d));
  --_line: var(--sc-line, light-dark(#e4e3df, #2f2f2c));
  --_line-strong: var(--sc-line-strong, light-dark(#cfcdc7, #44433f));
  --_ink: var(--sc-ink, light-dark(#1d1d1b, #ecebe7));
  --_muted: var(--sc-muted, light-dark(#6b6a66, #a3a29d));
  --_accent: var(--sc-accent, light-dark(#2b4a8b, #8fb0f0));
  --_danger: var(--sc-danger, light-dark(#b3261e, #f2958e));
  --_on-danger: var(--sc-on-danger, #ffffff);
  --_scrim: var(--sc-scrim, rgb(0 0 0 / 0.32));
  --_shadow: var(--sc-shadow, 0 10px 30px rgb(0 0 0 / 0.16));
  --_radius: var(--sc-radius, 8px);
  --_radius-control: var(--sc-radius-control, 6px);
  --_text: var(--sc-text, 13px);
  --_text-small: var(--sc-text-small, 12px);
  /* Every glyph the composer places — its own or the application's — is drawn at this size. */
  --_icon: var(--sc-icon, 14px);
  --_modal-scrim: var(--sc-modal-scrim, rgb(0 0 0 / 0.14));
  --_modal-blur: var(--sc-modal-blur, 3px);
  --_tint: color-mix(in srgb, var(--_accent) 10%, transparent);
  --_hover: color-mix(in srgb, var(--_ink) 7%, transparent);

  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  background: var(--_ground);
  color: var(--_ink);
  font-size: var(--_text);
}
.sc-root *, .sc-root *::before, .sc-root *::after { box-sizing: border-box; }
.sc-root :focus-visible { outline: 2px solid var(--_accent); outline-offset: 1px; }
.sc-root :is(.sc-control, .sc-button, .sc-menu-item, .sc-palette-search, .sc-option-icon) svg {
  flex-shrink: 0; width: var(--_icon); height: var(--_icon);
}
.sc-root .sc-link-icons .sc-control svg { width: calc(var(--_icon) - 2px); height: calc(var(--_icon) - 2px); }

.sc-empty { display: flex; flex: 1; min-height: 0; align-items: center; justify-content: center; padding: 32px; }
.sc-host { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.sc-slot { position: absolute; isolation: isolate; min-height: 0; }
.sc-slot[data-page] { overflow: auto; }
.sc-slot[data-pad="all"] { padding: 4px; }
.sc-slot[data-pad="x"] { padding: 0 4px; }
.sc-slot[data-pad="y"] { padding: 4px 0; }

.sc-frame {
  display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0;
  overflow: hidden; background: var(--_surface);
  border: 1px solid var(--_line-strong); border-radius: var(--_radius);
}
.sc-frame[data-focused] { border-color: var(--_accent); box-shadow: 0 0 0 1px var(--_tint); }
.sc-frame[data-floating] { box-shadow: var(--_shadow); }
.sc-frame[data-dragging] { opacity: 0.4; }

.sc-header {
  position: relative; display: flex; flex-shrink: 0; align-items: center; gap: 2px;
  height: 34px; padding: 0 3px 0 10px; background: var(--_ground);
  border-bottom: 1px solid var(--_line); user-select: none; cursor: grab;
}
.sc-header[data-floating] { cursor: move; touch-action: none; }
.sc-header[data-rail] {
  flex: 1; flex-direction: column; height: auto; padding: 3px 0; border-bottom: 0;
}
.sc-title {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--_text-small); font-weight: 500;
}
.sc-header[data-rail] .sc-title { min-height: 0; padding: 4px 0; writing-mode: vertical-rl; }
.sc-body-wrap { position: relative; display: flex; flex: 1; flex-direction: column; min-height: 0; }
.sc-body { flex: 1; min-height: 0; overflow: auto; container-type: inline-size; }

.sc-control {
  display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: var(--_radius-control);
  background: transparent; color: var(--_muted); cursor: pointer;
}
.sc-control:hover { background: var(--_hover); color: var(--_ink); }
.sc-control[aria-pressed="true"], .sc-control[aria-expanded="true"] { background: var(--_tint); color: var(--_accent); }
.sc-control[data-danger]:hover { color: var(--_danger); }

.sc-menu {
  position: absolute; top: calc(100% + 2px); right: 4px; z-index: 50; min-width: 220px;
  margin: 0; padding: 4px; list-style: none; background: var(--_surface);
  border: 1px solid var(--_line-strong); border-radius: var(--_radius); box-shadow: var(--_shadow);
  cursor: default;
}
.sc-menu-label { padding: 6px 8px 2px; color: var(--_muted); font-size: var(--_text-small); }
.sc-menu-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 6px 8px;
  border: 0; border-radius: var(--_radius-control); background: transparent;
  color: var(--_ink); font: inherit; text-align: left; cursor: pointer;
}
.sc-menu-item:hover, .sc-menu-item:focus { background: var(--_hover); outline: 0; }
.sc-menu-item[aria-checked="true"] { color: var(--_accent); font-weight: 600; }
.sc-menu-hint { margin-left: auto; color: var(--_muted); font-size: var(--_text-small); font-weight: 400; }

.sc-handle { position: absolute; z-index: 10; transition: background-color 80ms; touch-action: none; }
.sc-handle[data-axis="x"] { cursor: col-resize; }
.sc-handle[data-axis="y"] { cursor: row-resize; }
.sc-handle:hover { background: color-mix(in srgb, var(--_accent) 25%, transparent); }
.sc-root .sc-handle:focus-visible { background: color-mix(in srgb, var(--_accent) 35%, transparent); outline: 0; }

.sc-grip { position: absolute; z-index: 10; touch-action: none; }
.sc-grip[data-grip="e"] { top: 0; right: 0; width: 8px; height: 100%; cursor: e-resize; }
.sc-grip[data-grip="s"] { bottom: 0; left: 0; width: 100%; height: 8px; cursor: s-resize; }
.sc-grip[data-grip="se"] { right: 0; bottom: 0; width: 16px; height: 16px; cursor: se-resize; }

.sc-drops { position: absolute; inset: 0; pointer-events: none; }
.sc-drop {
  position: absolute; z-index: 30; display: flex; align-items: center; justify-content: center;
  border: 2px dashed transparent; border-radius: var(--_radius); pointer-events: none;
  color: var(--_accent); font-size: var(--_text-small); font-weight: 500;
}
.sc-drop[data-armed] { pointer-events: auto; }
.sc-drop[data-over] { border-color: var(--_accent); background: var(--_tint); }

.sc-overlay { position: absolute; z-index: 40; pointer-events: none; }
.sc-overlay > * { pointer-events: auto; }

.sc-peek {
  position: absolute; top: 0; right: 0; bottom: 0; z-index: 30;
  display: flex; flex-direction: column; width: min(30rem, 100%); overflow: hidden;
  background: var(--_surface); border-left: 1px solid var(--_line-strong);
  border-radius: var(--_radius) 0 0 var(--_radius); box-shadow: var(--_shadow); outline: 0;
}
.sc-peek-head { display: flex; flex-shrink: 0; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-bottom: 1px solid var(--_line); }
.sc-peek-title {
  flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--_text); font-weight: 600;
}
.sc-peek-actions { display: flex; flex-shrink: 0; flex-wrap: wrap; gap: 6px; padding: 6px 12px; border-bottom: 1px solid var(--_line); }
.sc-peek-body { flex: 1; min-height: 0; overflow: auto; padding: 12px; container-type: inline-size; }

.sc-modal-layer { position: absolute; inset: 0; z-index: 1; }
.sc-overlay > .sc-modal-layer { z-index: 31; }
.sc-modal-scrim {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 12px; overflow: hidden; background: var(--_modal-scrim);
}
.sc-modal-scrim[data-blur] { backdrop-filter: blur(var(--_modal-blur)); }
.sc-modal {
  position: relative; display: flex; flex-direction: column; width: min(28rem, 100%); max-width: 100%; max-height: 100%;
  overflow: hidden; background: var(--_surface); border: 1px solid var(--_line-strong);
  border-radius: var(--_radius); box-shadow: var(--_shadow); outline: 0;
}
.sc-modal-head {
  display: flex; flex-shrink: 0; align-items: center; gap: 8px; height: 34px; padding: 0 3px 0 12px;
  background: var(--_ground); border-bottom: 1px solid var(--_line);
  cursor: move; user-select: none; touch-action: none;
}
.sc-modal-title {
  flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--_text-small); font-weight: 600;
}
.sc-modal-body { flex: 1; min-height: 0; overflow: auto; container-type: inline-size; }

/* A phone: one screen. The drawer is the screen's width, the modal a sheet from the bottom. */
.sc-root[data-phone] .sc-peek { width: 100%; border-left: 0; border-radius: 0; }
.sc-modal-scrim[data-phone] { align-items: flex-end; padding: 0; }
.sc-modal-scrim[data-phone] .sc-modal {
  width: 100%; max-height: 90%; border-bottom: 0;
  border-radius: var(--_radius) var(--_radius) 0 0;
}
.sc-modal-scrim[data-phone] .sc-modal-head { cursor: default; }
.sc-dock {
  display: flex; flex-shrink: 0; align-items: center; gap: 6px; padding: 6px 8px;
  overflow-x: auto; background: var(--_ground); border-top: 1px solid var(--_line);
}
.sc-dock-label { flex-shrink: 0; color: var(--_muted); font-size: var(--_text-small); }

.sc-button {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px;
  border: 1px solid var(--_line-strong); border-radius: var(--_radius-control);
  background: var(--_surface); color: var(--_ink); font: inherit; font-size: var(--_text-small);
  font-weight: 500; white-space: nowrap; cursor: pointer;
}
.sc-button:hover { background: var(--_hover); }
.sc-button[data-role="ghost"] { border-color: transparent; background: transparent; color: var(--_accent); }
.sc-button[data-role="ghost"]:hover { background: var(--_tint); }
.sc-button[data-role="danger"] { border-color: var(--_danger); background: var(--_danger); color: var(--_on-danger); }

.sc-dialog {
  width: min(26rem, calc(100% - 32px)); padding: 0; border: 0; border-radius: var(--_radius);
  background: var(--_surface); color: var(--_ink); box-shadow: var(--_shadow);
}
.sc-dialog::backdrop { background: var(--_scrim); }
.sc-dialog-title { margin: 0; padding: 16px 16px 0; font-size: 16px; font-weight: 600; }
.sc-dialog-body { margin: 0; padding: 10px 16px 16px; color: var(--_muted); }
.sc-dialog-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--_line); background: var(--_ground); }

.sc-notice { padding: 24px; color: var(--_muted); text-align: center; }
.sc-notice strong { display: block; margin-bottom: 4px; color: var(--_ink); }
.sc-notice[data-tone="bad"] strong { color: var(--_danger); }
.sc-notice code { font-size: var(--_text-small); }
.sc-loading { padding: 16px; color: var(--_muted); font-size: var(--_text-small); }

.sc-scrim {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-start;
  justify-content: center; padding: 96px 16px 0; background: var(--_scrim);
}
.sc-palette {
  width: 100%; max-width: 36rem; overflow: hidden; background: var(--_surface);
  border: 1px solid var(--_line-strong); border-radius: var(--_radius); box-shadow: var(--_shadow);
}
.sc-palette-search { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-bottom: 1px solid var(--_line); color: var(--_muted); }
.sc-palette-search input {
  flex: 1; min-width: 0; height: 44px; border: 0; background: transparent; color: var(--_ink);
  font: inherit; font-size: 14px;
}
.sc-palette-search input:focus { outline: 0; }
.sc-palette-list { max-height: 24rem; margin: 0; padding: 4px; overflow-y: auto; list-style: none; }
.sc-palette-section { margin: 0; padding: 8px 8px 4px; color: var(--_muted); font-size: var(--_text-small); font-weight: 500; }
.sc-option { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--_radius-control); cursor: default; }
.sc-option[aria-selected="true"] { background: var(--_tint); }
.sc-option-icon { display: flex; flex-shrink: 0; width: 16px; justify-content: center; color: var(--_muted); }
.sc-option-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-option-detail { flex-shrink: 0; color: var(--_muted); font-size: var(--_text-small); }
.sc-kbd { flex-shrink: 0; padding: 0 6px; border: 1px solid var(--_line); border-radius: var(--_radius-control); color: var(--_muted); font-size: var(--_text-small); }
.sc-palette-empty { padding: 24px 12px; color: var(--_muted); font-style: italic; text-align: center; }
.sc-palette-hint { margin: 0; padding: 6px 12px; border-top: 1px solid var(--_line); color: var(--_muted); font-size: var(--_text-small); }

.sc-link { display: inline-flex; min-width: 0; align-items: center; gap: 4px; }
.sc-link[data-dragging] { opacity: 0.4; }
.sc-link-name {
  min-width: 0; padding: 0; overflow: hidden; border: 0; background: transparent;
  color: var(--_accent); font: inherit; text-align: left; text-overflow: ellipsis;
  white-space: nowrap; cursor: pointer;
}
.sc-link-name:hover { text-decoration: underline; text-underline-offset: 4px; }
.sc-link-icons { display: inline-flex; flex-shrink: 0; opacity: 0; transition: opacity 80ms; }
.sc-link:hover .sc-link-icons, .sc-link:focus-within .sc-link-icons { opacity: 1; }
.sc-link-icons .sc-control { width: 22px; height: 22px; }
`;

/** Drawn by `<Composer>`. Exported for an application that draws the parts on their own. */
export function ComposerStyles() {
  return (
    <style href="sincpro-web-composer" precedence="low">
      {CSS}
    </style>
  );
}
