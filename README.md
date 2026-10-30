# @sincpro/web-composer

**How enterprise screens are put together.** A workspace for React where a person opens a
record, checks another one beside it, peeks at a third, and keeps a fourth floating while they
work — without losing their place, and without any screen knowing about the others. By
[Sincpro](https://github.com/Sincpro-SRL), open source.

```bash
yarn add @sincpro/web-composer @sincpro/web-ui react react-dom
```

Requires React 19 or newer and [`@sincpro/web-ui`](https://github.com/Sincpro-SRL/sincpro_web_ui).

## Why

People who work in an ERP spend the day **between records**. An accountant reconciles a bank
statement against invoices. An auditor walks journal items and checks the entry each one came
from. Somebody filling an order needs to look at the customer, the stock and last month's
invoice — now, not after closing the form.

Most business software answers that with one of two bad options:

- **Navigate away.** You open the invoice, and the list you were working on is gone. You come
  back and the filters, the scroll and the selection are gone too.
- **Open another browser tab.** Now the context lives in your head: which tab had what, and
  which one is stale.

Both make people do the remembering. The composer makes the workspace do it.

## The vision

Sincpro builds enterprise interfaces with two packages, and each one owns a different question:

| Package                                                            | The question it answers                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [`@sincpro/web-ui`](https://github.com/Sincpro-SRL/sincpro_web_ui) | **What a screen looks like** — tokens, primitives, `List` (N records), `Record` (one)                              |
| `@sincpro/web-composer`                                            | **How screens are put together** — where a record opens, how two of them sit side by side, how one follows another |
| Your application                                                   | **What a record is** — invoices, payments, journal entries                                                         |

Neither package knows your domain. Together they are how we build business software: web-ui
draws the screens, the composer arranges them, and the application only declares its records.

### Principles

- **A click does the predictable thing.** Opening a record replaces the page, and the
  breadcrumb keeps the way back. Everything else — a peek, a window, a side panel — is one
  gesture away, never forced on anyone. Someone who never opens a panel just sees pages and
  breadcrumbs.
- **References, not data.** The workspace stores `domain:kind/id`. A support case can point at
  an invoice and the workspace opens it, while the support code never imports accounting.
- **Each domain declares itself.** Register a `ViewSpec` and it works: in pages, panels, the
  peek and ⌘K. Adding a domain changes no file in this package — and the view can be a module
  another team deploys.
- **Nothing a person arranges can break it.** A view that throws stays in its own panel. A
  reference nobody can resolve says so. A broken link loads what is valid. Sizes are clamped.
- **Moving is not remounting.** Every surface is a sibling on one layer; only its box changes.
  A panel moved to another edge keeps its scroll, its filters and what was typed in it.
- **Views stay apart.** A view can open things and publish what it selected, but it cannot read
  the workspace — two domains talk through references, never through each other.

## The model

One **page**, with its **trail** (the breadcrumb), and around it:

| Destination | What it is                                                              | When to use it                               |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| **page**    | Replaces the page; the breadcrumb remembers where you were. The default | Opening a record to work on it               |
| **peek**    | A drawer over the page that does not cover the panels                   | Reading without leaving the place            |
| **window**  | Floating: moves anywhere, resizes, can grow into the page               | A quick look or edit on top of what you do   |
| **side**    | Docked left, right or at the bottom, resizable                          | A second context that stays: compare, follow |

A view opens anything with one call and lets the workspace decide the rest:

```ts
api.open(ref); // the page
api.open(ref, { to: "peek" }); // or "window", or "side"
api.crumbs(); // the breadcrumb, ready for List.Crumbs / Record.Crumbs
api.back(); // one page back
api.expand(); // a window, a side panel or the peek grows into the page
api.select(refs); // publish what this view has selected
api.context; // read what the user is on and what is selected — references only
api.pick(ref, onPick); // open a chooser (a many2one search); its view calls api.answer(ref)
```

## Where each behaviour lives

The same gesture means the same thing on every screen:

| Where                                               | Gesture                  | Destination                                 |
| --------------------------------------------------- | ------------------------ | ------------------------------------------- |
| A row of a list                                     | click                    | **page**, with breadcrumb                   |
| The record's name in a column (`RecordLink`)        | hover icons, Space, ⇧, ⌘ | **peek**, **side**, **window**              |
| A many2one field                                    | open · search            | **window** · a window that **answers**      |
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

Write a view — it receives its reference and the API, nothing else:

```tsx
import { RecordLink, type ViewProps } from "@sincpro/web-composer";
import { List } from "@sincpro/web-ui";

export function Entries({ api }: ViewProps) {
  return (
    <List items={entries} keyOf={(e) => e.id} onOpen={(e) => api.open(entryRef(e.id))}>
      <List.Bar>
        <List.Crumbs crumbs={api.crumbs()} />
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

The Storybook in this repository is the long version: ten accounting use cases — journal
entries, journal items, bank reconciliation, a form with relations, an audit where the detail
follows the selection, ⌘K, the keyboard, and what happens when something fails.

## Development

```bash
nvm use       # Node 26, from .nvmrc
make init     # pre-commit + yarn install
make test
make build
make dev      # Storybook on :6007 — one story per use case
make smoke    # every story in headless Chrome, play functions included
```

Every operation — local or CI — goes through the `Makefile`; run `make` to list the targets.

```text
src/domain/  the model: pure TypeScript, no browser state, tested in Node
src/state/   the store and the API views receive
src/shell/   the React shell, drawn with @sincpro/web-ui
tests/       node --test over the TypeScript sources
stories/     the use cases, over a fake accounting domain in stories/contabilidad/
```

## CI/CD

The workflows in `.github/workflows/` only delegate to the shared `Sincpro-SRL/.github`
pipeline, which calls `make init`, `make verify-format`, `make test`,
`make update-version VERSION=x` and `make publish`.

## License

MIT © Sincpro S.R.L.
