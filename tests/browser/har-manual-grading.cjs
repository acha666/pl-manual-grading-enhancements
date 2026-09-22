// Offline React integration replay using captured upstream scripts and local assets.
// No requests leave the browser; missing resources and all writes are blocked.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");

(async () => {
  assert.ok(process.argv[2], "Provide a manual-grading HAR capture");
  const entries = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).log
    .entries;
  const html = entries[0].response.content.text;
  const props = html.match(
    /<script[^>]*data-component-props[^>]*>([^<]*)<\/script><div data-component="InstanceQuestionGradingPanel"/,
  );
  assert.ok(props, "Capture must include the React grading panel props");
  const gradingPanelProps = JSON.parse(props[1]).json.data;
  const responses = new Map(
    entries.map((entry) => [entry.request.url, entry.response]),
  );
  const browser = await chromium.launch({ headless: true });
  try {
    for (const delay of [0, 500]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "pl.manualGradingEnhancements.settings.v1",
          JSON.stringify({ collapseCompleted: false }),
        );
        document.addEventListener("DOMContentLoaded", () => {
          window.originalRubricParents = new Map(
            [
              ...document.querySelectorAll("input.js-selectable-rubric-item"),
            ].map((input) => {
              const row = input.closest("label").parentElement;
              return [row, row.parentElement];
            }),
          );
        });
      });
      await page.route("**/*", async (route) => {
        const request = route.request();
        if (request.method() !== "GET") return route.abort();
        const url = request.url();
        if (url.includes("/hydrated-components/InstanceQuestionGradingPanel-"))
          await new Promise((resolve) => setTimeout(resolve, delay));
        const asset = url.match(
          /pl-manual-grading-enhancements\/dist\/(main\.js|styles\.css)$/,
        )?.[1];
        if (asset)
          return route.fulfill({
            contentType: asset.endsWith(".js")
              ? "application/javascript"
              : "text/css",
            body: fs.readFileSync(
              path.join(
                __dirname,
                "../../elements/pl-manual-grading-enhancements/dist",
                asset,
              ),
            ),
          });
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
      await page.locator(".plmge-criterion").first().waitFor();
      assert.equal(await page.locator(".plmge-feature-messages").count(), 0);
      assert.equal(
        await page.evaluate(() =>
          [...window.originalRubricParents].every(
            ([row, parent]) => row.parentElement === parent,
          ),
        ),
        true,
      );

      const form = page.locator(
        '.js-main-grading-panel form[name="manual-grading-form"]',
      );
      const firstGroup = form.locator(
        '[data-plmge-criterion="plmge-criterion-heading-1"] input.js-selectable-rubric-item',
      );
      assert.ok((await firstGroup.count()) >= 2);
      await firstGroup.nth(0).check();
      await firstGroup.nth(1).check();
      assert.equal(await firstGroup.nth(0).isChecked(), false);
      assert.equal(await firstGroup.nth(1).isChecked(), true);
      const feedback = form.locator('textarea[name="submission_note"]');
      await feedback.fill("Synthetic regression feedback");
      const percentage = form.locator('input[name="use_score_perc"]');
      await percentage.check();
      await page.waitForFunction(() =>
        document
          .querySelector(".plmge-criterion-summary")
          .textContent.includes("%"),
      );
      assert.equal(await firstGroup.nth(1).isChecked(), true);
      await percentage.uncheck();

      // The public upstream update event replaces data, not the form element.
      // Remove a keyed row and change a score to exercise React reconciliation.
      const groupCount = await page.locator(".plmge-criterion").count();
      const removedId = await firstGroup.nth(0).inputValue();
      const retainedId = await firstGroup.nth(1).inputValue();
      await page.evaluate(
        ({ removedId, retainedId, data }) => {
          data.rubricData.items = data.rubricData.items.filter(
            (item) => item.id !== removedId,
          );
          data.rubricData.items.find((item) => item.id === retainedId).points =
            7;
          document.dispatchEvent(
            new CustomEvent("instance-question-grading-panel-update", {
              detail: { gradingPanelProps: data, preserveValues: true },
            }),
          );
        },
        { removedId, retainedId, data: gradingPanelProps },
      );
      await page.waitForFunction(
        (id) =>
          !document.querySelector(
            `.js-main-grading-panel input[value="${id}"]`,
          ),
        removedId,
      );
      await page.waitForFunction(() =>
        document
          .querySelector(".plmge-criterion-summary")
          .textContent.endsWith("[+7]"),
      );
      assert.equal(
        await feedback.inputValue(),
        "Synthetic regression feedback",
      );
      assert.equal(await page.locator(".plmge-criterion").count(), groupCount);

      // Native digit shortcuts must also enforce exclusivity with collapse off.
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await firstGroup.nth(0).uncheck();
      const keys = await firstGroup.evaluateAll((inputs) =>
        inputs.slice(0, 2).map((input) => input.dataset.keyBinding),
      );
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      await page.keyboard.press(keys[0]);
      await page.keyboard.press(keys[1]);
      assert.equal(
        await firstGroup.evaluateAll(
          (inputs) => inputs.filter((input) => input.checked).length,
        ),
        1,
      );

      const savedFeedback = await form.evaluate((element) => {
        for (const heading of element.querySelectorAll(
          ".plmge-criterion-heading",
        )) {
          const rows = [
            ...element.querySelectorAll(
              `[data-plmge-criterion="${heading.id}"]`,
            ),
          ];
          if (
            !rows.some(
              (row) =>
                row.querySelector("input.js-selectable-rubric-item").checked,
            )
          )
            rows[0].querySelector("input.js-selectable-rubric-item").click();
        }
        let feedback;
        element.addEventListener(
          "submit",
          (event) => {
            event.preventDefault();
            feedback = new FormData(element).get("submission_note");
          },
          { once: true },
        );
        element.dispatchEvent(
          new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter: element.querySelector(
              'button[value="add_manual_grade"]',
            ),
          }),
        );
        return feedback;
      });
      assert.match(
        savedFeedback,
        /^Synthetic regression feedback\n\nGraded by: .+/,
      );
      // A later React render must not restore the pre-attribution value.
      await percentage.check();
      assert.equal(await feedback.inputValue(), savedFeedback);
      assert.equal(await page.locator(".plmge-feature-messages").count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`React HAR replay passed (component delay ${delay} ms)`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
