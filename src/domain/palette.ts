import type {
  Action,
  Registry,
  SearchHit,
  ViewSpec,
} from "@sincpro/web-composer/domain/registry";
import { formatRef, type ResourceRef } from "@sincpro/web-composer/domain/resource";

/**
 * ⌘K in three layers: GO TO a screen, DO something with what I am on, and
 * what each domain FOUND for the query. Pure on purpose — what the palette
 * offers and how a query matches are tested without drawing it.
 */

export const PaletteSection = {
  Goto: "goto",
  Actions: "actions",
  Found: "found",
} as const;

export type PaletteSection = (typeof PaletteSection)[keyof typeof PaletteSection];

type Icon = ViewSpec["icon"];

export type PaletteEntry =
  | {
      section: typeof PaletteSection.Goto | typeof PaletteSection.Found;
      id: string;
      label: string;
      /** A found record's kind, from its `ViewSpec`: «Entry». */
      noun?: string;
      detail?: string;
      icon?: Icon;
      ref: ResourceRef;
    }
  | {
      section: typeof PaletteSection.Actions;
      id: string;
      label: string;
      icon?: Icon;
      shortcut?: string;
      keywords?: readonly string[];
      action: Action;
    };

/** Shorter than this, every domain answers with half its table. */
export const MIN_QUERY = 2;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Every word of the query, in any order, ignoring accents and case:
 *  «facturacion» finds «Facturación», «nueva fac» finds «Nueva factura». */
export function matches(entry: PaletteEntry, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const keywords = entry.section === PaletteSection.Actions ? (entry.keywords ?? []) : [];
  const detail = entry.section === PaletteSection.Actions ? "" : (entry.detail ?? "");
  const haystack = fold([entry.label, detail, ...keywords].join(" "));
  return words.every((word) => haystack.includes(word));
}

/** What is known without asking anyone: the screens, and the actions of the
 *  resource the user is on. */
export function localEntries(
  registry: Registry,
  focused: ResourceRef | null,
): readonly PaletteEntry[] {
  const goto = registry
    .all()
    .filter((spec) => spec.goto === true)
    .map((spec): PaletteEntry => {
      const ref = { domain: spec.domain, kind: spec.kind };
      return {
        section: PaletteSection.Goto,
        id: `goto:${formatRef(ref)}`,
        label: spec.title(ref),
        ...(spec.icon === undefined ? {} : { icon: spec.icon }),
        ref,
      };
    });

  const spec = focused === null ? null : registry.resolve(focused);
  const actions = (focused === null ? [] : (spec?.actions?.(focused) ?? [])).map(
    (action): PaletteEntry => ({
      section: PaletteSection.Actions,
      id: `action:${action.id}`,
      label: action.label,
      ...(action.icon === undefined ? {} : { icon: action.icon }),
      ...(action.shortcut === undefined ? {} : { shortcut: action.shortcut }),
      ...(action.keywords === undefined ? {} : { keywords: action.keywords }),
      action,
    }),
  );

  return [...actions, ...goto];
}

/** Asks every domain that searches. Each answer is added as it arrives and `onAnswer` hears the
 *  list so far: a slow domain does not hold back the quick ones, and what is already on screen
 *  never moves under the cursor. A domain that fails is logged and left out; the others still
 *  answer. Resolves with every answer, for whoever needs them all (an agent). */
export async function searchEntries(
  registry: Registry,
  query: string,
  onAnswer?: (found: readonly PaletteEntry[]) => void,
): Promise<readonly PaletteEntry[]> {
  const text = query.trim();
  if (text.length < MIN_QUERY) return [];

  const seen = new Set<string>();
  const found: PaletteEntry[] = [];

  function add(hits: readonly SearchHit[]) {
    for (const hit of hits) {
      const id = `found:${formatRef(hit.ref)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      /* The hit's own kind, not the searching domain's: one search may answer with several. */
      const spec = registry.resolve(hit.ref);
      found.push({
        section: PaletteSection.Found,
        id,
        label: hit.label,
        ...(spec?.noun === undefined ? {} : { noun: spec.noun }),
        ...(hit.detail === undefined ? {} : { detail: hit.detail }),
        ...(spec?.icon === undefined ? {} : { icon: spec.icon }),
        ref: hit.ref,
      });
    }
    onAnswer?.([...found]);
  }

  const specs = registry.all().filter((spec) => spec.search !== undefined);
  await Promise.all(
    specs.map((spec) =>
      /* A search that throws instead of rejecting is a failure too, not the end of all of them. */
      Promise.resolve()
        .then(() => spec.search!(text))
        .then(add, (reason: unknown) => {
          console.warn(`[composer] search failed in «${spec.domain}»`, reason);
        }),
    ),
  );
  return found;
}
