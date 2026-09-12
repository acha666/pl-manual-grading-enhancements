# Development

For installation and grading options, see the [README](../README.md).

## Local workflow

Use Node.js 20+, npm 9+, and Python 3.

```sh
npm ci
npm run dev       # Watch and rebuild JS/CSS with inline source maps
npm run check     # Check production and Playwright TypeScript
npm run format    # Apply formatting
npm run verify    # Check formatting, types, bundle behavior, and controller
npm run package   # Verify and stage an installable element in dist/
```

`npm run build` generates production assets in
`elements/pl-manual-grading-enhancements/dist/`. Copy the built element directory
into a PrairieLearn course and reload the grading page after changes. The element
runs inside PrairieLearn; there is no standalone application server.

TypeScript and esbuild produce a single classic-script bundle. Tests use the Node
test runner with jsdom. Generated assets are not committed.

## Source layout

| Path                                       | Responsibility                                               |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/main.ts`                              | Activation and grading-panel refreshes                       |
| `src/core/`                                | DOM contracts, settings, shared types, and feature lifecycle |
| `src/features/`                            | Grading enhancements                                         |
| `src/features/index.ts`                    | Feature composition and dependency wiring                    |
| `src/styles.css`                           | Element-scoped styles                                        |
| `scripts/build.mjs`                        | Builds and release staging                                   |
| `elements/pl-manual-grading-enhancements/` | Python controller, asset metadata, and third-party notices   |
| `tests/`                                   | Bundle, lifecycle, controller, and deployment tests          |

`RubricGroups` owns selection rules, submission validation, and collapse policy.
`CriterionView` owns group markup, summaries, accessibility, and restoration of
original rubric nodes. Keep grading policy in the coordinator and presentation
in the view.

`ShortcutManager` receives visible items through a callback. It owns generated
badges; the shared `RubricItem` contract describes upstream markup. Features use
`core/submission.ts` to identify grading actions.

`CodePreview` decorates native `.c` previews while enabled and restores plain text
on cleanup. `core/prism.ts` loads bundled Prism core, C-like, C, and Line Numbers
components on first use while preserving any host Prism instance. Preview styles
belong in `styles.css`.

## Adding a feature

1. Implement `Lifecycle` (`start()` / `stop()`) in `src/features/` and register it
   with `runtime.mount()` in `src/features/index.ts`. Pass dependencies through
   constructor parameters.
2. Keep PrairieLearn selectors in `core/config.ts` and validate markup in
   `core/contract.ts` or `core/feature-contracts.ts`.
3. Add persistent options to `SETTING_DEFINITIONS` in `core/settings.ts` and wire
   their behavior in `features/index.ts`. Types, defaults, validation, and menu
   controls derive from the definition. Preserve the storage key so users keep
   their preferences.
4. Add coverage for the behavior and cleanup, then run `npm run verify`.

`start()` may return `false` when a feature does not apply. `stop()` must tolerate
partial initialization and repeated calls. The runtime cleans up failed starts
and stops active features in reverse order, continuing after cleanup failures.
Register required grading validation as critical; optional failures should leave
unrelated features running. `core/failure-reporting.ts` handles visible errors.

## Verification

| Command                   | Coverage                                                 |
| ------------------------- | -------------------------------------------------------- |
| `npm run format:check`    | Repository formatting                                    |
| `npm run check`           | Production and Playwright types                          |
| `npm test`                | Builds and tests the minified shipping bundle with jsdom |
| `npm run test:controller` | Python activation and asset contracts; build first       |
| `npm run test:e2e`        | Real PrairieLearn deployment in Docker                   |

`npm run verify` runs the fast checks without Docker. Bundle tests are organized
by feature; `browser-integration.test.cjs` covers activation, contract failures,
and panel refreshes, and `runtime.test.cjs` covers startup and cleanup.
`tests/fixtures.cjs` provides shared markup, bundle loading, form submission,
and window cleanup.

The jsdom fixtures model upstream markup. Use the [deployment tests](testing.md)
to check behavior in a real browser and maintain the saved grading fixture.

## Packaging and releases

For local installation, run `npm run package` and copy
`dist/elements/pl-manual-grading-enhancements` into the course repository.
The package also stages the README and guides. Courses do not need Node.js or
TypeScript sources.

`package.json` is the source of the runtime version. To publish a release:

1. Update the changelog and commit the changes.
2. Run `npm version patch` (or `minor` / `major`) to create the version commit and tag.
3. Push the commit and tag, for example `git push origin main --follow-tags`.

The release workflow checks that `vX.Y.Z` matches `package.json`, runs local
verification and pinned Docker E2E, and publishes
`pl-manual-grading-enhancements.zip` containing the element, README, and guides.
