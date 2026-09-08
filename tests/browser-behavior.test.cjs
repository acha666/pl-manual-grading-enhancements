const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  boot,
  createPage,
  fireDOMContentLoaded,
  loadScripts,
} = require("./fixtures.cjs");

function submit(form, button) {
  return form.dispatchEvent(
    new form.ownerDocument.defaultView.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter: button,
    }),
  );
}

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

test("opens and scrolls to the newest submitted answer preview", async () => {
  const dom = createPage();
  const { document } = dom.window;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div data-testid="submission-with-feedback">
        <div data-testid="submission-block">
          <h2>Submitted answer 1</h2>
          <div class="js-submission-body" id="submission-1-body">
            <div class="js-file-preview-item">
              <button type="button" data-bs-toggle="collapse" aria-expanded="false">Show preview</button>
            </div>
          </div>
        </div>
      </div>
      <div data-testid="submission-with-feedback">
        <div data-testid="submission-block">
          <h2>Submitted answer 2</h2>
          <div class="js-submission-body" id="submission-2-body">
            <div class="js-file-preview-item">
              <button type="button" data-bs-toggle="collapse" aria-expanded="false">Show preview</button>
            </div>
          </div>
        </div>
      </div>
    `,
  );
  const newest = document.querySelectorAll(
    '[data-testid="submission-block"]',
  )[1];
  const newestPreview = newest.querySelector(".js-file-preview-item");
  const previewButton = newestPreview.querySelector("button");
  let previewClicks = 0;
  let scrolls = 0;
  previewButton.addEventListener("click", () => {
    previewClicks += 1;
  });
  newestPreview.scrollIntoView = () => {
    scrolls += 1;
  };

  loadScripts(dom.window);
  fireDOMContentLoaded(dom.window);
  document.querySelector('[data-setting="latestAnswerPreview"]').click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));

  assert.equal(previewClicks, 1);
  assert.equal(scrolls, 1);
  assert.equal(newest.dataset.plmgeLatestPreviewInitialized, "true");
});

test("colors rubric score fractions by the amount of credit", () => {
  const dom = createPage();
  const { document } = dom.window;
  document.querySelector(
    '[data-testid="rubric-item-description"]',
  ).textContent = "Full (6/6), partial (3/6), and no credit (0/6)";

  loadScripts(dom.window);
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
  loadScripts(dom.window);
  fireDOMContentLoaded(dom.window);

  assert.ok(document.documentElement.dataset.plManualGradingEnhancements);
  assert.equal(document.querySelector(".plmge-feature-messages"), null);
  assert.equal(document.querySelectorAll(".plmge-criterion").length, 2);
});

test("the view options menu is created from the Grading header contract", () => {
  const dom = boot();
  const { document } = dom.window;
  const menu = document.querySelector(".plmge-options-menu");

  assert.ok(menu);
  assert.equal(menu.querySelectorAll("input[data-setting]").length, 5);
  assert.equal(
    menu.querySelector('[data-setting="appendGraderName"]').checked,
    true,
  );
  assert.equal(
    document.querySelector(".card-header").textContent.includes("Grading"),
    true,
  );
  assert.equal(
    document
      .querySelector(".js-main-grading-panel")
      .closest(".card")
      .classList.contains("card"),
    true,
  );
});

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

test("collapse mode hides completed criteria and remaps only grouped shortcuts", () => {
  const dom = boot();
  const { document } = dom.window;
  const collapse = document.querySelector('[data-setting="collapseCompleted"]');
  collapse.click();

  const first = document.querySelector('[value="a1"]');
  first.click();
  const criterion = first.closest(".plmge-criterion");
  assert.equal(criterion.querySelector(".plmge-criterion-body").hidden, true);
  assert.equal(document.querySelector('[value="u1"]').dataset.keyBinding, "3");
  assert.equal(document.querySelector('[value="b1"]').dataset.keyBinding, "1");
  assert.equal(document.querySelector('[value="b2"]').dataset.keyBinding, "2");

  const keyEvent = new dom.window.KeyboardEvent("keypress", {
    key: "1",
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(keyEvent);
  assert.equal(document.querySelector('[value="b1"]').checked, true);
});

test("settings are persisted and malformed stored values fall back to safe defaults", () => {
  const key = "pl.manualGradingEnhancements.settings.v1";
  for (const stored of [
    JSON.stringify({ splitScrolling: true, appendGraderName: "yes" }),
    "not-json",
  ]) {
    const dom = createPage();
    const { window } = dom;
    window.localStorage.setItem(key, stored);
    loadScripts(window);
    fireDOMContentLoaded(window);
    const menu = window.document.querySelector(".plmge-options-menu");
    assert.equal(
      menu.querySelector('[data-setting="splitScrolling"]').checked,
      stored !== "not-json",
    );
    assert.equal(
      menu.querySelector('[data-setting="collapseCompleted"]').checked,
      false,
    );
    assert.equal(
      menu.querySelector('[data-setting="appendGraderName"]').checked,
      true,
    );
    assert.equal(
      menu.querySelector('[data-setting="latestAnswerPreview"]').checked,
      false,
    );
    assert.equal(
      menu.querySelector('[data-setting="scoreColors"]').checked,
      false,
    );
    menu.querySelector('[data-setting="collapseCompleted"]').click();
    assert.equal(
      JSON.parse(window.localStorage.getItem(key)).collapseCompleted,
      true,
    );
  }
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
  loadScripts(dom.window);
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
  document.querySelector('[data-setting="collapseCompleted"]').click();
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

test("typing, modifiers, repeats, and open modals do not trigger rubric shortcuts", () => {
  const { window } = boot();
  const { document } = window;
  document.querySelector('[data-setting="collapseCompleted"]').click();
  for (const [target, options] of [
    [document.querySelector("textarea"), {}],
    [document.body, { ctrlKey: true }],
    [document.body, { altKey: true }],
    [document.body, { metaKey: true }],
    [document.body, { repeat: true }],
  ]) {
    target.dispatchEvent(
      new window.KeyboardEvent("keypress", {
        key: "1",
        bubbles: true,
        cancelable: true,
        ...options,
      }),
    );
    assert.equal(document.querySelector('[value="a1"]').checked, false);
  }
  const modal = document.createElement("div");
  modal.className = "modal show";
  document.body.append(modal);
  document.body.dispatchEvent(
    new window.KeyboardEvent("keypress", { key: "1", bubbles: true }),
  );
  assert.equal(document.querySelector('[value="a1"]').checked, false);
});

test("storage failures retain usable options and required validation", () => {
  const { window } = createPage();
  Object.defineProperty(window, "localStorage", {
    get() {
      throw new Error("Storage denied");
    },
  });
  loadScripts(window);
  fireDOMContentLoaded(window);
  const { document } = window;
  document.querySelector('[data-setting="collapseCompleted"]').click();
  document.querySelector('[value="a1"]').click();
  assert.equal(document.querySelector(".plmge-criterion-body").hidden, true);
  const form = document.querySelector('form[name="manual-grading-form"]');
  assert.equal(
    submit(form, form.querySelector('[value="add_manual_grade"]')),
    false,
  );
  assert.match(document.querySelector(".plmge-error").textContent, /Headers/);
});
