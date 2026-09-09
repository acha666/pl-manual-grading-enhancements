import { type Page } from "@playwright/test";

/** Locators and interactions shared by manual-grading workflow steps. */
export function manualGradingPage(page: Page) {
  const marker = page.locator(
    "span[data-pl-manual-grading-enhancements][hidden]",
  );
  const criteria = page.locator(".plmge-criterion");
  const feedback = page.locator(
    'textarea[name="submission_note"].js-submission-feedback',
  );
  const form = page.locator(
    '.js-main-grading-panel form[name="manual-grading-form"]',
  );
  const items = form.locator("input.js-selectable-rubric-item");
  const menu = page.locator(".plmge-options-menu");
  const gradingColumn = page
    .locator(".col-lg-4.col-12")
    .filter({ has: page.locator(".js-main-grading-panel") });
  const errors = page.locator(".plmge-feature-messages");
  const gradeButton = page.locator("#grade-button");

  return {
    marker,
    criteria,
    feedback,
    form,
    items,
    menu,
    gradingColumn,
    errors,
    gradeButton,
    rubricItem(description: string) {
      return form
        .locator("label.js-selectable-rubric-item-label")
        .filter({ hasText: description })
        .locator("input.js-selectable-rubric-item");
    },

    async openOptions() {
      if (!(await this.menu.isVisible())) {
        await page
          .getByRole("button", { name: "Manual grading options" })
          .click();
      }
    },

    async setOption(name: string, enabled: boolean) {
      await this.openOptions();
      await this.menu
        .getByRole("checkbox", { name, exact: true })
        .setChecked(enabled);
    },
  };
}
