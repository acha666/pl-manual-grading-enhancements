const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  boot,
  createPage,
  fireDOMContentLoaded,
  loadBundle,
  submit,
} = require("./fixtures.cjs");

test("full PrairieLearn-shaped page initializes and builds grouped criteria", () => {
  const dom = boot();
  const { document } = dom.window;

  assert.ok(document.documentElement.dataset.plManualGradingEnhancements);
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
  assert.deepEqual(
    [...document.querySelectorAll(".plmge-criterion-name")].map(
      (node) => node.textContent,
    ),
    ["Opening", "Headers"],
  );
  assert.equal(document.querySelectorAll(".plmge-item").length, 4);
  assert.equal(
    document.querySelectorAll(".plmge-item input.js-selectable-rubric-item")
      .length,
    4,
  );
  assert.deepEqual(
    [...document.querySelectorAll(".plmge-criterion")].map(
      (criterion) => criterion.querySelectorAll(".plmge-item").length,
    ),
    [2, 2],
  );
  assert.equal(
    document.querySelector('[value="u1"]').closest(".plmge-item"),
    null,
  );
  assert.equal(
    document
      .querySelector('[value="a1"]')
      .closest("label")
      .querySelector('[data-testid="rubric-item-description"]').textContent,
    "Excellent",
  );
  assert.equal(
    document.querySelector('[value="a1"] + .pl-kbd').textContent,
    "1",
  );
  assert.equal(
    document
      .querySelector('[value="a1"]')
      .closest("label")
      .textContent.includes("Excellent"),
    true,
  );
  assert.equal(
    document
      .querySelector('[value="a1"]')
      .closest("label")
      .textContent.includes("[Opening]"),
    false,
  );
  assert.ok(document.querySelector(".plmge-options-menu"));
});

test("reinitializes after PrairieLearn replaces the grading panel contents", async () => {
  const source = createPage();
  const replacement = source.window.document.querySelector(
    ".js-main-grading-panel",
  ).innerHTML;
  source.window.close();

  const dom = boot();
  const { document } = dom.window;
  document.querySelector(".js-main-grading-panel").innerHTML = replacement;

  await new Promise((resolve) => dom.window.queueMicrotask(resolve));

  assert.ok(document.documentElement.dataset.plManualGradingEnhancements);
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
  assert.equal(document.querySelectorAll(".plmge-options-menu").length, 1);

  const form = document.querySelector('form[name="manual-grading-form"]');
  const submitButton = form.querySelector('[value="add_manual_grade"]');
  assert.equal(submit(form, submitButton), false);
  assert.match(document.querySelector(".plmge-error").textContent, /Opening/);
});

test("the main grading form wins over conflict-modal forms", () => {
  const dom = boot({ includeConflictForm: true });
  const { document } = dom.window;

  assert.equal(
    document.querySelectorAll('form[name="manual-grading-form"]').length,
    2,
  );
  assert.equal(
    document.querySelector(".js-main-grading-panel form").closest(".modal"),
    null,
  );
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
});

test("a read-only grading panel does not fail because it has no grade action", () => {
  const dom = createPage();
  const { document } = dom.window;
  document.querySelector('[value="add_manual_grade"]').remove();
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);

  assert.ok(document.documentElement.dataset.plManualGradingEnhancements);
  assert.equal(document.querySelector(".plmge-feature-messages"), null);
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
});

test("optional view failure does not stop rubric validation or attribution", () => {
  const dom = boot({ malformed: true });
  const { document } = dom.window;
  const form = document.querySelector('form[name="manual-grading-form"]');

  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
  assert.match(
    document.querySelector(".plmge-feature-messages").textContent,
    /View options/,
  );
  document.querySelector('[value="a1"]').click();
  document.querySelector('[value="b1"]').click();
  const feedback = document.querySelector("textarea.js-submission-feedback");
  submit(form, form.querySelector('[value="add_manual_grade"]'));
  assert.match(feedback.value, /Graded by: Ada Lovelace/);
});

test("a critical page-contract failure disables grading and leaves a visible error", () => {
  const dom = boot({ extraMarker: true });
  const { document } = dom.window;
  const submitButton = document.querySelector('[value="add_manual_grade"]');

  assert.equal(
    document.documentElement.dataset.plManualGradingEnhancements,
    "failed",
  );
  assert.equal(submitButton.disabled, true);
  assert.match(
    document.querySelector(".alert-danger").textContent,
    /Grade submission has been disabled/,
  );
});

test("AI grading render is not activated by the element", () => {
  const dom = boot({ aiGrading: true });
  const { document } = dom.window;

  assert.equal(
    document.documentElement.dataset.plManualGradingEnhancements,
    undefined,
  );
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 0);
});

test("the standalone bundle is idempotent and does not expose feature globals", () => {
  const dom = boot();
  loadBundle(dom.window);
  assert.equal(dom.window.PLMGE, undefined);
  assert.equal(
    dom.window.document.querySelectorAll(".plmge-criterion").length,
    2,
  );
  assert.equal(
    dom.window.document.querySelectorAll(".plmge-options-menu").length,
    1,
  );
});

test("refreshing an existing form restores labels and preserves selected items", async () => {
  const dom = boot();
  const { document } = dom.window;
  const first = document.querySelector('[value="a1"]');
  first.click();
  document
    .querySelector(".js-main-grading-panel")
    .append(document.createElement("div"));
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(document.querySelector('[value="a1"]'), first);
  assert.equal(first.checked, true);
  assert.equal(document.querySelector(".plmge-feature-messages"), null);
  assert.equal(
    first.closest(".plmge-criterion").querySelector(".plmge-criterion-body")
      .hidden,
    true,
  );
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
  assert.equal(document.querySelectorAll(".plmge-options-menu").length, 1);
  assert.equal(
    first
      .closest("label")
      .querySelector('[data-testid="rubric-item-description"]').textContent,
    "Excellent",
  );
  const form = first.form;
  assert.equal(
    submit(form, form.querySelector('[value="add_manual_grade"]')),
    false,
  );
  document.querySelector('[value="b1"]').click();
  assert.equal(
    submit(form, form.querySelector('[value="add_manual_grade"]')),
    true,
  );
});

test("repeated refreshes preserve rich descriptions and original rubric nodes", async () => {
  const dom = createPage();
  const { document } = dom.window;
  const input = document.querySelector('[value="a1"]');
  const description = input
    .closest("label")
    .querySelector('[data-testid="rubric-item-description"]');
  description.innerHTML = "[<em>Opening</em>] <strong>Excellent</strong>";
  const emphasis = description.querySelector("strong");
  const originalRows = [...document.querySelectorAll(".rubric-row")];
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  input.click();

  for (let refresh = 0; refresh < 3; refresh++) {
    document
      .querySelector(".js-main-grading-panel")
      .append(document.createElement("div"));
    await new Promise((resolve) => dom.window.queueMicrotask(resolve));

    assert.equal(document.querySelector('[value="a1"]'), input);
    assert.equal(input.checked, true);
    assert.equal(description.textContent, "Excellent");
    assert.equal(description.querySelector("strong"), emphasis);
    assert.deepEqual(
      [...document.querySelectorAll(".rubric-row")],
      originalRows,
    );
    assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
    assert.equal(document.querySelector(".plmge-feature-messages"), null);
  }
});
