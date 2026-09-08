const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  boot,
  createPage,
  fireDOMContentLoaded,
  loadBundle,
} = require("./fixtures.cjs");

test("panel layout remains available without Bootstrap dropdown support", () => {
  const dom = createPage();
  const { window } = dom;
  delete window.bootstrap;
  window.localStorage.setItem(
    "pl.manualGradingEnhancements.settings.v1",
    JSON.stringify({ splitScrolling: true }),
  );
  loadBundle(window);
  fireDOMContentLoaded(window);
  assert.ok(window.document.querySelector(".plmge-split-scroll"));
  assert.equal(window.document.querySelector(".plmge-options-menu"), null);
  assert.equal(window.document.querySelectorAll(".plmge-criterion").length, 2);
});

test("panel resizing respects disabled settings and cancels pending work on refresh", async () => {
  const dom = boot();
  const { window } = dom;
  const { document } = window;
  const frames = new Map();
  let nextFrame = 0;
  window.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  const option = () =>
    document.querySelector('[data-setting="splitScrolling"]');
  const row = document.querySelector(".plmge-layout");
  option().click();
  assert.ok(row.style.getPropertyValue("--plmge-pane-height"));
  window.dispatchEvent(new window.Event("resize"));
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(frames.size, 1);
  option().click();
  for (const callback of frames.values()) callback();
  frames.clear();
  assert.equal(row.style.getPropertyValue("--plmge-pane-height"), "");
  assert.equal(row.classList.contains("plmge-split-scroll"), false);

  option().click();
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(frames.size, 1);
  document
    .querySelector(".js-main-grading-panel")
    .append(document.createElement("div"));
  await new Promise((resolve) => window.queueMicrotask(resolve));
  assert.equal(frames.size, 0);
  assert.equal(option().checked, true);
  assert.ok(row.classList.contains("plmge-split-scroll"));
  assert.equal(document.querySelector(".plmge-feature-messages"), null);
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(frames.size, 1);
});

test("unsupported pane markup disables only the scrolling option", () => {
  const dom = createPage();
  const { window } = dom;
  window.document.querySelector("#response-column").className =
    "custom-response";
  loadBundle(window);
  fireDOMContentLoaded(window);
  assert.equal(
    window.document.querySelector('[data-setting="splitScrolling"]').disabled,
    true,
  );
  assert.equal(
    window.document.querySelector('[data-setting="collapseCompleted"]')
      .disabled,
    false,
  );
  assert.equal(window.document.querySelector(".plmge-layout"), null);
  assert.equal(window.document.querySelectorAll(".plmge-criterion").length, 2);
  assert.match(
    window.document.querySelector(".plmge-feature-messages").textContent,
    /Panel layout/,
  );
});
