# Contributing

Thanks for wanting to contribute.

Branch off `main`, make your change, and open a pull request against `main`.
There is no gate in front of the push and no signature the PR body has to carry.

## Before you push

```sh
pnpm install
pnpm run check
```

`pnpm run check` is build, lint, format check, typecheck, tests, and a check that the committed skills still match their generator.
Run it locally and read the output.
GitHub keeps Actions switched off on a forked repository until they are enabled, so do not assume a green checkmark will appear on the PR to catch what you missed.

Use TDD for bug fixes and new features.
For a bug, reproduce it end to end first, the way someone using the tool would hit it, so the fix addresses the real cause.

## Repo conventions

- Node 22+, ESM-only JavaScript, validated through TypeScript's `checkJs` rather than written in TypeScript.
- Regenerate the installable skills with `pnpm run build:skill` and commit the result. `pnpm run check` fails if they drift.
- Do not reformat repo-provided `.agents/` skill content. `.prettierignore` excludes it deliberately.
- Do not hand-edit `CHANGELOG.md` or `.release-please-manifest.json`. release-please owned them and the workflow is now disabled, so treat both as frozen history.

## Things worth knowing

This project is a hard fork of [lavish-axi](https://github.com/kunchenguid/lavish-axi) and does not track it, so send changes here rather than upstream.

Nothing publishes to npm from this repository.
The release workflow is disabled, and no build here injects an analytics endpoint, so neither binary reports telemetry.

`AGENTS.md` is the architecture reference. It is long, and it is the fastest way to understand the process model, the session store, and the injected artifact SDK before changing any of them.

## Questions

Open an issue.
