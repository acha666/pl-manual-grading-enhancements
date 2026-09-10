// Offline regression replay: node tests/browser/har-answer-preview.cjs capture.har [...]
// Set PLMGE_HAR_ORIGINAL=1 to reproduce the captured implementation failure.
// Production file bodies are absent in the captures; substitute synthetic C code.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");

(async () => {
  assert.ok(process.argv.length > 2, "Provide a HAR capture to replay");
  const browser = await chromium.launch({ headless: true });
  try {
    for (const capture of process.argv.slice(2)) {
      const entries = JSON.parse(fs.readFileSync(capture, "utf8")).log.entries;
      const responses = new Map(
        entries.map((entry) => [entry.request.url, entry.response]),
      );
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "pl.manualGradingEnhancements.settings.v1",
          JSON.stringify({ latestAnswerPreview: true, codePreview: true }),
        );
        window.previewScrolls = [];
        const scroll = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function (options) {
          window.previewScrolls.push({
            isAnswer: !!this.closest('[data-testid="submission-block"]'),
            loaded: !!this.querySelector("pre:not(.d-none)"),
            expanded:
              this.querySelector(".file-preview-container")?.style.maxHeight ===
              "none",
          });
          return scroll.call(this, options);
        };
      });
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (/\/submission\/\d+\/file\//.test(url)) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          return route.fulfill({
            contentType: "text/plain",
            body:
              "int main(void) {\n" +
              "  // delayed preview content\n".repeat(100) +
              "}\n",
          });
        }
        if (
          !process.env.PLMGE_HAR_ORIGINAL &&
          url.includes("pl-manual-grading-enhancements/dist/main.js")
        ) {
          return route.fulfill({
            contentType: "application/javascript",
            body: fs.readFileSync(
              path.join(
                __dirname,
                "../../elements/pl-manual-grading-enhancements/dist/main.js",
              ),
            ),
          });
        }
        const response = responses.get(url);
        if (!response) return route.abort();
        const content = response.content;
        return route.fulfill({
          status: response.status,
          contentType: content.mimeType,
          body: Buffer.from(
            content.text || "",
            content.encoding === "base64" ? "base64" : "utf8",
          ),
        });
      });
      await page.goto(entries[0].request.url);
      await page.waitForFunction(() => window.previewScrolls.length > 0);
      const result = await page.evaluate(() => {
        const item = document.querySelector(
          "[data-plmge-latest-preview-initialized] .js-file-preview-item",
        );
        const scroller = document.querySelector(".app-main-container");
        return {
          scrolls: window.previewScrolls,
          top: item.getBoundingClientRect().top,
          scrollTop: scroller.scrollTop,
          scrollerTop: scroller.getBoundingClientRect().top,
        };
      });
      assert.deepEqual(result.scrolls, [
        { isAnswer: true, loaded: true, expanded: true },
      ]);
      assert.ok(
        Math.abs(result.top - result.scrollerTop) < 3,
        JSON.stringify(result),
      );
      console.log(
        `${path.basename(capture)}: passed; preview aligned at ${result.top}px`,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
