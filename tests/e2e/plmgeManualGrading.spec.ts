import { expect, test } from "@playwright/test";
import { manualGradingPage } from "./manual-grading-page.js";
import { readSubmissionState } from "./submission-state.js";

test("complete manual grading workflow on the official Docker deployment", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const grading = manualGradingPage(page);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const { courseInstanceURL, assessmentId, instanceQuestionId } =
    readSubmissionState();

  await test.step("Keep enhancements inactive in the saved student view", async () => {
    await page.goto(
      `${courseInstanceURL}/instance_question/${instanceQuestionId}`,
    );
    await expect(grading.marker).toHaveCount(0);
    await expect(grading.menu).toHaveCount(0);
  });

  const manualGradingIQUrl =
    `${courseInstanceURL}/instructor/assessment/${assessmentId}` +
    `/manual_grading/instance_question/${instanceQuestionId}`;

  const { criteria } = grading;
  await test.step("Enhance the saved rubric and reinitialize after panel replacement", async () => {
    await page.goto(manualGradingIQUrl);
    await expect(grading.marker).toHaveCount(1);
    await expect(
      page.locator("html[data-pl-manual-grading-enhancements]"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Manual grading options" }),
    ).toBeVisible();
    await expect(grading.feedback).toBeEditable();
    await expect(
      page.locator('#username-nav[data-view-type="instructor"]'),
    ).toContainText("Dev User");

    await expect(criteria).toHaveCount(2);
    await expect(grading.feedback).toHaveValue("");

    await grading.setOption("Sticky grading panel", true);
    await expect(grading.gradingColumn).toHaveClass(/plmge-sticky-grading/);
    await page.getByRole("button", { name: "Manual grading options" }).click();

    // Saving an existing rubric triggers the upstream panel replacement that
    // the element must handle. Course setup and rubric creation are frozen.
    const cardMaxHeight = await grading.gradingColumn.evaluate(
      (card) => getComputedStyle(card).maxHeight,
    );
    await page.locator('[aria-label="Toggle rubric settings"]').click();
    await expect(page.locator("#rubric-setting")).toBeVisible();
    await expect(grading.gradingColumn).toHaveCSS("max-height", cardMaxHeight);
    await expect(grading.gradingColumn).toHaveCSS("position", "sticky");
    await expect(page.locator(".col-lg-8.col-12")).not.toHaveCSS(
      "overflow-y",
      "auto",
    );
    await page
      .locator('#rubric-editor table[aria-label="Rubric items"]')
      .getByRole("spinbutton", { name: "Points", exact: true })
      .first()
      .fill("5");
    const previousForm = await grading.form.elementHandle();
    await page
      .locator("#rubric-setting")
      .getByRole("button", { name: "Save" })
      .click();
    await expect(grading.items).toHaveCount(4, {
      timeout: 10000,
    });

    // Verify a real replacement occurred, then check reactivation without a reload.
    await expect
      .poll(() => previousForm!.evaluate((form) => form.isConnected))
      .toBe(false);
    await previousForm!.dispose();
    await expect(criteria).toHaveCount(2);
    await expect(grading.errors).toHaveCount(0);
    await expect(grading.menu).toHaveCount(1);
    await expect(grading.gradingColumn).toHaveClass(/plmge-sticky-grading/);
    await expect(criteria.nth(0)).toContainText("Opening");
    await expect(criteria.nth(1)).toContainText("Headers");
    await expect(
      criteria.nth(0).locator("input.js-selectable-rubric-item"),
    ).toHaveCount(2);
    await expect(grading.rubricItem("Excellent")).toHaveAttribute(
      "data-rubric-item-points",
      "5",
    );
    await expect(
      criteria.nth(1).locator("input.js-selectable-rubric-item"),
    ).toHaveCount(1);
    await expect(
      page.getByText("Ungrouped feedback", { exact: true }),
    ).toBeVisible();
  });

  await test.step("Enforce exclusivity and block incomplete grades", async () => {
    // Grouped items are mutually exclusive, and an incomplete criterion
    // blocks the actual manual-grade form submission.
    await grading.setOption("Collapse completed criteria", false);
    await page.getByRole("button", { name: "Manual grading options" }).click();
    await grading.rubricItem("Excellent").check();
    await grading.rubricItem("Adequate").check();
    await expect(grading.rubricItem("Excellent")).not.toBeChecked();
    await expect(grading.rubricItem("Adequate")).toBeChecked();

    await grading.gradeButton.click();
    await expect(page.locator(".plmge-error")).toContainText("Headers");
    await expect(page).toHaveURL(manualGradingIQUrl);

    await grading.rubricItem("All required").check();
    await expect(page.locator(".plmge-error")).toBeHidden();
  });

  await test.step("Apply scrolling and collapse settings", async () => {
    await grading.openOptions();
    await expect(
      grading.menu.getByRole("checkbox", {
        name: "Sticky grading panel",
      }),
    ).toBeChecked();
    await grading.setOption("Sticky grading panel", false);
    await expect(grading.gradingColumn).not.toHaveClass(/plmge-sticky-grading/);
    await expect(grading.gradingColumn).toHaveCSS("--plmge-card-height", "");
    await grading.setOption("Sticky grading panel", true);
    await expect(grading.gradingColumn).toHaveCSS("overflow-y", "auto");
    await test.step("Keep grading visible while reading long answers", async () => {
      const response = page.locator(".col-lg-8.col-12");
      const spacer = await response.evaluateHandle((column) => {
        const spacer = document.createElement("div");
        spacer.style.height = "2000px";
        column.append(spacer);
        return spacer;
      });
      try {
        await grading.gradingColumn.evaluate((card) => {
          const container = card.closest(".app-main-container")!;
          container.scrollTop +=
            card.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            200;
        });
        await expect
          .poll(() =>
            grading.gradingColumn.evaluate((card) => {
              const container = card.closest(".app-main-container")!;
              return Math.round(
                card.getBoundingClientRect().top -
                  container.getBoundingClientRect().top,
              );
            }),
          )
          .toBe(8);
        const outerScroll = await page
          .locator(".app-main-container")
          .evaluate((container) => container.scrollTop);
        await grading.gradingColumn.evaluate((card) => {
          card.scrollTop = card.scrollHeight;
        });
        await expect
          .poll(() =>
            page
              .locator(".app-main-container")
              .evaluate((container) => container.scrollTop),
          )
          .toBe(outerScroll);
        await expect(grading.gradeButton).toBeVisible();
        const staff = grading.gradingColumn.locator(".card").filter({
          has: page.getByRole("heading", { name: "Staff information" }),
        });
        await staff.scrollIntoViewIfNeeded();
        await expect(staff).toBeInViewport();
        expect(
          await staff.evaluate((card) => {
            const gradingCard = card.previousElementSibling!;
            return (
              gradingCard.getBoundingClientRect().bottom <=
              card.getBoundingClientRect().top
            );
          }),
        ).toBe(true);
      } finally {
        await spacer.evaluate((element) => element.remove());
        await spacer.dispose();
      }
    });
    const originalHeight = await grading.gradingColumn.evaluate((pane) =>
      parseFloat(getComputedStyle(pane).maxHeight),
    );
    await page.setViewportSize({ width: 1280, height: 1100 });
    await expect
      .poll(() =>
        grading.gradingColumn.evaluate((pane) =>
          parseFloat(getComputedStyle(pane).maxHeight),
        ),
      )
      .toBeGreaterThan(originalHeight);
    await page.setViewportSize({ width: 600, height: 900 });
    await expect(grading.gradingColumn).not.toHaveCSS("overflow-y", "auto");
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(grading.gradingColumn).toHaveCSS("overflow-y", "auto");
    await grading.setOption("Collapse completed criteria", true);
    await page.getByRole("button", { name: "Manual grading options" }).click();
    await expect(criteria.nth(0).locator(".plmge-criterion-body")).toBeHidden();
    await expect(criteria.nth(1).locator(".plmge-criterion-body")).toBeHidden();
  });

  await test.step("Save and reopen the grade to verify persisted feedback and rubric selections", async () => {
    // The attribution is added to the payload of the real grade request.
    await grading.feedback.fill("Correct solution.");
    const [gradeResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/manual_grading/instance_question/"),
      ),
      grading.gradeButton.click(),
    ]);
    expect(gradeResponse.status()).toBeLessThan(400);
    const gradePayload = new URLSearchParams(
      gradeResponse.request().postData() ?? "",
    );
    // HTML form submission normalizes textarea newlines to CRLF.
    expect(gradePayload.get("submission_note")?.replace(/\r\n/g, "\n")).toBe(
      "Correct solution.\n\nGraded by: Dev User",
    );

    await page.waitForURL((url) => url.pathname !== manualGradingIQUrl);
    await page.goto(manualGradingIQUrl);
    await expect(grading.feedback).toHaveValue(
      "Correct solution.\n\nGraded by: Dev User",
    );
    await expect(grading.rubricItem("Adequate")).toBeChecked();
    await expect(grading.rubricItem("All required")).toBeChecked();
    await expect(grading.rubricItem("Excellent")).not.toBeChecked();
    await expect(grading.gradingColumn).toBeVisible();
    await expect(grading.gradingColumn).toHaveClass(/plmge-sticky-grading/);
  });
  expect(browserErrors).toEqual([]);
});
