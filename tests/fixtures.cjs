const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const assert = require("node:assert/strict");
const { afterEach } = require("node:test");

// Close windows even when assertions fail; observers and timers must not leak.
const pages = new Set();
afterEach(() => {
  const errors = [];
  for (const dom of pages) {
    dom.window.close();
    errors.push(...dom.jsdomErrors);
  }
  pages.clear();
  assert.deepEqual(errors, [], "Unexpected jsdom errors");
});

const ROOT = path.resolve(__dirname, "..");
const ELEMENT_SRC = path.join(
  ROOT,
  "elements",
  "pl-manual-grading-enhancements",
  "dist",
);

function rubricRow({
  id,
  group,
  description,
  points,
  key,
  checked = false,
  outside = false,
}) {
  const groupText = group ? `[${group}] ` : "";
  const keyMarkup = key ? `<kbd class="pl-kbd">${key}</kbd>` : "";
  const outsideClass = outside ? " external-rubric-row" : "";
  return `
    <div class="rubric-row${outsideClass}">
      <label class="js-selectable-rubric-item-label">
        <input
          type="checkbox"
          class="js-selectable-rubric-item"
          name="rubric_item_selected_manual"
          value="${id}"
          data-rubric-item-points="${points}"
          ${key ? `data-key-binding="${key}"` : ""}
          ${checked ? "checked" : ""}
        />
        ${keyMarkup}
        <span data-testid="rubric-item-description">${groupText}${description}</span>
      </label>
    </div>`;
}

function pageHtml({
  grouped = true,
  activeRubric = true,
  includeView = true,
  includeAttribution = true,
  aiGrading = false,
  extraMarker = false,
  malformed = false,
  includeConflictForm = false,
} = {}) {
  const rows = grouped
    ? [
        rubricRow({
          id: "a1",
          group: "Opening",
          description: "Excellent",
          points: 4,
          key: "1",
        }),
        rubricRow({
          id: "a2",
          group: "Opening",
          description: "Adequate",
          points: 2,
        }),
        rubricRow({
          id: "b1",
          group: "Headers",
          description: "All required",
          points: 3,
          key: "2",
        }),
        rubricRow({
          id: "b2",
          group: "Headers",
          description: "One missing",
          points: -1,
        }),
        rubricRow({
          id: "u1",
          description: "Ungrouped feedback",
          points: 0,
          key: "3",
        }),
      ].join("\n")
    : rubricRow({
        id: "u1",
        description: "Ungrouped feedback",
        points: 0,
        key: "1",
      });

  const gradingPanel = `<div class="js-main-grading-panel">
    <form name="manual-grading-form" data-rubric-active="${activeRubric}">
      ${rows}
      ${includeAttribution ? '<textarea name="submission_note" class="js-submission-feedback"></textarea>' : ""}
      <button type="submit" name="__action" value="add_manual_grade">Submit</button>
      ${includeView ? '<button type="submit" name="__action" value="skip_manual_grade">Skip</button>' : ""}
    </form>
  </div>`;
  const view = includeView
    ? `<div class="row">
        <div class="col-lg-8 col-12" id="response-column">Response</div>
        <div class="col-lg-4 col-12">
          <div class="card">
            <div class="card-header">${malformed ? "Not grading" : "Grading"}</div>
            ${gradingPanel}
          </div>
        </div>
      </div>`
    : gradingPanel;

  const conflict = includeConflictForm
    ? `<div class="modal show" id="conflictGradingJobModal">
        <form name="manual-grading-form">
          <button type="submit" name="__action" value="add_manual_grade">Conflict grade</button>
        </form>
      </div>`
    : "";

  return `<!doctype html>
    <html>
      <body data-ai-grading="${aiGrading}">
        ${extraMarker ? "<span data-pl-manual-grading-enhancements hidden></span>" : ""}
        ${aiGrading ? "" : "<span data-pl-manual-grading-enhancements hidden></span>"}
        <nav id="username-nav" data-view-type="instructor"><button id="navbarDropdown">Ada Lovelace <span class="badge">Instructor</span></button></nav>
        ${view}
        ${conflict}
      </body>
    </html>`;
}

function createPage(options = {}) {
  const jsdomErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => jsdomErrors.push(error));
  const dom = new JSDOM(pageHtml(options), {
    virtualConsole,
    runScripts: "outside-only",
    url: "https://example.test/pl/course/1/manual_grading/2",
  });
  const { window } = dom;

  window.bootstrap = { Dropdown: class Dropdown {} };
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};

  dom.jsdomErrors = jsdomErrors;
  pages.add(dom);
  return dom;
}

function loadBundle(window) {
  window.eval(fs.readFileSync(path.join(ELEMENT_SRC, "main.js"), "utf8"));
}

function fireDOMContentLoaded(window) {
  window.document.dispatchEvent(
    new window.Event("DOMContentLoaded", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function boot(options = {}) {
  const dom = createPage(options);
  loadBundle(dom.window);
  fireDOMContentLoaded(dom.window);
  return dom;
}

function submit(form, button) {
  return form.dispatchEvent(
    new form.ownerDocument.defaultView.SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter: button,
    }),
  );
}

module.exports = {
  boot,
  createPage,
  fireDOMContentLoaded,
  loadBundle,
  submit,
};
