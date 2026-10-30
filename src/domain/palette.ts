import type { Action, Registry, ViewSpec } from "@sincpro/web-composer/domain/registry";
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

/** Asks every domain that searches. A domain that fails is logged and left
 *  out; the others still answer. */
export async function searchEntries(
  registry: Registry,
  query: string,
): Promise<readonly PaletteEntry[]> {
  const text = query.trim();
  if (text.length < MIN_QUERY) return [];

  const specs = registry.all().filter((spec) => spec.search !== undefined);
  const answers = await Promise.allSettled(specs.map((spec) => spec.search!(text)));

  const seen = new Set<string>();
  const found: PaletteEntry[] = [];
  answers.forEach((answer, i) => {
    if (answer.status === "rejected") {
      console.warn(`[composer] search failed in «${specs[i]?.domain}»`, answer.reason);
      return;
    }
    for (const hit of answer.value) {
      const id = `found:${formatRef(hit.ref)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const icon = registry.resolve(hit.ref)?.icon;
      found.push({
        section: PaletteSection.Found,
        id,
        label: hit.label,
        ...(hit.detail === undefined ? {} : { detail: hit.detail }),
        ...(icon === undefined ? {} : { icon }),
        ref: hit.ref,
      });
    }
  });
  return found;
}
