const assert = require("node:assert/strict");
const { test } = require("node:test");
const { boot, submit } = require("./fixtures.cjs");

test("each criterion is mutually exclusive and reports a valid summary", () => {
  const dom = boot();
  const { document } = dom.window;
  const opening = document.querySelectorAll(
    '.plmge-criterion [name="rubric_item_selected_manual"]',
  );
  const first = opening[0];
  const second = opening[1];

  first.click();
  second.click();

  assert.equal(first.checked, false);
  assert.equal(second.checked, true);
  assert.equal(second.closest(".plmge-criterion").dataset.state, "complete");
  assert.match(
    second.closest(".plmge-criterion").querySelector(".plmge-criterion-summary")
      .textContent,
    /Adequate \[\+2\]/,
  );
});

test("grade submission is blocked until exactly one item is selected in every group", () => {
  const dom = boot();
  const { document } = dom.window;
  const form = document.querySelector('form[name="manual-grading-form"]');
  const submitButton = form.querySelector('[value="add_manual_grade"]');

  const allowed = submit(form, submitButton);
  const error = document.querySelector(".plmge-error");
  assert.equal(allowed, false);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Opening/);
  assert.match(error.textContent, /Headers/);
  assert.equal(
    document.querySelectorAll('.plmge-criterion[data-state="invalid"]').length,
    2,
  );

  document.querySelector('[value="a1"]').click();
  document.querySelector('[value="b1"]').click();
  assert.equal(submit(form, submitButton), true);
  assert.equal(error.hidden, true);
  assert.equal(
    document.querySelectorAll('.plmge-criterion[data-state="invalid"]').length,
    0,
  );
});

test("only grading actions are intercepted; skip actions remain available", () => {
  const dom = boot();
  const { document } = dom.window;
  const form = document.querySelector('form[name="manual-grading-form"]');
  const skipButton = form.querySelector('[value="skip_manual_grade"]');

  assert.equal(submit(form, skipButton), true);
  assert.equal(document.querySelector(".plmge-error").hidden, true);
});
