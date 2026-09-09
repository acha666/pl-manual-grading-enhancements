const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createPage,
  fireDOMContentLoaded,
  loadBundle,
} = require("./fixtures.cjs");

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

  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  document.querySelector('[data-setting="latestAnswerPreview"]').click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));

  assert.equal(previewClicks, 1);
  assert.equal(scrolls, 1);
  assert.equal(newest.dataset.plmgeLatestPreviewInitialized, "true");
});

test("expands the newest answer when its heading has no answer number", async () => {
  const dom = createPage();
  const { document } = dom.window;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div data-testid="submission-with-feedback">
        <div data-testid="submission-block" id="submission-old">
          <h2>Submitted answer</h2>
          <div class="js-submission-body" id="old-body">
            <div class="js-file-preview-item">
              <button type="button" data-bs-toggle="collapse" aria-expanded="false">Show preview</button>
            </div>
          </div>
        </div>
      </div>
      <div data-testid="submission-with-feedback">
        <div data-testid="submission-block" id="submission-new">
          <h2>Submitted answer</h2>
          <button type="button" data-bs-toggle="collapse" aria-controls="new-body" aria-expanded="false">Toggle answer</button>
          <div class="js-submission-body" id="new-body">
            <div class="js-file-preview-item">
              <button type="button" data-bs-toggle="collapse" aria-expanded="false">Show preview</button>
            </div>
          </div>
        </div>
      </div>
    `,
  );
  const newest = document.querySelector("#submission-new");
  const answerButton = newest.querySelector('[aria-controls="new-body"]');
  const previewButton = newest.querySelector(".js-file-preview-item button");
  let answerClicks = 0;
  let previewClicks = 0;
  answerButton.addEventListener("click", () => {
    answerClicks += 1;
  });
  previewButton.addEventListener("click", () => {
    previewClicks += 1;
  });

  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  document.querySelector('[data-setting="latestAnswerPreview"]').click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));

  assert.equal(answerClicks, 1);
  assert.equal(previewClicks, 1);
  assert.equal(newest.dataset.plmgeLatestPreviewInitialized, "true");
});

test("fully expands asynchronously loaded code once and stops watching when disabled", async () => {
  const dom = createPage();
  const { document } = dom.window;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div data-testid="submission-block">
      <h2>Submitted answer 1</h2>
      <div class="js-submission-body">
        <div class="js-file-preview-item">
          <button data-bs-toggle="collapse" aria-expanded="false">Show preview</button>
          <div class="file-preview-container"></div>
          <button class="file-preview-expand d-none">Expand</button>
        </div>
      </div>
    </div>`,
  );
  const expand = document.querySelector(".file-preview-expand");
  const container = document.querySelector(".file-preview-container");
  let clicks = 0;
  expand.addEventListener("click", () => {
    clicks++;
    container.style.maxHeight = "none";
  });
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  const option = document.querySelector('[data-setting="latestAnswerPreview"]');
  option.click();
  assert.equal(clicks, 0);
  expand.classList.remove("d-none");
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  assert.equal(clicks, 1);
  assert.equal(container.style.maxHeight, "none");
  option.click();
  option.click();
  assert.equal(clicks, 1, "does not collapse an already expanded preview");
  option.click();
  container.style.removeProperty("max-height");
  expand.classList.add("d-none");
  option.click();
  option.click();
  expand.classList.remove("d-none");
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));
  assert.equal(clicks, 1, "pending expansion is cancelled on disable");
});
