import type { ReactNode } from "react";

/**
 * The few glyphs the frames need, drawn here so the composer depends on no icon library. Same
 * shape as any icon component (`className`, `strokeWidth`), so an application can pass its own
 * wherever the composer takes an icon.
 */

export type IconProps = { className?: string; strokeWidth?: number };

function glyph(paths: ReactNode) {
  return function Icon({ className, strokeWidth = 2 }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        {...(className === undefined ? {} : { className })}
      >
        {paths}
      </svg>
    );
  };
}

export const MoreIcon = glyph(
  <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </>,
);
export const ExpandIcon = glyph(<path d="M7 17 17 7M8 7h9v9" />);
export const MinimizeIcon = glyph(<path d="M5 12h14" />);
export const MaximizeIcon = glyph(<rect x="5" y="5" width="14" height="14" rx="2" />);
export const RestoreIcon = glyph(
  <>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M4 16V6a2 2 0 0 1 2-2h10" />
  </>,
);
export const CloseIcon = glyph(<path d="M18 6 6 18M6 6l12 12" />);
export const LeftIcon = glyph(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </>,
);
export const RightIcon = glyph(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M15 3v18" />
  </>,
);
export const BottomIcon = glyph(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 15h18" />
  </>,
);
export const WindowIcon = glyph(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="12" y="11" width="6" height="5" rx="1" />
  </>,
);
export const BackIcon = glyph(<path d="M19 12H5M12 19l-7-7 7-7" />);
export const SearchIcon = glyph(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);
export const PeekIcon = glyph(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
