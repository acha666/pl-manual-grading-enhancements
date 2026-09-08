import { expect, test, type Locator, type Page } from "@playwright/test";
import { readSubmissionState } from "./submission-state.js";

const MARKER = "span[data-pl-manual-grading-enhancements][hidden]";
const RUBRIC_INPUT = "input.js-selectable-rubric-item";
const RUBRIC_LABEL = "label.js-selectable-rubric-item-label";
const FEEDBACK = 'textarea[name="submission_note"].js-submission-feedback';

function rubricItem(page: Page, visibleDescription: string): Locator {
  return page
    .locator(RUBRIC_LABEL)
    .filter({ hasText: visibleDescription })
    .locator(RUBRIC_INPUT);
}

test("complete manual grading workflow on the official Docker deployment", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const { courseInstanceURL, assessmentId, instanceQuestionId } =
    readSubmissionState();

  await test.step("Keep enhancements inactive in the saved student view", async () => {
    await page.goto(
      `${courseInstanceURL}/instance_question/${instanceQuestionId}`,
    );
    await expect(page.locator(MARKER)).toHaveCount(0);
    await expect(page.locator(".plmge-options-menu")).toHaveCount(0);
  });

  const manualGradingIQUrl =
    `${courseInstanceURL}/instructor/assessment/${assessmentId}` +
    `/manual_grading/instance_question/${instanceQuestionId}`;

  const criteria = page.locator(".plmge-criterion");
  await test.step("Enhance the saved rubric and reinitialize after panel replacement", async () => {
    await page.goto(manualGradingIQUrl);
    await expect(page.locator(MARKER)).toHaveCount(1);
    await expect(
      page.locator("html[data-pl-manual-grading-enhancements]"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Manual grading options" }),
    ).toBeVisible();
    await expect(page.locator(FEEDBACK)).toBeEditable();
    await expect(
      page.locator('#username-nav[data-view-type="instructor"]'),
    ).toContainText("Dev User");

    await expect(criteria).toHaveCount(2);
    await expect(page.locator(FEEDBACK)).toHaveValue("");

    // Saving an existing rubric triggers the upstream panel replacement that
    // the element must handle. Course setup and rubric creation are frozen.
    await page.locator('[aria-label="Toggle rubric settings"]').click();
    await expect(page.locator("#rubric-setting")).toBeVisible();
    await page
      .locator('#rubric-editor table[aria-label="Rubric items"]')
      .getByRole("spinbutton", { name: "Points", exact: true })
      .first()
      .fill("5");
    const previousForm = await page
      .locator('.js-main-grading-panel form[name="manual-grading-form"]')
      .elementHandle();
    await page
      .locator("#rubric-setting")
      .getByRole("button", { name: "Save" })
      .click();
    await expect(
      page.locator(".js-main-grading-panel " + RUBRIC_INPUT),
    ).toHaveCount(4, {
      timeout: 10000,
    });

    // Verify a real replacement occurred, then check reactivation without a reload.
    await expect
      .poll(() => previousForm!.evaluate((form) => form.isConnected))
      .toBe(false);
    await previousForm!.dispose();
    await expect(criteria).toHaveCount(2);
    await expect(page.locator(".plmge-feature-messages")).toHaveCount(0);
    await expect(criteria.nth(0)).toContainText("Opening");
    await expect(criteria.nth(1)).toContainText("Headers");
    await expect(criteria.nth(0).locator(RUBRIC_INPUT)).toHaveCount(2);
    await expect(rubricItem(page, "Excellent")).toHaveAttribute(
      "data-rubric-item-points",
      "5",
    );
    await expect(criteria.nth(1).locator(RUBRIC_INPUT)).toHaveCount(1);
    await expect(
      page.getByText("Ungrouped feedback", { exact: true }),
    ).toBeVisible();
  });

  await test.step("Enforce exclusivity and block incomplete grades", async () => {
    // Grouped items are mutually exclusive, and an incomplete criterion
    // blocks the actual manual-grade form submission.
    await rubricItem(page, "Excellent").check();
    await rubricItem(page, "Adequate").check();
    await expect(rubricItem(page, "Excellent")).not.toBeChecked();
    await expect(rubricItem(page, "Adequate")).toBeChecked();

    await page.locator("#grade-button").click();
    await expect(page.locator(".plmge-error")).toContainText("Headers");
    await expect(page).toHaveURL(manualGradingIQUrl);

    await rubricItem(page, "All required").check();
    await expect(page.locator(".plmge-error")).toBeHidden();
  });

  await test.step("Apply scrolling and collapse settings", async () => {
    // Exercise the real settings menu and its DOM effects.
    await page.getByRole("button", { name: "Manual grading options" }).click();
    await expect(
      page.getByText("Independent panel scrolling", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: "Independent panel scrolling" })
      .check();
    await expect(
      page.locator(".plmge-layout.plmge-split-scroll"),
    ).toBeVisible();
    await expect(page.locator(".plmge-scroll-pane").first()).toHaveCSS(
      "overflow-y",
      "auto",
    );
    await page
      .getByRole("checkbox", { name: "Collapse completed criteria" })
      .check();
    await expect(criteria.nth(0).locator(".plmge-criterion-body")).toBeHidden();
    await expect(criteria.nth(1).locator(".plmge-criterion-body")).toBeHidden();
  });

  await test.step("Save and reopen the grade to verify persisted feedback and rubric selections", async () => {
    // The attribution is added to the payload of the real grade request.
    await page.locator(FEEDBACK).fill("Correct solution.");
    const [gradeResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/manual_grading/instance_question/"),
      ),
      page.locator("#grade-button").click(),
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
    await expect(page.locator(FEEDBACK)).toHaveValue(
      "Correct solution.\n\nGraded by: Dev User",
    );
    await expect(rubricItem(page, "Adequate")).toBeChecked();
    await expect(rubricItem(page, "All required")).toBeChecked();
    await expect(rubricItem(page, "Excellent")).not.toBeChecked();
    await expect(
      page.locator(".plmge-layout.plmge-split-scroll"),
    ).toBeVisible();
  });
  expect(browserErrors).toEqual([]);
});
