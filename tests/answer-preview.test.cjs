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
