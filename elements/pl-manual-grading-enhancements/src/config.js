(() => {
  "use strict";

  const PLMGE = (window.PLMGE = window.PLMGE ?? {});

  PLMGE.VERSION = "2.0.1";
  PLMGE.STORAGE_KEY = "pl.manualGradingEnhancements.settings.v1";
  PLMGE.DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  PLMGE.GROUP_PATTERN = /^(\s*\[([^\]\r\n]+)\]\s*)/;

  PLMGE.SELECTORS = Object.freeze({
    marker: 'span[data-pl-manual-grading-enhancements][hidden]',
    form: 'form[name="manual-grading-form"]',
    gradingPanel: ".js-main-grading-panel",
    rubricItem: "input.js-selectable-rubric-item",
    rubricLabel: "label.js-selectable-rubric-item-label",
    description: '[data-testid="rubric-item-description"]',
    feedback: 'textarea[name="submission_note"].js-submission-feedback',
    gradeAction: 'button[type="submit"][name="__action"][value^="add_manual_grade"]',
    graderMenu: '#username-nav[data-view-type="instructor"] #navbarDropdown',
  });

  PLMGE.DEFAULT_SETTINGS = Object.freeze({
    splitScrolling: false,
    collapseCompleted: false,
    appendGraderName: true,
  });

  PLMGE.IntegrationError = class IntegrationError extends Error {
    constructor(message) {
      super(message);
      this.name = "ManualGradingEnhancementIntegrationError";
    }
  };

  PLMGE.requireExactlyOne = function requireExactlyOne(root, selector, description) {
    const matches = [...root.querySelectorAll(selector)];
    if (matches.length !== 1) {
      throw new PLMGE.IntegrationError(
        `Expected exactly one ${description}; found ${matches.length}. Selector: ${selector}`,
      );
    }
    return matches[0];
  };

  PLMGE.requireCondition = function requireCondition(condition, message) {
    if (!condition) throw new PLMGE.IntegrationError(message);
  };

  PLMGE.readSettings = function readSettings() {
    try {
      const value = window.localStorage.getItem(PLMGE.STORAGE_KEY);
      const stored = value ? JSON.parse(value) : null;
      if (!stored) return { ...PLMGE.DEFAULT_SETTINGS };

      return Object.fromEntries(
        Object.entries(PLMGE.DEFAULT_SETTINGS).map(([name, defaultValue]) => [
          name,
          typeof stored[name] === "boolean" ? stored[name] : defaultValue,
        ]),
      );
    } catch (error) {
      console.warn("Manual grading enhancements: settings could not be read.", error);
      return { ...PLMGE.DEFAULT_SETTINGS };
    }
  };

  PLMGE.writeSettings = function writeSettings(settings) {
    try {
      window.localStorage.setItem(PLMGE.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn("Manual grading enhancements: settings could not be saved.", error);
    }
  };

  PLMGE.stripTextPrefix = function stripTextPrefix(element, length) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = length;

    // Remove only text nodes so inline Markdown formatting in the description survives.
    while (remaining > 0) {
      const node = walker.nextNode();
      PLMGE.requireCondition(node, "The rubric description prefix could not be removed safely.");
      const consumed = Math.min(remaining, node.data.length);
      node.data = node.data.slice(consumed);
      remaining -= consumed;
    }
  };

  PLMGE.formatPoints = function formatPoints(points) {
    return `${points >= 0 ? "+" : ""}${points}`;
  };
})();
