const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  boot,
  createPage,
  fireDOMContentLoaded,
  loadBundle,
  criterionFor,
} = require("./fixtures.cjs");

for (const score of [null, "[]", "[NaN]", "[+Infinity]"]) {
  test(`invalid displayed rubric score fails closed: ${score}`, () => {
    const { window } = createPage();
    const node = window.document.querySelector(
      '[data-testid="rubric-item-points"]',
    );
    if (score === null) node.remove();
    else node.textContent = score;
    loadBundle(window);
    fireDOMContentLoaded(window);
    assert.equal(
      window.document.documentElement.dataset.plManualGradingEnhancements,
      "failed",
    );
    assert.equal(
      window.document.querySelector('[value="add_manual_grade"]').disabled,
      true,
    );
  });
}

test("display changes update summaries without collapsing manually opened criteria", async () => {
  const { window } = boot();
  const { document } = window;
  const input = document.querySelector('[value="a1"]');
  input.click();
  const criterion = criterionFor(input);
  criterion.querySelector("button").click();
  input
    .closest("label")
    .querySelector('[data-testid="rubric-item-points"]').textContent =
    "[+12.5%]";
  await new Promise((resolve) => window.queueMicrotask(resolve));
  assert.match(criterion.textContent, /\[\+12.5%\]/);
  assert.equal(input.closest(".plmge-item").hidden, false);
  assert.equal(criterionFor(input), criterion);
});

test("rubric rows retain their native parents and positions", () => {
  const { window } = createPage();
  const { document } = window;
  const rows = [...document.querySelectorAll(".rubric-row")];
  const parents = rows.map((row) => row.parentElement);
  loadBundle(window);
  fireDOMContentLoaded(window);
  assert.deepEqual(
    rows.map((row) => row.parentElement),
    parents,
  );
  assert.deepEqual([...document.querySelectorAll(".rubric-row")], rows);
});

test("upstream data updates refresh key-only changes on the same form", async () => {
  const { window } = boot();
  const { document } = window;
  document.querySelector('[data-setting="collapseCompleted"]').click();
  const input = document.querySelector('[value="a1"]');
  const form = input.form;
  document.addEventListener(
    "instance-question-grading-panel-update",
    () => {
      input.dataset.keyBinding = "9";
      input.closest("label").querySelector("kbd").textContent = "9";
    },
    { once: true },
  );
  document.dispatchEvent(
    new window.Event("instance-question-grading-panel-update"),
  );
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  document.body.dispatchEvent(
    new window.KeyboardEvent("keydown", {
      key: "9",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(input.checked, true);
  assert.equal(input.form, form);
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
  assert.equal(document.querySelector(".plmge-feature-messages"), null);
});

for (const description of [
  "[Opening] Excellent (4/4)",
  "[<em>Opening</em>] <strong>Excellent (4/4)</strong>",
]) {
  test(`score coloring preserves group prefixes on refresh: ${description}`, async () => {
    const { window } = createPage();
    const { document } = window;
    const label = document.querySelector(
      '[data-testid="rubric-item-description"]',
    );
    label.innerHTML = description;
    const emphasis = label.querySelector("strong");
    loadBundle(window);
    fireDOMContentLoaded(window);
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(
        new window.Event("instance-question-grading-panel-update"),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      assert.ok(document.querySelector('[value="a1"]').closest(".plmge-item"));
      assert.equal(label.textContent, "Excellent (4/4)");
      assert.equal(label.querySelector("strong"), emphasis);
    }
  });
}
