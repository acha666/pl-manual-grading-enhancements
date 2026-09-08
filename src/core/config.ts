export const VERSION = __VERSION__;
export const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
export const GROUP_PATTERN = /^(\s*\[([^\]\r\n]+)\]\s*)/;

export const SELECTORS = Object.freeze({
  marker: "span[data-pl-manual-grading-enhancements][hidden]",
  form: 'form[name="manual-grading-form"]',
  gradingPanel: ".js-main-grading-panel",
  rubricItem: "input.js-selectable-rubric-item",
  rubricLabel: "label.js-selectable-rubric-item-label",
  description: '[data-testid="rubric-item-description"]',
  feedback: 'textarea[name="submission_note"].js-submission-feedback',
  gradeAction:
    'button[type="submit"][name="__action"][value^="add_manual_grade"]',
  graderMenu: '#username-nav[data-view-type="instructor"] #navbarDropdown',
  submissionBlock: '[data-testid="submission-block"]',
  submissionBody: ".js-submission-body",
  filePreviewItem: ".js-file-preview-item",
  rubricDescription: '[data-testid="rubric-item-description"]',
});
