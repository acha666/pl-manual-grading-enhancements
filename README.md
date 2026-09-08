# PrairieLearn Manual Grading Enhancements

This course-specific PrairieLearn element adds small client-side enhancements to the manual-grading page. Its core feature groups rubric items into required criteria; optional settings provide panel layout, shortcut, and grader-attribution improvements.

## Installation

Download `pl-manual-grading-enhancements.zip` from a GitHub release and extract it into the course repository. It contains the ready-to-use `elements/pl-manual-grading-enhancements` directory. Add the element once near the end of each applicable `question.html`:

```html
<pl-manual-grading-enhancements></pl-manual-grading-enhancements>
```

The element renders a hidden marker only in the human manual-grading question panel. It renders nothing for students or AI grading.

## Group rubric items

Start a rubric item description with a bracketed criterion name:

```text
[Opening Documentation] Exceptional
[Opening Documentation] One item missing or incorrect
[Opening Documentation] Three or more items missing or incorrect

[Headers] Exceptional
[Headers] Unnecessary header included
[Headers] Required header missing
```

Each distinct prefix creates one criterion. The prefix is displayed as the criterion heading and removed from the item label. Items without a prefix remain unchanged.

Grouped criteria have these rules:

- Exactly one item must be selected in every criterion before a grade can be submitted.
- Selecting an item clears the other items in the same criterion.
- Rubric item IDs and PrairieLearn's rubric data model are unchanged.
- Validation is client-side workflow protection; it is not server-side validation.

## Options

The **Manual grading options** menu is available in the Grading card header. Settings are stored in local storage for the current browser profile.

### Independent panel scrolling

On desktop widths, the response and Grading panes scroll independently. Narrow screens retain the normal document layout.

### Collapse completed criteria

Completed criteria collapse after one item is selected. Their headings remain available for changes.

When enabled, digits `1` through `9`, followed by `0`, are assigned to visible grouped items in document order. Digit shortcuts already assigned to ungrouped items remain reserved.

### Append grader name to feedback

Enabled by default. Before a valid grade submission, the element appends this line to the feedback field:

```text
Graded by: Grader Name
```

The name is read from PrairieLearn's authenticated staff menu. A terminal `Graded by:` line is replaced rather than duplicated. Skip, navigation, and reassignment actions do not add attribution.

## Compatibility and failure behavior

The integration targets PrairieLearn's current manual-grading markup and Bootstrap dropdown support. It validates the activation marker, the main grading panel, the grading form, rubric inputs, and required controls before changing the page. It also reinitializes after PrairieLearn refreshes the grading panel in place, such as after rubric or AI-grading updates.

The grading form is resolved inside the main grading panel, so other manual-grading forms in conflict modals are ignored. If the core contract is invalid, available grade-submission buttons are disabled and a visible error is shown. Read-only pages without grade actions remain usable. Optional feature failures disable only the affected feature and show a warning; details are also written to the browser console.

The element makes no network requests and does not store sensitive information.

## Development

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
  features/        Rubric grouping, shortcuts, attribution, view options
    index.ts       Explicit feature composition and dependency wiring
  styles.css       Element-scoped styles
scripts/
  build.mjs        Production/watch builds and release staging
elements/pl-manual-grading-enhancements/
  controller.py    PrairieLearn activation marker
  info.json        Generated JS/CSS dependency paths
