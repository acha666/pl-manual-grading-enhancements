const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  boot,
  createPage,
  fireDOMContentLoaded,
  loadBundle,
  submit,
} = require("./fixtures.cjs");

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

test("settings are persisted and malformed stored values fall back to safe defaults", () => {
  const key = "pl.manualGradingEnhancements.settings.v1";
  for (const stored of [
    JSON.stringify({ splitScrolling: true, appendGraderName: "yes" }),
    "not-json",
  ]) {
    const dom = createPage();
    const { window } = dom;
    window.localStorage.setItem(key, stored);
    loadBundle(window);
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

test("storage failures retain usable options and required validation", () => {
  const { window } = createPage();
  Object.defineProperty(window, "localStorage", {
    get() {
      throw new Error("Storage denied");
    },
  });
  loadBundle(window);
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

test("all options persist independently across page loads and unknown keys are ignored", () => {
  const stored = {
    splitScrolling: true,
    collapseCompleted: true,
    appendGraderName: false,
    latestAnswerPreview: true,
    scoreColors: true,
    unknownOption: true,
  };
  const key = "pl.manualGradingEnhancements.settings.v1";
  const dom = createPage();
  dom.window.localStorage.setItem(key, JSON.stringify(stored));
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  const menu = dom.window.document.querySelector(".plmge-options-menu");
  const inputs = [...menu.querySelectorAll("input[data-setting]")];
  assert.equal(inputs.length, 5);
  for (const input of inputs) {
    assert.equal(input.checked, stored[input.dataset.setting]);
    input.click();
  }
  const saved = dom.window.localStorage.getItem(key);
  assert.equal(Object.hasOwn(JSON.parse(saved), "unknownOption"), false);

  const reloaded = createPage();
  reloaded.window.localStorage.setItem(key, saved);
  loadBundle(reloaded.window);
  fireDOMContentLoaded(reloaded.window);
  for (const input of reloaded.window.document.querySelectorAll(
    "input[data-setting]",
  )) {
    assert.equal(input.checked, !stored[input.dataset.setting]);
  }
});

test("option events reject unknown and inherited property names", () => {
  const { window } = boot();
  const key = "pl.manualGradingEnhancements.settings.v1";
  const menu = window.document.querySelector(".plmge-options-menu");
  for (const name of [
    "unknownOption",
    "constructor",
    "__proto__",
    "toString",
  ]) {
    const input = window.document.createElement("input");
    input.type = "checkbox";
    input.dataset.setting = name;
    menu.append(input);
    input.click();
    input.remove();
    assert.equal(window.localStorage.getItem(key), null);
  }
});
