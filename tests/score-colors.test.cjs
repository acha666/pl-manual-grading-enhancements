const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createPage,
  fireDOMContentLoaded,
  loadBundle,
} = require("./fixtures.cjs");

test("colors rubric score fractions by the amount of credit", () => {
  const dom = createPage();
  const { document } = dom.window;
  document.querySelector(
    '[data-testid="rubric-item-description"]',
  ).textContent = "Full (6/6), partial (3/6), and no credit (0/6)";

  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  document.querySelector('[data-setting="scoreColors"]').click();

  assert.deepEqual(
    [...document.querySelectorAll(".plmge-score")].map((score) => [
      score.textContent,
      score.className,
    ]),
    [
      ["(6/6)", "plmge-score text-success"],
      ["(3/6)", "plmge-score text-warning"],
      ["(0/6)", "plmge-score text-danger"],
    ],
  );
});

test("colors the selected criterion score in its heading", () => {
  const dom = createPage();
  const { document } = dom.window;
  document.querySelector(
    '[data-testid="rubric-item-description"]',
  ).textContent = "[Opening] Excellent (6/6)";

  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  document.querySelector('[value="a1"]').click();
  document.querySelector('[data-setting="scoreColors"]').click();

  assert.equal(
    document.querySelector(
      "#plmge-criterion-heading-1 .plmge-criterion-summary-score",
    ).className,
    "plmge-score text-success plmge-criterion-summary-score",
  );
  assert.equal(
    document.querySelector(
      "#plmge-criterion-heading-1 .plmge-criterion-summary .plmge-score",
    ).textContent,
    "(6/6)",
  );
  assert.equal(
    document.querySelector(
      "#plmge-criterion-heading-1 .plmge-criterion-summary .plmge-score",
    ).className,
    "plmge-score text-success",
  );
});
