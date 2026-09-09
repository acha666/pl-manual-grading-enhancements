const assert = require("node:assert/strict");
const { test } = require("node:test");
const { boot } = require("./fixtures.cjs");

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

test("collapse mode does not re-collapse a criterion after it is manually expanded", () => {
  const dom = boot();
  const { document } = dom.window;
  document.querySelector('[data-setting="collapseCompleted"]').click();

  const first = document.querySelector('[value="a1"]');
  first.click();
  const criterion = first.closest(".plmge-criterion");
  assert.equal(criterion.querySelector(".plmge-criterion-body").hidden, true);

  criterion.querySelector(".plmge-criterion-heading").click();
  assert.equal(criterion.querySelector(".plmge-criterion-body").hidden, false);
  const collapse = document.querySelector('[data-setting="collapseCompleted"]');
  collapse.click();
  collapse.click();
  assert.equal(criterion.querySelector(".plmge-criterion-body").hidden, false);
  document.querySelector('[value="a2"]').click();
  assert.equal(criterion.querySelector(".plmge-criterion-body").hidden, false);
  document.querySelector('[value="a1"]').click();
  assert.equal(criterion.querySelector(".plmge-criterion-body").hidden, false);
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

test("generated badges are restored through option changes and panel refreshes", async () => {
  const { window } = boot();
  const { document } = window;
  const input = document.querySelector('[value="a2"]');
  const label = input.closest("label");
  const originalBadge = document
    .querySelector('[value="a1"]')
    .closest("label")
    .querySelector("kbd");

  for (let refresh = 0; refresh < 3; refresh++) {
    const collapse = document.querySelector(
      '[data-setting="collapseCompleted"]',
    );
    collapse.click();
    assert.equal(label.querySelectorAll("kbd").length, 1);
    assert.equal(
      label.querySelector("kbd").textContent,
      input.dataset.keyBinding,
    );

    collapse.click();
    assert.equal(label.querySelector("kbd"), null);
    assert.equal(input.hasAttribute("data-key-binding"), false);
    assert.equal(originalBadge.textContent, "1");
    assert.equal(originalBadge.hidden, false);

    collapse.click();
    document
      .querySelector(".js-main-grading-panel")
      .append(document.createElement("div"));
    await new Promise((resolve) => window.queueMicrotask(resolve));
    assert.equal(label.querySelectorAll("kbd").length, 1);
    document.querySelector('[data-setting="collapseCompleted"]').click();
    assert.equal(label.querySelector("kbd"), null);
    assert.equal(
      document
        .querySelector('[value="a1"]')
        .closest("label")
        .querySelector("kbd"),
      originalBadge,
    );
  }
});
