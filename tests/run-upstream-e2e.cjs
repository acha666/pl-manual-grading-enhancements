#!/usr/bin/env node

// Each run owns one disposable container, including its database and course.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "test-results", "deployment");
const image =
  process.env.PRAIRIELEARN_IMAGE ||
  fs
    .readFileSync(path.join(__dirname, "e2e", "upstream-image.txt"), "utf8")
    .trim();
const name = `plmge-e2e-${randomUUID()}`;
let created = false;
const stateDirectory = path.join(__dirname, "e2e", "state");
const refreshState = process.env.PLMGE_REFRESH_STATE === "1";

function courseHash(directory = path.join(__dirname, "e2e", "course")) {
  const hash = createHash("sha256");
  function visit(current, relative = "") {
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      const key = `${relative}/${name}`;
      if (fs.statSync(file).isDirectory()) visit(file, key);
      else hash.update(key).update(fs.readFileSync(file));
    }
  }
  visit(directory);
  return hash.digest("hex");
}
function dumpHash(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(
      `docker ${args[0]} failed: ${result.error?.message || result.stderr}`,
    );
  }
  return result.stdout || "";
}

function cleanup() {
  if (!created) return;
  try {
    fs.writeFileSync(
      path.join(artifacts, "container.json"),
      docker(["inspect", name], { allowFailure: true }),
    );
    // docker logs may emit application errors to stderr, so capture both streams.
    const logs = spawnSync("docker", ["logs", name], {
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    fs.writeFileSync(
      path.join(artifacts, "server.log"),
      (logs.stdout || "") + (logs.stderr || ""),
    );
  } finally {
    docker(["rm", "--force", "--volumes", name]);
    created = false;
  }
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

async function main() {
  fs.rmSync(path.join(root, "test-results"), { recursive: true, force: true });
  fs.rmSync(path.join(root, "playwright-report"), {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(artifacts, { recursive: true });
  docker(["pull", image]);
  const imageInfo = docker(["image", "inspect", image]);
  fs.writeFileSync(path.join(artifacts, "image.json"), imageInfo);
  const resolvedImage = JSON.parse(imageInfo)[0].RepoDigests[0];
  if (!refreshState) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(stateDirectory, "manifest.json"), "utf8"),
    );
    fs.writeFileSync(
      path.join(artifacts, "restored-state.json"),
      JSON.stringify(
        {
          sourceImage: manifest.image,
          targetImage: resolvedImage,
          dumpSha256: manifest.dumpSha256,
          migration:
            "Official init.sh migrates the restored database before starting the application",
        },
        null,
        2,
      ) + "\n",
    );
    if (
      manifest.courseSha256 !== courseHash() ||
      manifest.dumpSha256 !==
        dumpHash(path.join(stateDirectory, "database.dump"))
    ) {
      throw new Error(
        "Frozen state does not match the course/dump. Update it with npm run fixtures:upstream.",
      );
    }
  }
  const command = refreshState
    ? []
    : [
        "/bin/bash",
        "-ec",
        "/PrairieLearn/scripts/start_postgres.sh; dropdb --force --maintenance-db=template1 postgres; createdb --maintenance-db=template1 --template=template0 postgres; pg_restore --exit-on-error --no-owner --no-acl --dbname=postgres /tmp/plmge-state.dump; exec /PrairieLearn/scripts/init.sh",
      ];
  docker([
    "create",
    "--name",
    name,
    "--publish",
    "127.0.0.1::3000",
    image,
    ...command,
  ]);
  created = true;
  docker([
    "cp",
    `${path.join(__dirname, "e2e", "course")}/.`,
    `${name}:/course`,
  ]);
  // Copy the same controller, metadata and production assets shipped to courses.
  const staging = fs.mkdtempSync(
    path.join(require("node:os").tmpdir(), "plmge-course-"),
  );
  try {
    const element = path.join(
      staging,
      "elements",
      "pl-manual-grading-enhancements",
    );
    fs.mkdirSync(element, { recursive: true });
    for (const file of ["controller.py", "info.json", "dist"]) {
      fs.cpSync(
        path.join(root, "elements", "pl-manual-grading-enhancements", file),
        path.join(element, file),
        { recursive: true },
      );
    }
    docker(["cp", path.join(staging, "elements"), `${name}:/course/elements`]);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  if (!refreshState)
    docker([
      "cp",
      path.join(stateDirectory, "database.dump"),
      `${name}:/tmp/plmge-state.dump`,
    ]);
  docker(["start", name]);
  const port = docker(["port", name, "3000/tcp"]).trim().split(":").at(-1);
  const baseURL = `http://127.0.0.1:${port}`;
  console.log(`PrairieLearn ${image}\nWaiting for ${baseURL}`);
  const deadline = Date.now() + 180_000;
  while (true) {
    try {
      const response = await fetch(`${baseURL}/pl/webhooks/ping`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) break;
    } catch {
      /* Server is still starting. */
    }
    if (Date.now() >= deadline)
      throw new Error("PrairieLearn readiness timed out after 180 seconds");
    if (
      docker(["inspect", "--format", "{{.State.Running}}", name]).trim() !==
      "true"
    )
      throw new Error("PrairieLearn exited before becoming ready");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("@playwright/test/cli"),
      "test",
      "--config",
      "tests/e2e/playwright.config.ts",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        PLMGE_BASE_URL: baseURL,
        PLMGE_RESOLVED_IMAGE: resolvedImage,
        PLMGE_CONTAINER: name,
      },
      stdio: "inherit",
      timeout: 600_000,
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  if (result.status === 0 && refreshState) {
    // Only the explicit maintenance flow can replace the committed snapshot.
    const captured = path.join(artifacts, "state");
    const submission = JSON.parse(
      fs.readFileSync(path.join(captured, "submission.json"), "utf8"),
    );
    const manifest = {
      ...submission,
      image: resolvedImage,
      courseSha256: courseHash(),
      dumpSha256: dumpHash(path.join(captured, "database.dump")),
      stage:
        "Course synced; Dev User submitted fib.py; four-item rubric ready; waiting for manual grading; no grade yet",
      refresh: "npm run fixtures:upstream",
    };
    fs.mkdirSync(stateDirectory, { recursive: true });
    fs.copyFileSync(
      path.join(captured, "database.dump"),
      path.join(stateDirectory, "database.dump"),
    );
    fs.writeFileSync(
      path.join(stateDirectory, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    console.log(
      `Updated frozen PostgreSQL state (${fs.statSync(path.join(stateDirectory, "database.dump")).size} bytes)`,
    );
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
