import type { Lifecycle } from "../core/types.js";

const TRAILING_ATTRIBUTION = /(?:\r?\n){0,2}Graded by:[^\r\n]*\s*$/i;

export class FeedbackAttribution implements Lifecycle {
  constructor(
    private feedback: HTMLTextAreaElement,
    private graderName: string,
    private form: HTMLFormElement,
    private onSubmit: ((event: SubmitEvent) => void) | null,
  ) {}

  start() {
    if (this.onSubmit)
      this.form.addEventListener("submit", this.onSubmit, true);
  }

  stop() {
    if (this.onSubmit)
      this.form.removeEventListener("submit", this.onSubmit, true);
  }

  append() {
    // Replace only a terminal attribution. A similarly worded sentence in the
    // body of the feedback is student-facing content and must remain untouched.
    const feedbackBody = this.feedback.value
      .replace(TRAILING_ATTRIBUTION, "")
      .trimEnd();
    const attribution = `Graded by: ${this.graderName}`;
    this.feedback.value = feedbackBody
      ? `${feedbackBody}\n\n${attribution}`
      : attribution;

    // PrairieLearn listens for input to resize the textarea and update its UI.
    this.feedback.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
