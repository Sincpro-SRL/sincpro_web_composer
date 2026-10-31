# @sincpro/web-composer

**A window manager for enterprise web apps.** A person opens a record, checks another beside
it, peeks at a third and keeps a fourth floating while they work — without losing their place,
and without any screen knowing about the others. A rich API for views, standalone: it depends
on nothing but React. By [Sincpro](https://github.com/Sincpro-SRL), open source.

```bash
yarn add @sincpro/web-composer react react-dom
```

## Manifesto

### Purpose

The composer defines **how work between records behaves**: where each thing opens, how you get
back, what is remembered, and what the others see. One behaviour, reviewed by Sincpro, for
every application.

UI libraries prefer «one screen, one context» because it is clean. But people who work in
accounting, audit or support spend the day **between** records: the bank statement against the
invoices, the journal item against its entry, the customer while the order is half filled.
Without a window manager, every app either navigates away (the list, its filters and its
selection are gone) or sends people to browser tabs (the context lives in their head) — and
each app reinvents peeks, breadcrumbs and panels its own way. The composer solves it once.

| Who              | The question it answers                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| **The composer** | Where each view lives and how it moves: page, peek, side panel, window   |
| **Your app**     | What a record is and how it looks — drawn with web-ui, or anything else  |
| **A framework**  | Puts both together (`@sincpro/web-framework` does, over server metadata) |

### Principles — the contract

- **One gesture, one destination.** A click opens the page and the breadcrumb keeps the way
  back; a peek, a window, a side panel are one gesture away, never forced on anyone. Someone
  who never opens a panel just sees pages and breadcrumbs.
- **References, not data.** The workspace stores `domain:kind/id`. A support case points at an
  invoice and the workspace opens it, while the support code never imports accounting. Views
  can open things and publish what they selected, but cannot read the workspace.
- **Never lose the place, nor what was typed.** The breadcrumb, the URL, the browser's Back,
  asking before discarding. Moving a panel does not remount it; neither does changing only a
  reference's `params`. The peek belongs to its page: when the page becomes another record, it
  closes.
- **Opinionated defaults, open doors.** Good practice comes built in, and everything is
  replaceable without forks: the look (`--sc-*`, `skin`), the discard question
  (`confirmDiscard`), where a click goes (`defaultOpen`), any reducer (`apply`).
- **Standalone.** Only React. The design belongs to whoever uses it; the composer ships a
  minimal skin so it works alone, and nothing else.
- **Each domain declares itself.** Register a `ViewSpec` and it works in pages, panels, the
  peek and ⌘K. Adding a domain changes no file here — the view can be a module another team
  deploys.
- **Nothing a person arranges can break it.** A view that throws stays in its own panel; a
  reference nobody resolves says so; a broken link loads what is valid; sizes are clamped.
- **Addressable by people and agents.** The place lives in the URL and in references, so the
  same API (`context`, `open`, `peek`, `select`) serves a person and an AI agent. An MCP or
  WebMCP adapter fits here — as a separate module, not in the core.
- **A rule comes with its story.** Every behaviour is a Storybook story with its `play`.

### What it is not

- **Not a component library.** No form controls, tables or lists — that is your app (web-ui).
- **Not a data layer.** No fetching, permissions, entities or sessions.
- **Not a router** of URL paths, and not a free dashboard layout.
- **No tabs, no multiple workspaces.** One page, its trail, and what is around it.
- **No design system, no icon library** as a dependency.

### How something new gets in

All three, or it belongs in another package:

1. It answers **where does it open? how do I get back? what is remembered? what does the other
   one see** (a panel following the selection, an agent)?
2. It serves **any domain** the same way — if it only makes sense for accounting, it is the
   app's.
3. It comes from **real use** (forge, web-framework) and arrives with its story.

## The model

One **page**, with its **trail** (the breadcrumb), and around it:

| Destination | What it is                                                              | When to use it                               |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| **page**    | Replaces the page; the breadcrumb remembers where you were. The default | Opening a record to work on it               |
| **peek**    | A drawer over the page that does not cover the panels                   | Reading without leaving the place            |
| **window**  | Floating: moves anywhere, resizes, can grow into the page               | A quick look or edit on top of what you do   |
| **side**    | Docked left, right or at the bottom, resizable                          | A second context that stays: compare, follow |
| **modal**   | Over the surface that asked, blocking only it; moves by its title       | A question, a chooser, a short form          |

A view opens anything with one call and lets the workspace decide the rest:

```ts
api.open(ref); // the page — inside the peek, a step IN the drawer
api.open(ref, { to: "peek" }); // or "window", or "side"
api.open(ref, { to: "modal" }); // over THIS surface only; { blur: true } blurs what it covers
api.over; // in a modal: the record it was opened over — its context (null elsewhere)
api.replace(ref); // show it HERE without a step back: the record a form just created
api.setParams({ tenant }); // a filter that lives in the reference: survives reload and links
useCrumbs(api); // the breadcrumb, ready for List.Crumbs / Record.Crumbs — follows setTitle
api.back(); // one step back: the page's breadcrumb, or the peek's own trail
api.close(); // leave: closes the panel, the peek or the modal; on the page, goes back
api.expand(); // a window, a side panel or the peek grows into the page
api.setTitle(name); // the record's real name, for the crumbs and the frames, once loaded
api.setDirty(true); // unsaved: a crumb, a close or the browser's Back ask first
api.select(refs); // publish what this view has selected
api.context; // read what the user is on and what is selected — references only
api.pick(ref, onPick); // open a chooser (a many2one search); its view calls api.answer(ref)
api.pick(ref, onPick, { to: "modal" }); // the chooser as a modal over the form
```

A **modal** belongs to the surface it covers — the page, a window, a side panel or the peek —
and blocks only that one: the rest of the workspace keeps answering, and a window keeps moving
and closing by its own title bar. One per surface: opening another one over the same surface,
or from inside it, replaces it. When its surface shows another record or closes, the modal goes
with it (asking first if something was typed). What it shares with whoever opened it travels in
its reference (`params`) and comes back with `api.answer`; `api.over` says what it covers. No
blur unless asked.

From the app, around the workspace: `workspace.start(ref)` starts over from a menu (no
breadcrumb behind, no peek, the panels stay), and `useWorkspace({ hash: true })` puts the
workspace in the URL with the browser's Back working. Unsaved changes are asked with the
composer's own dialog; `useWorkspace({ confirmDiscard })` replaces it.

## Where each behaviour lives

The same gesture means the same thing on every screen:

| Where                                               | Gesture                  | Destination                                 |
| --------------------------------------------------- | ------------------------ | ------------------------------------------- |
| A row of a list                                     | click                    | **page**, with breadcrumb                   |
| A record's name INSIDE the peek                     | click                    | a step **in the peek**; ← comes back        |
| The record's name in a column (`RecordLink`)        | hover icons, Space, ⇧, ⌘ | **peek**, **side**, **window**              |
| A many2one field                                    | open · search            | **window** · a **modal** that **answers**   |
| A short task on a record (register a payment)       | click                    | **modal** over that record                  |
| A record's buttons that _lead_ (see its items)      | click                    | **side**                                    |
| A record's buttons that _produce_ (post, reconcile) | click                    | nothing opens: they act on the record       |
| Ticking rows                                        | select                   | nothing opens: the context changes          |
| ⌘K                                                  | Enter · ⌥ · ⇧ · ⌘        | **page** · **peek** · **side** · **window** |

## Using it

Declare a domain:

```tsx
import { createRegistry } from "@sincpro/web-composer/domain";

const registry = createRegistry([
  {
    domain: "accounting",
    kind: "entry",
    title: (ref) => `Entry ${ref.id}`,
    search: async (query) => findEntries(query), // ⌘K asks every domain that searches
    load: async () => (await import("./EntryView")).EntryView, // lazy: a remote module fits here
  },
]);
```

Draw the workspace:

```tsx
import {
  Composer,
  installComposerCopy,
  SPANISH_COMPOSER_COPY,
  useWorkspace,
} from "@sincpro/web-composer";

installComposerCopy(SPANISH_COMPOSER_COPY); // optional: the composer's words in Spanish

export function App() {
  const workspace = useWorkspace();
  return <Composer workspace={workspace} registry={registry} />;
}
```

Write a view — it receives its reference and the API, nothing else. It is drawn with whatever
your app uses; here, web-ui:

```tsx
import { RecordLink, useCrumbs, type ViewProps } from "@sincpro/web-composer";
import { List } from "@sincpro/web-ui";

export function Entries({ api }: ViewProps) {
  const crumbs = useCrumbs(api);
  return (
    <List items={entries} keyOf={(e) => e.id} onOpen={(e) => api.open(entryRef(e.id))}>
      <List.Bar>
        <List.Crumbs crumbs={crumbs} />
      </List.Bar>
      <List.Table
        columns={[
          {
            id: "number",
            header: "number",
            value: (e) => e.id,
            cell: (e) => (
              <RecordLink api={api} resource={entryRef(e.id)}>
                {e.id}
              </RecordLink>
            ),
          },
        ]}
      />
    </List>
  );
}
```

The Storybook in this repository is the long version: eleven accounting use cases — journal
entries, journal items, bank reconciliation, a form with relations, an audit where the detail
follows the selection, ⌘K, the keyboard, what happens when something fails, and your own
design over the composer.

## Your design over it

### Colors

Every color, radius and shadow is a CSS variable with a default (light and dark). Set them
anywhere above the workspace — no stylesheet to import:

```css
:root {
  --sc-surface: var(--my-surface);
  --sc-accent: var(--my-brand);
  /* --sc-ground --sc-line --sc-line-strong --sc-ink --sc-muted --sc-danger --sc-scrim
     --sc-shadow --sc-radius --sc-radius-control --sc-text --sc-text-small
     --sc-icon (14px: every icon in a control, yours too) --sc-modal-scrim --sc-modal-blur */
}
```

### Three levels

The composer owns the behaviour; the look is yours. Take only what you need:

1. **Colors** — the `--sc-*` variables above.
2. **Pieces** — `skin` swaps icons and parts one at a time; what you do not pass stays default:

   ```tsx
   <Composer
     workspace={workspace}
     registry={registry}
     skin={{
       icons: { close: X, more: Ellipsis }, // drawn at --sc-icon, whatever size they come in
       Peek: MyDrawer, // ({ title, onClose, actions, children })
       Modal: MyModal, // ({ title, blur, onClose, children })
       Confirm: MyConfirm, // ({ open, title, detail, keep, discard, onAnswer })
       Notice: MyNotice, // ({ heading, detail, bad })
     }}
   />
   ```

3. **Everything** — `skin={{ styles: false }}` drops the default sheet; style the stable `sc-*`
   classes from scratch.

The story «11 · Tu diseño sobre el composer» plugs web-ui's `Peek` and lucide's icons this way —
the composer imports neither.

## Development

```bash
nvm use       # Node 26, from .nvmrc
make init     # pre-commit + yarn install
make test     # vitest: the model's rules (Node) + every story with its play (Chrome)
make build
make dev      # Storybook on :6007 — one story per use case; «Run tests» in the sidebar
```

Every operation — local or CI — goes through the `Makefile`; run `make` to list the targets.

```text
src/domain/  the model: pure TypeScript, no browser state, tested in Node
src/state/   the store and the API views receive
src/shell/   the React shell, with its own minimal skin (sc-* classes, --sc-* variables)
tests/       the model's rules, vitest in Node
stories/     the use cases, over a fake accounting app drawn with web-ui (dev only)
```

## CI/CD

The workflows in `.github/workflows/` only delegate to the shared `Sincpro-SRL/.github`
pipeline, which calls `make init`, `make verify-format`, `make test`,
`make update-version VERSION=x` and `make publish`.

## License

MIT © Sincpro S.R.L.
