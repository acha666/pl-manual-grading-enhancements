const assert = require("node:assert/strict");
const { test } = require("node:test");
const { boot, submit } = require("./fixtures.cjs");

test("valid grading appends the authenticated grader name and emits input", () => {
  const dom = boot();
  const { document, Event } = dom.window;
  const form = document.querySelector('form[name="manual-grading-form"]');
  const feedback = document.querySelector("textarea.js-submission-feedback");
  let inputEvents = 0;
  feedback.addEventListener("input", (event) => {
    assert.equal(event instanceof Event, true);
    inputEvents += 1;
  });
  feedback.value = "Clear explanation\n\nGraded by: Old Name";
  document.querySelector('[value="a1"]').click();
  document.querySelector('[value="b1"]').click();

  assert.equal(
    submit(form, form.querySelector('[value="add_manual_grade"]')),
    true,
  );
  assert.equal(feedback.value, "Clear explanation\n\nGraded by: Ada Lovelace");
  assert.equal(inputEvents, 1);
});

test("a non-rubric manual-grading page keeps attribution as an independent feature", () => {
  const dom = boot({ grouped: false, activeRubric: false });
  const { document } = dom.window;
  const form = document.querySelector('form[name="manual-grading-form"]');
  const feedback = document.querySelector("textarea.js-submission-feedback");

  feedback.value = "No rubric feedback";
  submit(form, form.querySelector('[value="add_manual_grade"]'));
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 0);
  assert.equal(feedback.value, "No rubric feedback\n\nGraded by: Ada Lovelace");
});

test("invalid and skipped grades leave feedback untouched", () => {
  const { document } = boot().window;
  const form = document.querySelector('form[name="manual-grading-form"]');
  const feedback = document.querySelector("textarea");
  feedback.value = "Draft feedback";
  assert.equal(
    submit(form, form.querySelector('[value="add_manual_grade"]')),
    false,
  );
  assert.equal(feedback.value, "Draft feedback");
  assert.equal(
    submit(form, form.querySelector('[value="skip_manual_grade"]')),
    true,
  );
  assert.equal(feedback.value, "Draft feedback");
});

test("disabling attribution preserves feedback on valid submission", () => {
  const { document } = boot().window;
  document.querySelector('[data-setting="appendGraderName"]').click();
  document.querySelector('[value="a1"]').click();
  document.querySelector('[value="b1"]').click();
  const form = document.querySelector('form[name="manual-grading-form"]');
  const feedback = document.querySelector("textarea");
  feedback.value = "Graded by: is part of this explanation.\nKeep this text.";
  assert.equal(
    submit(form, form.querySelector('[value="add_manual_grade"]')),
    true,
  );
  assert.equal(
    feedback.value,
    "Graded by: is part of this explanation.\nKeep this text.",
  );
});
