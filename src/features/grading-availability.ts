import { SELECTORS } from "../core/config.js";
import { isGradeSubmission } from "../core/submission.js";
import type { Contract } from "../core/contract.js";
import type { Lifecycle } from "../core/types.js";

const HOUR = 60 * 60 * 1000;

/** Read PL's submission time, never the instance question's modified_at. */
function submissionTime(form: HTMLFormElement): number {
  const id = form.querySelector<HTMLInputElement>(
    'input[name="submission_id"]',
  )?.value;
  const modal = id
    ? document.getElementById(`submissionInfoModal-${id}`)
    : null;
  const row = [...(modal?.querySelectorAll("tr") ?? [])].find(
    (row) => row.querySelector("th")?.textContent.trim() === "Submission time",
  );
  const text = row?.querySelector("td")?.textContent.trim() ?? "";
  // PL formatDate emits a timezone abbreviation or GMT offset. Do not let
  // Date.parse silently interpret an unknown zone in the browser's local zone.
  const match = text.match(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((UTC|GMT|[ECMP][DS]T|GMT[+-]\d{1,2}(?::\d{2})?)\)$/,
  );
  return match ? Date.parse(`${match[1]} ${match[2]} ${match[3]}`) : NaN;
}

export class GradingAvailability implements Lifecycle {
  private notice: HTMLDivElement | null = null;
  private buttons = new Map<HTMLButtonElement, boolean>();
  private timer: number | undefined;
  private blocked = false;

  constructor(private contract: Contract) {}

  start() {
    if (!this.contract.gradeButtons.length) return false;
    const open = [...document.querySelectorAll(SELECTORS.assessmentAlert)].some(
      (alert) =>
        alert.textContent
          .replace(/\s+/g, " ")
          .trim()
          .startsWith("This assessment instance is still open."),
    );
    const time = submissionTime(this.contract.form);
    const remaining = time + HOUR - Date.now();
    if (!open && Number.isFinite(time) && remaining <= 0) return false;

    this.blocked = true;
    // Include the native conflict form's save actions as well.
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      SELECTORS.gradeAction,
    )) {
      this.buttons.set(button, button.disabled);
      button.disabled = true;
    }
    this.notice = document.createElement("div");
    this.notice.className =
      "alert alert-warning m-3 plmge-grading-availability";
    this.notice.setAttribute("role", "alert");
    this.notice.textContent = open
      ? "Grading is disabled while this assessment instance is still open. Refresh after it closes. "
      : Number.isFinite(time)
        ? "Grading is disabled until one hour after this submission. "
        : "Grading is disabled because the submission time could not be verified. ";
    const next = this.contract.form.querySelector<HTMLButtonElement>(
      SELECTORS.nextAction,
    );
    this.notice.append(
      next
        ? "Choose Next to open the next submission."
        : "Return to the grading queue to open another submission.",
    );
    this.contract.form.prepend(this.notice);
    document.addEventListener("submit", this.handleSubmit, true);
    next?.focus();
    if (!open && Number.isFinite(time) && remaining <= 2_147_483_647) {
      this.timer = window.setTimeout(() => this.stop(), remaining);
    }
    return true;
  }

  private handleSubmit = (event: SubmitEvent) => {
    if (
      this.blocked &&
      event.target instanceof HTMLFormElement &&
      event.target.matches(SELECTORS.form) &&
      isGradeSubmission(event)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  stop() {
    window.clearTimeout(this.timer);
    document.removeEventListener("submit", this.handleSubmit, true);
    const failed = this.contract.gradingPanel.querySelector(
      ".plmge-feature-messages .alert-danger",
    );
    for (const [button, disabled] of this.buttons) {
      if (!failed) button.disabled = disabled;
    }
    this.buttons.clear();
    this.notice?.remove();
    this.notice = null;
    this.blocked = false;
  }
}
