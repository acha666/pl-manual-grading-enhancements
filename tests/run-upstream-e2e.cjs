#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const upstreamRoot = path.resolve(
  process.env.PRAIRIELEARN_SOURCE_DIR || path.join(projectRoot, ".ci", "prairielearn"),
);
const upstreamCourse = path.join(upstreamRoot, "testCourse");
const elementSource = path.join(projectRoot, "elements", "pl-manual-grading-enhancements");
const elementTarget = path.join(upstreamCourse, "elements", "pl-manual-grading-enhancements");
const questionPath = path.join(
  upstreamCourse,
  "questions",
  "manualGrade",
  "codeUpload",
  "question.html",
);
const e2eDir = path.join(upstreamRoot, "apps", "prairielearn", "src", "tests", "e2e");

function fail(message) {
  console.error(`upstream E2E setup: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(path.join(upstreamRoot, "package.json"))) {
  fail(`PrairieLearn checkout not found at ${upstreamRoot}`);
}

fs.cpSync(elementSource, elementTarget, {
  recursive: true,
  filter: (source) => !source.split(path.sep).includes('__pycache__') && !source.endsWith('.pyc'),
});

const question = fs.readFileSync(questionPath, "utf8");
const elementTag = "<pl-manual-grading-enhancements></pl-manual-grading-enhancements>";
if (!question.includes(elementTag)) {
  fs.writeFileSync(questionPath, `${question.trimEnd()}\n\n${elementTag}\n`);
}

for (const name of ["plmgeManualGrading.spec.ts", "plmgeManualGrading.spec.sql"]) {
  fs.copyFileSync(path.join(projectRoot, "tests", "e2e", name), path.join(e2eDir, name));
}

const result = spawnSync(
  "pnpm",
  ["--filter", "@prairielearn/prairielearn", "test:e2e", "src/tests/e2e/plmgeManualGrading.spec.ts"],
  {
    cwd: upstreamRoot,
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
