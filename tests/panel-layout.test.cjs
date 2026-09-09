const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
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
  assert.ok(window.document.querySelector(".plmge-sticky-grading"));
  assert.equal(window.document.querySelector(".plmge-options-menu"), null);
  assert.equal(window.document.querySelectorAll(".plmge-criterion").length, 2);
});

test("card sizing follows the main container and cleans up on disable and refresh", async () => {
  const dom = createPage();
  const { window } = dom;
  const { document } = window;
  const observers = new Set();
  window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.target = target;
      observers.add(this);
    }
    disconnect() {
      observers.delete(this);
    }
  };
  const container = document.querySelector(".app-main-container");
  let height = 800;
  Object.defineProperty(container, "clientHeight", { get: () => height });
  loadBundle(window);
  fireDOMContentLoaded(window);
  const option = () =>
    document.querySelector('[data-setting="splitScrolling"]');
  const card = document
    .querySelector(".js-main-grading-panel")
    .closest(".card");
  assert.equal(card.style.getPropertyValue("--plmge-card-height"), "784px");
  assert.equal(observers.size, 1);
  assert.equal([...observers][0].target, container);
  height = 600;
  for (const observer of observers) observer.callback();
  assert.equal(card.style.getPropertyValue("--plmge-card-height"), "584px");
  assert.equal(
    document.querySelector("#response-column").getAttribute("style"),
    null,
  );
  option().click();
  assert.equal(observers.size, 0);
  assert.equal(card.style.getPropertyValue("--plmge-card-height"), "");
  assert.equal(card.classList.contains("plmge-sticky-grading"), false);

  option().click();
  const previousObserver = [...observers][0];
  document
    .querySelector(".js-main-grading-panel")
    .append(document.createElement("div"));
  await new Promise((resolve) => window.queueMicrotask(resolve));
  assert.equal(observers.size, 1);
  assert.equal(observers.has(previousObserver), false);
  assert.equal(option().checked, true);
  assert.ok(card.classList.contains("plmge-sticky-grading"));
  assert.equal(document.querySelector(".plmge-feature-messages"), null);
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
  assert.equal(window.document.querySelector(".plmge-sticky-grading"), null);
  assert.equal(window.document.querySelectorAll(".plmge-criterion").length, 2);
  assert.match(
    window.document.querySelector(".plmge-feature-messages").textContent,
    /Panel layout/,
  );
});
