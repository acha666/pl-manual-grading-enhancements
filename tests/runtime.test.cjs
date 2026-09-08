const assert = require("node:assert/strict");
const { test } = require("node:test");
const vm = require("node:vm");
const { buildSync } = require("esbuild");

const bundle = buildSync({
  entryPoints: ["src/core/runtime.ts"],
  bundle: true,
  write: false,
  format: "cjs",
  platform: "node",
}).outputFiles[0].text;
const context = { module: { exports: {} }, console: { error() {} } };
vm.runInNewContext(bundle, context);
const { FeatureRuntime } = context.module.exports;

test("failed starts roll back and report severity; other modules keep running", () => {
  const events = [];
  const runtime = new FeatureRuntime((name, error, critical) =>
    events.push([name, error.message, critical]),
  );
  const result = runtime.mount(
    "validation",
    () => ({
      start() {
        throw new Error("partial initialization");
      },
      stop() {
        events.push("rollback");
      },
    }),
    true,
  );
  assert.equal(result, null);
  runtime.mount("optional", () => ({
    start() {
      events.push("started");
    },
    stop() {
      events.push("stopped");
    },
  }));
  runtime.stop();
  assert.deepEqual(events, [
    "rollback",
    ["validation", "partial initialization", true],
    "started",
    "stopped",
  ]);
});

test("cleanup is reversed, idempotent, and survives a failed cleanup", () => {
  const events = [];
  const runtime = new FeatureRuntime(() => {});
  for (const name of ["first", "second", "third"]) {
    runtime.mount(name, () => ({
      start() {},
      stop() {
        events.push(name);
        if (name === "second") throw new Error("cleanup failed");
      },
    }));
  }
  runtime.stop();
  runtime.stop();
  assert.deepEqual(events, ["third", "second", "first"]);
});

test("inapplicable features are cleaned immediately and are not registered", () => {
  let stops = 0;
  const runtime = new FeatureRuntime(() => assert.fail("unexpected failure"));
  assert.equal(
    runtime.mount("unused", () => ({
      start() {
        return false;
      },
      stop() {
        stops++;
      },
    })),
    null,
  );
  runtime.stop();
  assert.equal(stops, 1);
});

test("factory failures are reported without blocking later features", () => {
  const reports = [];
  const runtime = new FeatureRuntime((...args) => reports.push(args));
  const error = new Error("constructor failed");
  assert.equal(
    runtime.mount("broken", () => {
      throw error;
    }),
    null,
  );
  const feature = { start() {}, stop() {} };
  assert.equal(
    runtime.mount("healthy", () => feature),
    feature,
  );
  assert.deepEqual(reports, [["broken", error, false]]);
  runtime.stop();
});

test("a failed rollback preserves the original initialization error", () => {
  const reports = [];
  const runtime = new FeatureRuntime((...args) => reports.push(args));
  const error = new Error("initialization failed");
  let stops = 0;
  runtime.mount(
    "critical",
    () => ({
      start() {
        throw error;
      },
      stop() {
        stops++;
        throw new Error("rollback failed");
      },
    }),
    true,
  );
  runtime.stop();
  assert.equal(stops, 1);
  assert.deepEqual(reports, [["critical", error, true]]);
});
