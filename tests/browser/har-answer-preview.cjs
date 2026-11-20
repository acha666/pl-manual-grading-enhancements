// Offline regression replay: node tests/browser/har-answer-preview.cjs capture.har [...]
// Set PLMGE_HAR_ORIGINAL=1 to reproduce the captured implementation failure.
// Production file bodies are absent in the captures; substitute synthetic text.
// With several files the first is too long to expand, so the next one is
// expected. Answers without files expect the submission card. Captures of
// questions without the element get its marker and local assets injected.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const browsers = require("@playwright/test");
const browserName = process.env.PLMGE_BROWSER || "chromium";
assert.ok(["chromium", "firefox", "webkit"].includes(browserName));

const dist = path.join(
  __dirname,
  "../../elements/pl-manual-grading-enhancements/dist",
);
const shortFile =
  "int main(void) {\n" + "  // delayed preview content\n".repeat(100) + "}\n";
const longFile = "{\n" + '  "generated": 0,\n'.repeat(800) + "}\n";

function decode(content) {
  return Buffer.from(
    content.text || "",
    content.encoding === "base64" ? "base64" : "utf8",
  );
}

(async () => {
  assert.ok(process.argv.length > 2, "Provide a HAR capture to replay");
  const browser = await browsers[browserName].launch({ headless: true });
  try {
    for (const capture of process.argv.slice(2)) {
      const entries = JSON.parse(fs.readFileSync(capture, "utf8")).log.entries;
      const responses = new Map(
        entries.map((entry) => [entry.request.url, entry.response]),
      );
      const html = decode(entries[0].response.content).toString("utf8");
      const files = [
        ...html.matchAll(/js-file-preview-item" data-file="([^"]+)"/g),
      ].map((match) => match[1]);
      const longName = files.length > 1 ? files[0] : null;
      const expectedFile = files.length > 1 ? files[1] : (files[0] ?? null);
      const inject = !html.includes("data-pl-manual-grading-enhancements");
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
            file: this.dataset.file ?? null,
            loaded: !!this.querySelector(".file-preview pre:not(.d-none)"),
            expanded:
              this.querySelector(".file-preview-container")?.style.maxHeight ===
              "none",
          });
          return scroll.call(this, options);
        };
      });
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        const file = url.match(/\/submission\/\d+\/file\/([^?]+)/)?.[1];
        if (file) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          return route.fulfill({
            contentType: "text/plain",
            body: decodeURIComponent(file) === longName ? longFile : shortFile,
          });
        }
        const asset = url.match(
          /(?:pl-manual-grading-enhancements\/dist|\/plmge)\/(main\.js|styles\.css)$/,
        )?.[1];
        if (asset && (inject || !process.env.PLMGE_HAR_ORIGINAL)) {
          return route.fulfill({
            contentType: asset.endsWith(".js")
              ? "application/javascript"
              : "text/css",
            body: fs.readFileSync(path.join(dist, asset)),
          });
        }
        const response = responses.get(url);
        if (!response) return route.abort();
        let body = decode(response.content);
        if (inject && url === entries[0].request.url) {
          body = Buffer.from(
            html
              .replace(
                "</head>",
                '<link href="/plmge/styles.css" rel="stylesheet" />' +
                  '<script src="/plmge/main.js"></script></head>',
              )
              .replace(
                /<div class="card-body[^"]*question-body">/,
                "$&<span data-pl-manual-grading-enhancements hidden></span>",
              ),
          );
        }
        return route.fulfill({
          status: response.status,
          contentType: response.content.mimeType,
          body,
        });
      });
      await page.goto(entries[0].request.url);
      await page.waitForFunction(() => window.previewScrolls.length > 0);
      if (!process.env.PLMGE_HAR_ORIGINAL) {
        const open = await page
          .locator('#content .alert[role="alert"]')
          .filter({ hasText: "This assessment instance is still open." })
          .count();
        if (open) {
          assert.ok(
            await page.locator(".plmge-grading-availability").isVisible(),
          );
          for (const button of await page
            .locator('button[name="__action"][value^="add_manual_grade"]')
            .all()) {
            assert.ok(await button.isDisabled());
          }
          assert.ok(
            await page
              .locator('button[value="next_instance_question"]')
              .isEnabled(),
          );
        }
      }
      const result = await page.evaluate((longName) => {
        const block = document.querySelector(
          "[data-plmge-latest-preview-initialized]",
        );
        const target =
          [...block.querySelectorAll(".js-file-preview-item")].find(
            (item) =>
              item.querySelector(".file-preview")?.classList.contains("show") &&
              item.dataset.file !== longName,
          ) ?? block;
        let scroller = target.parentElement;
        while (
          scroller &&
          !(
            /auto|scroll/.test(getComputedStyle(scroller).overflowY) &&
            scroller.scrollHeight > scroller.clientHeight
          )
        )
          scroller = scroller.parentElement;
        scroller ??= document.scrollingElement;
        const long = longName
          ? block.querySelector(
              `.js-file-preview-item[data-file="${CSS.escape(longName)}"]`,
            )
          : null;
        return {
          scrolls: window.previewScrolls,
          top: target.getBoundingClientRect().top,
          scrollerTop: scroller.getBoundingClientRect().top,
          atEnd:
            scroller.scrollTop >=
            scroller.scrollHeight - scroller.clientHeight - 1,
          long: long && {
            open: long
              .querySelector(".file-preview")
              .classList.contains("show"),
            expanded:
              long.querySelector(".file-preview-container").style.maxHeight ===
              "none",
          },
        };
      }, longName);
      assert.deepEqual(
        result.scrolls,
        expectedFile
          ? [
              {
                isAnswer: true,
                file: expectedFile,
                loaded: true,
                expanded: true,
              },
            ]
          : [
              {
                isAnswer: true,
                file: null,
                loaded: false,
                expanded: false,
              },
            ],
      );
      if (longName)
        assert.deepEqual(result.long, { open: false, expanded: false });
      // A short pane cannot scroll the final card all the way to its top.
      assert.ok(
        Math.abs(result.top - result.scrollerTop) < 3 || result.atEnd,
        JSON.stringify(result),
      );
      console.log(
        `${path.basename(capture)}: passed; ` +
          `${expectedFile ?? "submission"} at ${Math.round(result.top)}px`,
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