tests/            Bundle behavior, lifecycle, controller, upstream E2E
```

### Adding a feature

Implement the `Lifecycle` interface (`start()` / `stop()`) in `src/features/` and
register it with `runtime.mount()` in `src/features/index.ts`. Pass dependencies
explicitly through constructor parameters. `start()` may return `false` when the
feature does not apply. `stop()` must tolerate partial initialization and repeated
calls. The runtime cleans up failed starts and stops active features in reverse
order; a cleanup failure does not prevent other modules from stopping.

Keep PrairieLearn markup assumptions in `core/contract.ts`. Add persistent option
keys to `Settings` and `DEFAULT_SETTINGS`, and expose their controls in
`ViewOptions`. Preserve the existing storage key so users keep their preferences.
Required grading validation is registered as critical; optional feature failures
are reported without stopping unrelated enhancements. Browser tests exercise the
same minified bundle that is shipped to courses.

### Testing

| Layer                                  | Command                                 | Coverage                                                                                                                |
| -------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Types and formatting                   | `npm run check`, `npm run format:check` | Production and Playwright TypeScript, shared formatting                                                                 |
| DOM integration and lifecycle          | `npm test`                              | Minified shipping bundle, grouping, validation, shortcuts, settings, attribution, panel replacement and cleanup         |
| Python controller and element contract | `npm run test:controller`               | Activation rules and declared build assets (run `npm run build` first)                                                  |
| Real deployment E2E                    | `npm run test:e2e`                      | Official PrairieLearn container, restored submission/rubric, real Python rendering, panel refresh and persisted grading |

The jsdom fixtures model the expected upstream DOM; they do not replace browser
compatibility testing. Windows are cleaned up after every test, including failed
assertions. `npm run verify` runs the fast checks without requiring Docker.

### Docker deployment E2E

Prerequisites: a running Docker daemon, Node.js, and Chromium with its system
libraries. The browser runs on the host; the real PrairieLearn application and
its support services run inside the official container using its normal entrypoint.
No upstream checkout, pnpm, host PostgreSQL, or host Redis is needed.

```sh
npm ci
npx playwright install chromium --with-deps
npm run test:e2e
```

The runner pulls the immutable image recorded in `tests/e2e/upstream-image.txt`,
creates a disposable container, copies the minimal course and built element into
`/course`, restores the frozen PostgreSQL state, and waits for the application health endpoint. It publishes port 3000
on a random **localhost-only** port. Each run owns its database and course; no
Docker socket or host course directory is mounted inside the application.

All E2E runs, including the weekly latest-upstream check, restore
`tests/e2e/state/database.dump` **before the application starts**. This logical
PostgreSQL backup contains the synced course, uploaded `fib.py`, saved submission,
and four-item rubric. Tests begin with an ungraded submission ready for grading.
The element's current build is copied fresh on every run.

The E2E suite covers this element: activation only on the staff grading page,
grouping and required selections, panel replacement, settings, attribution, and
persisted grading. It edits an existing rubric item to trigger panel replacement,
but does not create courses, upload files, or answer questions. Those operations
belong exclusively to the state-update procedure in `tests/state/refresh.setup.ts`,
which is not discovered by the normal E2E suite.

The manifest records the snapshot's source image, course hash, dump checksum and
IDs. Course or dump mismatches fail explicitly. A different target image is
allowed: the runner restores the snapshot into an empty database and invokes the
official startup script, which runs upstream database migrations before serving
the application. `test-results/deployment/restored-state.json` records the source
and target images. Restore/migration failures fail CI with deployment logs;
tests never fall back to rebuilding the course or submitting another answer.

To update the saved state explicitly:

```sh
npm run fixtures:upstream
```

This maintenance command starts an empty deployment, loads the course, submits the
file, creates the rubric, and exports the ungraded database. It replaces
`database.dump` and `manifest.json` only after preparation succeeds. Commit both
files together, and run `npm run test:e2e` to validate the resulting snapshot.
Use `PRAIRIELEARN_IMAGE` to prepare state with another upstream image when needed.
Ordinary E2E runs never modify the committed snapshot.

Development-mode Dev User is used for both views; production authentication is
outside this suite's scope. No automatic retries repeat a failed write.

The runner collects the resolved image identity, container state, and server logs
in `test-results/deployment/`, and removes the container and its volumes on success,
failure, or handled interruption. Browser failure traces, screenshots and videos
are under `test-results/browser/`; open the report with `npx playwright show-report`.
A forced process kill cannot run cleanup; identify any leftover container by its
`plmge-e2e-` name and remove it with `docker rm -fv <name>`.

PRs, branch pushes, and releases run the pinned deployment test. The weekly/manual
upstream compatibility workflow restores the same saved state into the mutable
`latest` image and runs the same element tests.
To reproduce that check locally:

```sh
npm run test:upstream:e2e
```

To update the baseline, validate the new image against the saved state, copy its
tested repository digest from `test-results/deployment/image.json` into
`tests/e2e/upstream-image.txt`, and commit the image pin. An image upgrade does not
require regenerating state: reuse the snapshot through upstream migrations.
Refresh state only when the fixture scenario changes or an explicit replacement
is needed.
`npm run test:upstream:e2e` defaults to the latest upstream image, matching the
weekly workflow. `PRAIRIELEARN_IMAGE` can override its image for reproducing a
failure. The saved state is shared by both pinned and latest-upstream tests;
it does not pin the application version.
`PRAIRIELEARN_SOURCE_DIR` is no longer used.

See the [official PrairieLearn Docker installation guide](https://docs.prairielearn.com/installing/)
for details about the upstream deployment image.

## Release

`package.json` is the single source of the runtime version. To release:

1. Update the version with `npm version patch` (or `minor` / `major`) after committing changes.
2. Push the commit and its version tag, for example `git push origin main --follow-tags`.
3. The tag workflow verifies that `vX.Y.Z` matches `package.json`, runs all local
   checks and the pinned Docker E2E, then publishes a GitHub release containing the installable ZIP.

For local installation without publishing, run `npm run package` and copy
`dist/elements/pl-manual-grading-enhancements` into the course repository. The
course needs only the packaged controller, metadata, JavaScript, and CSS; it does
not need Node.js or the TypeScript sources.

## Removal

Remove the element tag from the affected `question.html` files. The element directory can then be removed after no questions reference it.
