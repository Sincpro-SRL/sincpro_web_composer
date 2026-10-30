# @sincpro/web-composer

The Sincpro multitasking workspace for React: tabs, panels, peek, global panels and ⌘K over
references, so each domain plugs in without knowing the others.

```bash
yarn add @sincpro/web-composer react react-dom
```

Requires React 19 or newer.

## Development

```bash
nvm use       # Node 26, from .nvmrc
make init     # pre-commit + yarn install
make test
make build
```

Every operation — local or CI — goes through the `Makefile`; run `make` to list the targets.

```text
src/      the published source (imports itself as @sincpro/web-composer)
tests/    node --test over the TypeScript sources
```

## CI/CD

The workflows in `.github/workflows/` only delegate to the shared `Sincpro-SRL/.github`
pipeline, which calls `make init`, `make verify-format`, `make test`,
`make update-version VERSION=x` and `make publish`.
