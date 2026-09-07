(() => {
  "use strict";

  const PLMGE = window.PLMGE;
  if (!PLMGE) throw new Error("Manual grading enhancement configuration was not loaded.");

  const TRAILING_ATTRIBUTION = /(?:\r?\n){0,2}Graded by:[^\r\n]*\s*$/i;

  PLMGE.FeedbackAttribution = class FeedbackAttribution {
    constructor(feedback, graderName) {
      this.feedback = feedback;
      this.graderName = graderName;
    }

    append() {
      // Replace only a terminal attribution. A similarly worded sentence in the
      // body of the feedback is student-facing content and must remain untouched.
      const feedbackBody = this.feedback.value.replace(TRAILING_ATTRIBUTION, "").trimEnd();
      const attribution = `Graded by: ${this.graderName}`;
      this.feedback.value = feedbackBody ? `${feedbackBody}\n\n${attribution}` : attribution;

      // PrairieLearn listens for input to resize the textarea and update its UI.
      this.feedback.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
})();
