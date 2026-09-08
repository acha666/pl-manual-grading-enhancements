# Development

Use Node.js 20+ and npm 9+; Python 3 is needed for controller tests.

```sh
npm ci
npm run dev       # Watch and rebuild JS/CSS with inline source maps
npm run check     # Strict TypeScript checking
npm run format    # Apply the shared formatting rules
npm run verify    # Formatting, type checking, bundle tests, Python tests
npm run package   # Verify and prepare dist/ for installation
```

`npm run build` generates the production JS/CSS in
`elements/pl-manual-grading-enhancements/dist/`. Copy the element directory after
building to test it in a PrairieLearn course. `npm run dev` rebuilds those files
as you edit; reload the grading page to use the changes. There is no standalone
application server because the element runs inside PrairieLearn.

The toolchain is TypeScript, esbuild, Prettier, and the existing Node test runner
with jsdom. No frontend framework or runtime dependency is shipped. Source files
use standard ES module imports; esbuild emits a single classic-script bundle for
PrairieLearn's element loader. Generated assets are not committed.

```text
src/
  main.ts          Activation and PrairieLearn panel refresh handling
  core/            DOM contracts, settings, shared types, feature lifecycle
  features/        Rubric grouping, shortcuts, attribution, options, panel layout
    index.ts       Explicit feature composition and dependency wiring
  styles.css       Element-scoped styles
scripts/
  build.mjs        Production/watch builds and release staging
elements/pl-manual-grading-enhancements/
  controller.py    PrairieLearn activation marker
  info.json        Generated JS/CSS dependency paths
tests/            Bundle behavior, lifecycle, controller, upstream E2E
```

## Module boundaries

`main.ts` owns activation and panel refreshes; `core/failure-reporting.ts` owns
user-visible initialization errors. `features/index.ts` is the composition root:
it creates features and connects their callbacks and settings.

`RubricGroups` owns selection rules, submission validation, and collapse policy.
`CriterionView` owns each group's markup, summaries, accessibility attributes,
and restoration of the original rubric nodes. Keep presentation changes in the
view and grading policy in the coordinator.

`ShortcutManager` receives a callback for visible items instead of depending on
the grouping implementation. It owns generated badges; the shared `RubricItem`
contract describes upstream markup, not feature-created UI state. Features share
`core/submission.ts` to identify grading actions consistently.

## Adding a feature

Implement the `Lifecycle` interface (`start()` / `stop()`) in `src/features/` and
register it with `runtime.mount()` in `src/features/index.ts`. Pass dependencies
explicitly through constructor parameters. `start()` may return `false` when the
feature does not apply. `stop()` must tolerate partial initialization and repeated
calls. The runtime cleans up failed starts and stops active features in reverse
order; a cleanup failure does not prevent other modules from stopping.

Keep PrairieLearn selectors in `core/config.ts` and validate markup in
`core/contract.ts` or `core/feature-contracts.ts`. Add persistent options to `SETTING_DEFINITIONS` in `core/settings.ts`; types,
defaults, storage validation, and menu controls derive from that definition.
Wire option behavior in `features/index.ts`. Preserve the existing storage key so users keep their preferences.
Required grading validation is registered as critical; optional feature failures
are reported without stopping unrelated enhancements. Browser tests exercise the
same minified bundle that is shipped to courses.

## Testing

| Layer                                  | Command                                 | Coverage                                                                                                                |
| -------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Types and formatting                   | `npm run check`, `npm run format:check` | Production and Playwright TypeScript, shared formatting                                                                 |
| DOM integration and lifecycle          | `npm test`                              | Minified shipping bundle, grouping, validation, shortcuts, settings, attribution, panel replacement and cleanup         |
| Python controller and element contract | `npm run test:controller`               | Activation rules and declared build assets (run `npm run build` first)                                                  |
| Real deployment E2E                    | `npm run test:e2e`                      | Official PrairieLearn container, restored submission/rubric, real Python rendering, panel refresh and persisted grading |

The jsdom fixtures model the expected upstream DOM; they do not replace browser
compatibility testing. Windows are cleaned up after every test, including failed
assertions. `npm run verify` runs the fast checks without requiring Docker.

See [deployment tests](testing.md) for Docker setup, fixture maintenance, and upstream compatibility checks.

Browser tests are split by feature (`rubric-groups`, `shortcuts`, `attribution`,
`view-options`, `panel-layout`, `answer-preview`, and `score-colors`).
`browser-integration.test.cjs` covers activation, contract failures, and panel
refreshes; `runtime.test.cjs` covers feature startup and cleanup.
`tests/fixtures.cjs` owns the shared page markup, production bundle loading,
form submission helper, and window cleanup.

The deployment workflow uses `tests/e2e/manual-grading-page.ts` for shared locators
and menu interactions. Its assertions cover layout persistence through panel
replacement, option changes, desktop resizing, and the narrow-screen layout,
alongside rubric validation and saved grading results.
