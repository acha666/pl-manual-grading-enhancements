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
  await new Promise((resolve) => dom.window.setTimeout(resolve, 50));

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

for (const outcome of ["short code", "long code", "error", "unsupported"]) {
  test(`waits for asynchronous ${outcome} and collapse completion before scrolling`, async () => {
    const dom = createPage();
    const { document } = dom.window;
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="question-upload"><div class="file-preview show"><pre>Question upload</pre></div></div>
      <div data-testid="submission-block">
        <h2>Submitted answer</h2>
        <div class="js-submission-body show collapse" data-submission-id="20">
          <div class="js-file-preview-item">
            <button data-bs-toggle="collapse" aria-expanded="false">Show preview</button>
            <div class="js-error-alert d-none"></div><div class="js-info-alert d-none"></div>
            <div class="file-preview collapse">
              <div class="file-preview-container"><pre class="d-none"><code></code></pre></div>
              <button class="file-preview-expand d-none">Expand</button>
            </div>
          </div>
        </div>
      </div>`,
    );
    const item = document.querySelector(".js-file-preview-item");
    const preview = item.querySelector(".file-preview");
    const toggle = item.querySelector("button");
    const container = item.querySelector(".file-preview-container");
    const expand = item.querySelector(".file-preview-expand");
    const scrolls = [];
    dom.window.HTMLElement.prototype.scrollIntoView = function () {
      scrolls.push(this);
    };
    toggle.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "true");
      preview.className = "file-preview collapsing";
    });
    expand.addEventListener("click", () => {
      container.style.maxHeight = "none";
    });
    dom.window.localStorage.setItem(
      "pl.manualGradingEnhancements.settings.v1",
      JSON.stringify({ latestAnswerPreview: true }),
    );
    loadBundle(dom.window);
    fireDOMContentLoaded(dom.window);
    const tick = () =>
      new Promise((resolve) => dom.window.setTimeout(resolve, 25));
    await tick();
    assert.equal(
      scrolls.length,
      0,
      "does not scroll into an empty, animating preview on initial load",
    );
    if (outcome.includes("code")) {
      item.querySelector("pre").classList.remove("d-none");
      if (outcome === "long code") expand.classList.remove("d-none");
    } else {
      item
        .querySelector(
          outcome === "error" ? ".js-error-alert" : ".js-info-alert",
        )
        .classList.remove("d-none");
    }
    await tick();
    assert.equal(
      scrolls.length,
      0,
      "content readiness does not bypass the collapse animation",
    );
    preview.className = "file-preview collapse show";
    preview.dispatchEvent(
      new dom.window.Event("shown.bs.collapse", { bubbles: true }),
    );
    await tick();
    assert.deepEqual(
      scrolls,
      [item],
      "scrolls only to the submitted answer, once ready",
    );
    if (outcome === "long code")
      assert.equal(container.style.maxHeight, "none");
    item.querySelector("code").textContent = "later update";
    await tick();
    assert.equal(
      scrolls.length,
      1,
      "does not pull the reader back after initialization",
    );
  });
}

test("cancels pending scrolling when disabled", async () => {
  const dom = createPage();
  const { document } = dom.window;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div data-testid="submission-block"><h2>Submitted answer 1</h2><div class="js-submission-body"><div class="js-file-preview-item"><button data-bs-toggle="collapse" aria-expanded="true"></button><div class="file-preview show"><pre class="d-none"></pre></div></div></div></div>`,
  );
  let scrolls = 0;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {
    scrolls++;
  };
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  const setting = document.querySelector(
    '[data-setting="latestAnswerPreview"]',
  );
  setting.click();
  setting.click();
  document.querySelector("pre").classList.remove("d-none");
  await new Promise((resolve) => dom.window.setTimeout(resolve, 25));
  assert.equal(scrolls, 0);
});

test("waits for a lazily rendered latest submission instead of opening an older preview", async () => {
  const dom = createPage();
  const { document } = dom.window;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div data-testid="submission-block" id="latest">
      <h2>Submitted answer</h2>
      <button data-bs-toggle="collapse" aria-controls="latest-body" aria-expanded="false"></button>
      <div class="js-submission-body" data-submission-id="200" id="latest-body"></div>
    </div>
    <div data-testid="submission-block" id="older">
      <h2>Submitted answer</h2>
      <div class="js-submission-body" data-submission-id="100">
        <div class="js-file-preview-item"><button data-bs-toggle="collapse"></button></div>
      </div>
    </div>`,
  );
  const scrolls = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function () {
    scrolls.push(this);
  };
  let olderClicks = 0;
  document.querySelector("#older button").addEventListener("click", () => {
    olderClicks++;
  });
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  document.querySelector('[data-setting="latestAnswerPreview"]').click();
  await new Promise((resolve) => dom.window.setTimeout(resolve, 15));
  assert.equal(scrolls.length, 0);
  document.querySelector("#latest-body").innerHTML =
    `<div class="js-file-preview-item"><button data-bs-toggle="collapse" aria-expanded="true"></button><div class="file-preview show"><pre>loaded answer</pre></div></div>`;
  await new Promise((resolve) => dom.window.setTimeout(resolve, 25));
  assert.deepEqual(scrolls, [
    document.querySelector("#latest .js-file-preview-item"),
  ]);
  assert.equal(olderClicks, 0);
});
