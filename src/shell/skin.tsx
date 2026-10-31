import {
  BackIcon,
  BottomIcon,
  CloseIcon,
  ExpandIcon,
  type IconProps,
  LeftIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoreIcon,
  PeekIcon,
  RestoreIcon,
  RightIcon,
  SearchIcon,
  WindowIcon,
} from "@sincpro/web-composer/shell/icons";
import type { ComponentType, ReactNode } from "react";
import { createContext, useContext } from "react";

/**
 * What the composer draws, open to be replaced. The composer owns the BEHAVIOUR — where a thing
 * opens, how it moves, what is remembered — and ships a minimal look so it works out of the box.
 * The look is the application's: every piece here can be swapped, one at a time, and what is
 * not passed keeps the default.
 *
 *     <Composer skin={{ icons: { close: X, more: Ellipsis }, Peek: MyDrawer }} … />
 *
 * An icon passed here is drawn at the composer's size (`--sc-icon`, 14px), whatever size it
 * draws itself at: a 24px icon library does not inflate the controls.
 *
 * Three levels, from least to most work: the `--sc-*` variables (colors, radius), these pieces,
 * and `styles: false` to drop the default sheet and style the `sc-*` classes from scratch.
 */

export type Icon = ComponentType<IconProps>;

export type SkinIcons = {
  more: Icon;
  expand: Icon;
  minimize: Icon;
  maximize: Icon;
  restore: Icon;
  close: Icon;
  left: Icon;
  right: Icon;
  bottom: Icon;
  window: Icon;
  back: Icon;
  search: Icon;
  peek: Icon;
};

/** The drawer a peek is read in. It must not block what is behind it, take the focus on open,
 *  and close on Escape while the focus is inside — claiming the key with `preventDefault`. */
export type PeekProps = {
  title: string;
  onClose: () => void;
  /** «Open as panel», «Back to …», «Open as page»: already wired, only to be placed. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * A modal over ONE surface: it covers that surface — the page, a window, a side panel or the
 * peek — and nothing else, so the rest of the workspace keeps answering. The composer places it
 * and blocks what is underneath; this draws the scrim and the window. It must take the focus on
 * open, give it back on close, and close on Escape while the focus is inside — claiming the key
 * with `preventDefault`. The default one moves by its title.
 */
export type ModalProps = {
  title: string;
  /** Blur what it covers. Off unless the view that opened it asked. */
  blur: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** The question before throwing away what was typed. `onAnswer(false)` is the safe answer and
 *  what Escape gives. */
export type ConfirmProps = {
  open: boolean;
  title: string;
  detail: string;
  keep: string;
  discard: string;
  onAnswer: (ok: boolean) => void;
};

/** What stands where a view could not be drawn: a reference nobody resolves, or a view that
 *  threw. */
export type NoticeProps = { heading: string; detail: string; bad?: boolean };

export type Skin = {
  icons: SkinIcons;
  Peek: ComponentType<PeekProps> | null;
  Modal: ComponentType<ModalProps> | null;
  Confirm: ComponentType<ConfirmProps> | null;
  Notice: ComponentType<NoticeProps> | null;
  /** `false` drops the default sheet: the `sc-*` classes are then yours to style. */
  styles: boolean;
};

/** What `<Composer skin>` takes: any part, the rest stays default. */
export type ComposerSkin = Partial<Omit<Skin, "icons">> & { icons?: Partial<SkinIcons> };

export const DEFAULT_ICONS: SkinIcons = {
  more: MoreIcon,
  expand: ExpandIcon,
  minimize: MinimizeIcon,
  maximize: MaximizeIcon,
  restore: RestoreIcon,
  close: CloseIcon,
  left: LeftIcon,
  right: RightIcon,
  bottom: BottomIcon,
  window: WindowIcon,
  back: BackIcon,
  search: SearchIcon,
  peek: PeekIcon,
};

/** `null` components mean «the composer's own»; they are resolved where they are drawn, so this
 *  file does not import the shell. */
const DEFAULT_SKIN: Skin = {
  icons: DEFAULT_ICONS,
  Peek: null,
  Modal: null,
  Confirm: null,
  Notice: null,
  styles: true,
};

export function resolveSkin(skin: ComposerSkin | undefined): Skin {
  if (skin === undefined) return DEFAULT_SKIN;
  return { ...DEFAULT_SKIN, ...skin, icons: { ...DEFAULT_ICONS, ...skin.icons } };
}

const SkinContext = createContext<Skin>(DEFAULT_SKIN);

export const SkinProvider = SkinContext.Provider;

/** The skin in use. Outside a `<Composer>` — a `RecordLink` in a test — the default. */
export const useSkin = (): Skin => useContext(SkinContext);
