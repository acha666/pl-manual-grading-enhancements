const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createPage,
  loadBundle,
  fireDOMContentLoaded,
  submit,
} = require("./fixtures.cjs");

function setup({
  open = false,
  date = "2026-09-16 11:12:04 (PDT)",
  now = "2026-09-16T19:12:04Z",
  ...options
} = {}) {
  const dom = createPage(options);
  const { window } = dom;
  window.Date.now = () => Date.parse(now);
  window.document.querySelector("#submissionInfoModal-42 td").textContent =
    date;
  if (open)
    window.document
      .querySelector(".app-main-container")
      .insertAdjacentHTML(
        "afterbegin",
        '<div class="alert alert-danger" role="alert">This assessment instance is still open. Student may still be able to submit new answers.</div>',
      );
  loadBundle(window);
  fireDOMContentLoaded(window);
  return dom;
}

test("open assessment blocks all grade actions before attribution and points graders to native Next", () => {
  const { window } = setup({ open: true, includeConflictForm: true });
  const doc = window.document;
  const form = doc.querySelector('form[name="manual-grading-form"]');
  const next = form.querySelector('[value="next_instance_question"]');
  for (const button of doc.querySelectorAll('[value="add_manual_grade"]')) {
    assert.equal(button.disabled, true);
    assert.equal(submit(button.form, button), false);
  }
  assert.equal(submit(form), false);
  assert.equal(form.querySelector("textarea").value, "");
  assert.equal(submit(form, next), true);
  assert.equal(doc.activeElement, next);
  assert.match(
    doc.querySelector(".plmge-grading-availability").textContent,
    /still open.*Choose Next/,
  );
});

for (const [label, now, blocked] of [
  ["one millisecond before the hour", "2026-09-16T19:12:03.999Z", true],
  ["exactly one hour", "2026-09-16T19:12:04Z", false],
  ["older submission", "2026-09-17T00:00:00Z", false],
  ["future timestamp", "2026-09-16T18:00:00Z", true],
])
  test(label, () => {
    const { window } = setup({ now, grouped: false });
    const button = window.document.querySelector('[value="add_manual_grade"]');
    assert.equal(button.disabled, blocked);
    assert.equal(submit(button.form, button), !blocked);
  });

for (const date of ["", "unknown", "2026-09-16 11:12:04 (XYZ)"])
  test(`unverifiable date blocks saving: ${date}`, () => {
    const { window } = setup({ date });
    assert.equal(
      window.document.querySelector('[value="add_manual_grade"]').disabled,
      true,
    );
    assert.match(
      window.document.querySelector(".plmge-grading-availability").textContent,
      /could not be verified/,
    );
  });

test("time guard expires and preserves already-disabled buttons", async () => {
  const dom = createPage({ grouped: false, includeConflictForm: true });
  const { window } = dom;
  window.Date.now = () => Date.parse("2020-01-01T00:59:59.980Z");
  const conflict = window.document.querySelector(
    "#conflictGradingJobModal button",
  );
  conflict.disabled = true;
  loadBundle(window);
  fireDOMContentLoaded(window);
  assert.equal(
    window.document.querySelector('[value="add_manual_grade"]').disabled,
    true,
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(
    window.document.querySelector('[value="add_manual_grade"]').disabled,
    false,
  );
  assert.equal(conflict.disabled, true);
  assert.equal(
    window.document.querySelector(".plmge-grading-availability"),
    null,
  );
});

test("panel replacement reapplies the guard without duplicate notices", async () => {
  const { window } = setup({ open: true });
  const panel = window.document.querySelector(".js-main-grading-panel");
  panel.innerHTML = createPage().window.document.querySelector(
    ".js-main-grading-panel",
  ).innerHTML;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(
    window.document.querySelectorAll(".plmge-grading-availability").length,
    1,
  );
  assert.equal(
    panel.querySelector('[value="add_manual_grade"]').disabled,
    true,
  );
});

test("expiry does not undo a critical feature's disabled state", async () => {
  const { window } = setup({ now: "2026-09-16T19:12:03.980Z" });
  window.document
    .querySelector(".js-main-grading-panel form")
    .insertAdjacentHTML(
      "afterbegin",
      '<div class="plmge-feature-messages"><div class="alert-danger">Critical error</div></div>',
    );
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(
    window.document.querySelector('[value="add_manual_grade"]').disabled,
    true,
  );
});
