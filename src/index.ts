/**
 * The shell — React and nothing else: the composer draws its windows with its own skin
 * (`sc-*` classes, `--sc-*` variables) and depends on no design system. The model comes in
 * through the other door, `@sincpro/web-composer/domain`, which depends on nothing.
 *
 * Only the model TYPES that appear in these signatures are re-exported, so declaring a domain
 * does not force a two-place import.
 */

export type {
  Action,
  Crumb,
  OpenOptions,
  PaletteEntry,
  PickOptions,
  Registry,
  ResourceRef,
  SearchHit,
  ViewProps,
  ViewSpec,
  Workspace,
  WorkspaceApi,
} from "@sincpro/web-composer/domain/index";
export {
  Destination,
  focusedRef,
  PAGE,
  PaletteSection,
  PEEK,
  selectionOf,
  Surface,
  Zone,
} from "@sincpro/web-composer/domain/index";
export { Composer, type ComposerProps } from "@sincpro/web-composer/shell/Composer";
export {
  type ComposerCopy,
  composerCopy,
  ENGLISH_COMPOSER_COPY,
  installComposerCopy,
  SPANISH_COMPOSER_COPY,
} from "@sincpro/web-composer/shell/copy";
export { type IconProps } from "@sincpro/web-composer/shell/icons";
export {
  WorkspacePalette,
  type WorkspacePaletteProps,
} from "@sincpro/web-composer/shell/Palette";
export {
  type PanelActions,
  PanelFrame,
  type PanelFrameProps,
} from "@sincpro/web-composer/shell/PanelFrame";
export { PanelHost, type PanelHostProps } from "@sincpro/web-composer/shell/PanelHost";
export { RecordLink, type RecordLinkProps } from "@sincpro/web-composer/shell/RecordLink";
export {
  type ComposerSkin,
  type ConfirmProps,
  DEFAULT_ICONS,
  type NoticeProps,
  type PeekProps,
  type SkinIcons,
} from "@sincpro/web-composer/shell/skin";
export { ComposerStyles } from "@sincpro/web-composer/shell/styles";
export { ViewHost, type ViewHostProps } from "@sincpro/web-composer/shell/ViewHost";
export {
  type ApiFactory,
  createApiFactory,
  type Target,
} from "@sincpro/web-composer/state/api";
export {
  type ConfirmDiscard,
  createWorkspaceStore,
  type StoreOptions,
  type WorkspaceStore,
} from "@sincpro/web-composer/state/store";
export {
  useKeyboard,
  type UseKeyboardOptions,
} from "@sincpro/web-composer/state/useKeyboard";
export {
  useCrumbs,
  useWorkspace,
  useWorkspaceContext,
  useWorkspaceSlice,
  useWorkspaceState,
} from "@sincpro/web-composer/state/useWorkspace";
