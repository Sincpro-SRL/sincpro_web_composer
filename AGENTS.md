# AGENTS.md — working on @sincpro/web-composer

The **Manifesto** in the README is the yardstick: a change that does not answer «where does it
open, how do I get back, what is remembered, what does the other one see» — for any domain —
does not go in. This file is how to keep it.

## Where things go

| Folder        | What                                                       | May import                 |
| ------------- | ---------------------------------------------------------- | -------------------------- |
| `src/domain/` | the model and its rules: page, trail, peek, panels, layout | `domain/` only             |
| `src/state/`  | the store, the API views receive, keyboard, history, drag  | `domain/`, React           |
| `src/shell/`  | the React shell and its minimal skin                       | `domain/`, `state/`, React |
| `stories/`    | one use case per story, with `play` — the app is web-ui    | anything (devDependencies) |
| `tests/`      | the model's rules, vitest in Node                          | the package                |

## Hard rules (`make doctor` enforces them)

- **Standalone.** Nothing in `src/` imports `@sincpro/web-ui` or an icon library. A new visual
  piece goes through the `skin` contract (`src/shell/skin.tsx`) with a default of our own.
- **Layers do not climb:** `domain/` imports no store and no shell; `state/` no shell.
- **Self-imports, no extensions:** `@sincpro/web-composer/<path>`, never relative, never `.ts`.
- **Styling** is the `sc-*` classes and `--sc-*` variables in `src/shell/styles.tsx`. Nothing
  inline but geometry.
- **Words** come from the copy table (`src/shell/copy.ts`), English and Spanish together.
- **Escape is claimed:** whatever consumes it calls `preventDefault`; the workspace ignores a
  claimed one.

## Testing

`make test` is one vitest run: `model` (Node, under a second) and `storybook` (every story, its
`play` and a11y, in the installed Chrome) — the same tests as «Run tests» in Storybook. A new
behaviour arrives with its story; a rule of the model, also with a test in `tests/`.

## Known traps

- A view is keyed by its reference **without** `params`: a filter does not remount it, so
  state derived from `resource.params` must be read, not copied into `useState`.
- The API object is rebuilt when a surface's resource changes; a late call from the old one
  (`setTitle`, `setDirty`) is ignored on purpose.
- `setDirty(false)` BEFORE leaving after a save, or the workspace asks.
- Lengths are fraction + pixels (`Length`); resolve them against the host size, never assume %.
- Use the current React (19) and its features (`<style href precedence>`, `useSyncExternalStore`).
- Never `git commit`: changes are prepared and staged; the commit is the user's.
