import {
  type Action,
  Destination,
  localEntries,
  matches,
  MIN_QUERY,
  type PaletteEntry,
  PaletteSection,
  type Registry,
  type ResourceRef,
  searchEntries,
} from "@sincpro/web-composer/domain/index";
import { composerCopy } from "@sincpro/web-composer/shell/copy";
import { useSkin } from "@sincpro/web-composer/shell/skin";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * ⌘K over the workspace. The list is the model's (`localEntries`,
 * `searchEntries`); this only draws it and decides WHERE a resource opens,
 * which is the one thing a generic palette cannot know:
 *
 *     Enter    the page — what a click on a record does
 *     ⌥Enter   a peek — look without losing the place
 *     ⇧Enter   a panel beside what I am on
 *     ⌘Enter   a window
 *
 * Drawn here, with the composer's own skin: the composer depends on no design
 * system. An application with its own palette keeps the destinations and the
 * entries (`localEntries`, `searchEntries`) and draws them however it likes.
 */

const SECTION_KEY = {
  [PaletteSection.Actions]: "actions",
  [PaletteSection.Goto]: "goto",
  [PaletteSection.Found]: "found",
} as const;

/** Long enough to not ask every domain per keystroke, short enough to feel live. */
const SEARCH_DELAY_MS = 180;

function destinationOf(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): Destination {
  if (e.metaKey || e.ctrlKey) return Destination.Window;
  if (e.shiftKey) return Destination.Side;
  if (e.altKey) return Destination.Peek;
  return Destination.Page;
}

/** The remote search, debounced, with the stale answers dropped: typing «fac»
 *  then «fact» must not let the slower «fac» land last. */
function useFound(registry: Registry, query: string) {
  const [found, setFound] = useState<readonly PaletteEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY) {
      setFound([]);
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchEntries(registry, query).then((entries) => {
        if (!current) return;
        setFound(entries);
        setLoading(false);
      });
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [registry, query]);

  return { found, loading };
}

export type WorkspacePaletteProps = {
  registry: Registry;
  focused: ResourceRef | null;
  onOpen: (ref: ResourceRef, destination: Destination) => void;
  onAction: (action: Action) => void;
  onClose: () => void;
};

export function WorkspacePalette({
  registry,
  focused,
  onOpen,
  onAction,
  onClose,
}: WorkspacePaletteProps) {
  const copy = composerCopy().palette;
  const SearchIcon = useSkin().icons.search;
  const listId = useId();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const { found, loading } = useFound(registry, query);

  const local = useMemo(() => localEntries(registry, focused), [registry, focused]);
  const entries = useMemo(
    () => [...local.filter((e) => matches(e, query)), ...found],
    [local, found, query],
  );
  const active = entries[Math.min(cursor, entries.length - 1)];

  /* The focus goes back where it was: the palette is a path, not a place. */
  const returnTo = useRef<Element | null>(null);
  useEffect(() => {
    returnTo.current = document.activeElement;
    return () => {
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
    };
  }, []);

  function run(entry: PaletteEntry, destination: Destination) {
    onClose();
    if (entry.section === PaletteSection.Actions) onAction(entry.action);
    else onOpen(entry.ref, destination);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0 && entries.length > 0) {
      setCursor(
        (c) => (Math.min(c, entries.length - 1) + step + entries.length) % entries.length,
      );
      e.preventDefault();
    } else if (e.key === "Enter" && active !== undefined) {
      run(active, destinationOf(e));
      e.preventDefault();
    } else if (e.key === "Escape") {
      onClose();
      e.preventDefault();
    } else if (e.key === "Tab") {
      /* The search box is the palette's only stop: Tab would walk out of the
         dialog into the page behind it. */
      e.preventDefault();
    }
  }

  return (
    <div
      className="sc-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-label={copy.label} className="sc-palette">
        <div className="sc-palette-search">
          <SearchIcon />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            {...(active === undefined
              ? {}
              : { "aria-activedescendant": `${listId}-${active.id}` })}
            value={query}
            placeholder={copy.placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        <ul id={listId} role="listbox" className="sc-palette-list">
          {entries.map((entry, i) => {
            const Icon = entry.icon;
            const heading = entries[i - 1]?.section !== entry.section;
            return (
              <li key={entry.id} role="presentation">
                {heading ? (
                  <p className="sc-palette-section">
                    {copy.sections[SECTION_KEY[entry.section]]}
                  </p>
                ) : null}
                <div
                  id={`${listId}-${entry.id}`}
                  role="option"
                  aria-selected={entry === active}
                  onPointerMove={() => setCursor(i)}
                  onClick={(e) => run(entry, destinationOf(e))}
                  className="sc-option"
                >
                  <span className="sc-option-icon">
                    {Icon === undefined ? null : <Icon strokeWidth={2} />}
                  </span>
                  <span className="sc-option-label">{entry.label}</span>
                  {entry.section !== PaletteSection.Actions && entry.detail !== undefined ? (
                    <span className="sc-option-detail">{entry.detail}</span>
                  ) : null}
                  {entry.section === PaletteSection.Actions &&
                  entry.shortcut !== undefined ? (
                    <kbd className="sc-kbd">{entry.shortcut}</kbd>
                  ) : null}
                </div>
              </li>
            );
          })}
          {entries.length === 0 && !loading ? (
            <li className="sc-palette-empty">{copy.empty}</li>
          ) : null}
          {loading ? <li className="sc-palette-empty">{copy.searching}</li> : null}
        </ul>

        <p className="sc-palette-hint">{copy.hint}</p>
      </div>
    </div>
  );
}
