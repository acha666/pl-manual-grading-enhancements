// Maintenance only: this file is never discovered by the E2E suite.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function addRubricItem(
  page: Page,
  rubricTable: Locator,
): Promise<Locator> {
  const rubricRows = rubricTable
    .locator("tr")
    .filter({ has: page.getByRole("spinbutton", { name: "Points" }) });
  const previousRowCount = await rubricRows.count();

  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(rubricRows).toHaveCount(previousRowCount + 1);

  return rubricRows.nth(previousRowCount);
}

test("Update the saved PrairieLearn state", async ({ page }) => {
  test.setTimeout(120_000);
  const { courseInstanceURL, assessmentId } =
    await test.step("Load the course through the real sync UI", async () => {
      await page.goto("/pl");
      await page
        .getByRole("link", { name: "Load from disk", exact: true })
        .click();
      await expect(
        page.getByText("Success", { exact: true }).first(),
      ).toBeVisible({
        timeout: 60_000,
      });
      await page.goto("/pl");
      const instance = page.getByRole("link", {
        name: "PLMGE E2E",
        exact: true,
      });
      await expect(instance).toBeVisible({ timeout: 60_000 });
      const instructorURL = await instance.getAttribute("href");
      const courseInstanceURL = instructorURL!.replace(/\/instructor$/, "");
      await page.goto(instructorURL!);
      await page
        .getByRole("link", { name: "Assessments", exact: true })
        .click();
      const assessmentLink = page.getByRole("link", {
        name: "Manual grading workflow",
        exact: true,
      });
      const assessmentURL = await assessmentLink.getAttribute("href");
      const assessmentId = assessmentURL!.match(/assessment\/(\d+)/)![1];

      return { courseInstanceURL, assessmentId };
    });

  const instanceQuestionId =
    await test.step("Prepare the saved submission", async () => {
      await page.goto(`${courseInstanceURL}/assessments`);
      await page
        .getByRole("link", { name: "Manual grading workflow", exact: true })
        .click();
      await page.getByRole("link", { name: /Fibonacci upload$/ }).click();
      await expect(
        page.locator('#username-nav[data-view-type="student"]'),
      ).toBeVisible();

      const instanceQuestionId = page
        .url()
        .match(/instance_question\/(\d+)/)![1];
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.locator(".upload-dropzone").click(),
      ]);
      await chooser.setFiles({
        name: "fib.py",
        mimeType: "text/x-python",
        buffer: Buffer.from("def fib(n): return n\n"),
      });
      await expect(page.locator('input[name^="_file_upload"]')).toHaveValue(
        /fib\.py/,
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();

      await expect(
        page.locator('[data-testid="submission-status"] .badge').first(),
      ).toContainText("waiting for grading");

      return instanceQuestionId;
    });

  await test.step("Prepare the saved rubric", async () => {
    await page.goto(
      `${courseInstanceURL}/instructor/assessment/${assessmentId}/manual_grading/instance_question/${instanceQuestionId}`,
    );
    // Create a real rubric through the upstream rubric editor. The element is
    // then tested against the HTML returned by the upstream render endpoint.
    await page.locator('[aria-label="Toggle rubric settings"]').click();
    await expect(page.locator("#rubric-setting")).toBeVisible();
    const rubricTable = page.locator(
      '#rubric-editor table[aria-label="Rubric items"] tbody',
    );

    for (const [points, description] of [
      ["4", "[Opening] Excellent"],
      ["2", "[Opening] Adequate"],
      ["3", "[Headers] All required"],
      ["0", "Ungrouped feedback"],
    ]) {
      const row = await addRubricItem(page, rubricTable);
      await row.getByRole("spinbutton", { name: "Points" }).fill(points);
      await row.getByRole("textbox", { name: "Description" }).fill(description);
    }

    await page
      .locator("#rubric-setting")
      .getByRole("button", { name: "Save" })
      .click();
    await expect(
      page.locator(".js-main-grading-panel input.js-selectable-rubric-item"),
    ).toHaveCount(4);
  });
  const state = { courseInstanceURL, assessmentId, instanceQuestionId };
  await test.step("Export the real ungraded submission database", async () => {
    const container = process.env.PLMGE_CONTAINER;
    if (!container) throw new Error("State capture requires the Docker runner");
    const directory = new URL(
      "../../test-results/deployment/state/",
      import.meta.url,
    );
    mkdirSync(directory, { recursive: true });
    execFileSync(
      "docker",
      [
        "exec",
        container,
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--file=/tmp/plmge-state.dump",
        "postgres",
      ],
      { timeout: 60_000 },
    );
    execFileSync(
      "docker",
      [
        "cp",
        `${container}:/tmp/plmge-state.dump`,
        fileURLToPath(new URL("database.dump", directory)),
      ],
      { timeout: 60_000 },
    );
    writeFileSync(new URL("submission.json", directory), JSON.stringify(state));
  });
});
