# Deployment tests

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
persisted grading. Layout checks cover sticky grading, viewport sizing, expanded
rubric settings, and narrow screens. It edits an existing rubric item to trigger panel replacement,
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
To reproduce the latest-upstream check locally:

```sh
PRAIRIELEARN_IMAGE=prairielearn/prairielearn:latest npm run test:upstream:e2e
```

Both E2E commands default to the image in `tests/e2e/upstream-image.txt`.
`PRAIRIELEARN_IMAGE` overrides that image. To upgrade the pin, validate the target
image against the saved state and copy its tested repository digest from
`test-results/deployment/image.json` into `tests/e2e/upstream-image.txt`.
Upstream migrations allow the saved state to be reused across image upgrades.
