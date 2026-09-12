# Deployment tests

For fast local checks, see the [development guide](development.md#verification).

## Run the suite

Use Node.js 20+, npm 9+, a running Docker daemon, and Chromium with its system
libraries. The browser runs on the host; PrairieLearn and its services run in the
official container.

```sh
npm ci
npx playwright install chromium --with-deps
npm run test:e2e
```

The runner uses the image pinned in `tests/e2e/upstream-image.txt`, creates a
disposable container, and copies the test course and current element build into
`/course`. It restores the saved database before starting PrairieLearn and exposes
port 3000 through a random localhost-only port. No host course directory or Docker
socket is mounted in the application container.

The suite covers staff-only activation, rubric grouping and required selections,
panel refreshes, settings, attribution, and persisted grading. Layout checks cover
sticky grading, viewport sizing, rubric settings, and narrow screens. Shared
locators and menu actions live in `tests/e2e/manual-grading-page.ts`.

Both views use the development-mode Dev User; production authentication is outside
the suite's scope. Failed writes are not automatically retried.

## Saved grading state

`tests/e2e/state/database.dump` contains the synced course, uploaded `fib.py`, an
ungraded submission, and a four-item rubric. Normal tests restore this state;
course creation, uploads, and rubric setup belong to
`tests/state/refresh.setup.ts`.

The accompanying `manifest.json` records the source image, course hash, dump
checksum, and IDs. Course or dump mismatches fail the run. When testing a different
image, PrairieLearn's startup script migrates the restored database. Restore or
migration failures stop the run and retain deployment logs.

To regenerate the fixture:

```sh
npm run fixtures:upstream
```

This command starts an empty deployment, prepares the course and submission, and
replaces `database.dump` and `manifest.json` after preparation succeeds. Commit
both files together and run `npm run test:e2e` to validate them. Set
`PRAIRIELEARN_IMAGE` to prepare state with a different image. Normal E2E runs do not
modify the committed snapshot.

## Upstream compatibility

PRs, branch pushes, and releases test the pinned image. The weekly and manual
compatibility workflow tests `latest` with the same saved state. To reproduce it:

```sh
PRAIRIELEARN_IMAGE=prairielearn/prairielearn:latest npm run test:upstream:e2e
```

Both E2E commands default to `tests/e2e/upstream-image.txt`;
`PRAIRIELEARN_IMAGE` overrides the pin. To upgrade it, test the target image against
the saved state, then copy the tested repository digest from
`test-results/deployment/image.json` into `tests/e2e/upstream-image.txt`.

## Diagnostics and cleanup

| Location                                      | Contents                                         |
| --------------------------------------------- | ------------------------------------------------ |
| `test-results/deployment/`                    | Image identity, container state, and server logs |
| `test-results/deployment/restored-state.json` | Snapshot source and target images                |
| `test-results/browser/`                       | Browser failure traces, screenshots, and videos  |

Open the browser report with `npx playwright show-report`.

The runner removes its container and volumes on success, failure, or handled
interruption. After a forced process kill, remove any leftover `plmge-e2e-`
container with `docker rm -fv <name>`.
