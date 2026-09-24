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
  if (!match) return NaN;
  const offsets: Record<string, string> = {
    UTC: "Z",
    GMT: "Z",
    EST: "-05:00",
    EDT: "-04:00",
    CST: "-06:00",
    CDT: "-05:00",
    MST: "-07:00",
    MDT: "-06:00",
    PST: "-08:00",
    PDT: "-07:00",
  };
  const zone = match[3];
  const offset =
    offsets[zone] ??
    zone.replace(
      /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/,
      (_, sign: string, hours: string, minutes: string | undefined) =>
        `${sign}${hours.padStart(2, "0")}:${minutes ?? "00"}`,
    );
  // WebKit rejects PL's space-separated date with a timezone abbreviation.
  return Date.parse(`${match[1]}T${match[2]}${offset}`);
}

export class GradingAvailability implements Lifecycle {
  private notice: HTMLDivElement | null = null;
  private buttons = new Map<HTMLButtonElement, boolean>();
  private timer: number | undefined;

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
  }
}
