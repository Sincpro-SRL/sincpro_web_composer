# Contributing

## Getting set up

```bash
make init
make test
```

Node 26 (`nvm use`). `make test` runs vitest: the model's rules in Node and every story — its `play` and its a11y check — in Chrome. The same tests run from Storybook's sidebar.

## Before you open a pull request

```bash
make verify-format
make typecheck
make test
```

`make verify-format` formats, lints and runs `doctor`, then fails if any of
that left the tree dirty — the same check CI runs.

## What a good change looks like

- **A test that would fail without it.**
- **A reason in the code.** Exported symbols carry a JSDoc block saying why the thing is the
  way it is; a comment that repeats the signature is noise.
- **Self-imports, not relative ones.** Source inside a package imports itself as
  `@sincpro/web-composer/...`, without the `.ts`/`.tsx` extension — `make doctor` catches both.

## Versions

Versions are set by the release pipeline, never by hand in a pull request.
