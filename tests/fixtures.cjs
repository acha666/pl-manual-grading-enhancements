const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");
const ELEMENT_SRC = path.join(ROOT, "elements", "pl-manual-grading-enhancements", "src");
const SCRIPT_ORDER = [
  "config.js",
  "contract.js",
  "rubric-groups.js",
  "shortcuts.js",
  "attribution.js",
  "view-options.js",
  "main.js",
];

function scriptText(name) {
  return fs.readFileSync(path.join(ELEMENT_SRC, name), "utf8");
}

function rubricRow({ id, group, description, points, key, checked = false, outside = false }) {
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
        rubricRow({ id: "a1", group: "Opening", description: "Excellent", points: 4, key: "1" }),
        rubricRow({ id: "a2", group: "Opening", description: "Adequate", points: 2 }),
        rubricRow({ id: "b1", group: "Headers", description: "All required", points: 3, key: "2" }),
        rubricRow({ id: "b2", group: "Headers", description: "One missing", points: -1 }),
        rubricRow({ id: "u1", description: "Ungrouped feedback", points: 0, key: "3" }),
      ].join("\n")
    : rubricRow({ id: "u1", description: "Ungrouped feedback", points: 0, key: "1" });

  const view = includeView
    ? `<div class="row">
        <div class="col-lg-8 col-12" id="response-column">Response</div>
        <div class="col-lg-4 col-12">
          <div class="card">
            <div class="card-header">${malformed ? "Not grading" : "Grading"}</div>
            <div class="js-main-grading-panel">
              <form name="manual-grading-form" data-rubric-active="${activeRubric}">
                ${rows}
                ${includeAttribution ? '<textarea name="submission_note" class="js-submission-feedback"></textarea>' : ""}
                <button type="submit" name="__action" value="add_manual_grade">Submit</button>
                <button type="submit" name="__action" value="skip_manual_grade">Skip</button>
              </form>
            </div>
          </div>
        </div>
      </div>`
    : `<div class="js-main-grading-panel">
        <form name="manual-grading-form" data-rubric-active="${activeRubric}">
          ${rows}
          ${includeAttribution ? '<textarea name="submission_note" class="js-submission-feedback"></textarea>' : ""}
          <button type="submit" name="__action" value="add_manual_grade">Submit</button>
        </form>
      </div>`;

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
        ${extraMarker ? '<span data-pl-manual-grading-enhancements hidden></span>' : ""}
        ${aiGrading ? "" : '<span data-pl-manual-grading-enhancements hidden></span>'}
        <nav id="username-nav" data-view-type="instructor"><button id="navbarDropdown">Ada Lovelace <span class="badge">Instructor</span></button></nav>
        ${view}
        ${conflict}
      </body>
    </html>`;
}

function createPage(options = {}) {
  const dom = new JSDOM(pageHtml(options), {
    runScripts: "outside-only",
    url: "https://example.test/pl/course/1/manual_grading/2",
  });
  const { window } = dom;

  window.bootstrap = { Dropdown: class Dropdown {} };
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  window.HTMLElement.prototype.focus = function focus() {};

  return dom;
}

function loadScripts(window) {
  for (const name of SCRIPT_ORDER) window.eval(scriptText(name));
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
  loadScripts(dom.window);
  fireDOMContentLoaded(dom.window);
  return dom;
}

module.exports = {
  ELEMENT_SRC,
  ROOT,
  SCRIPT_ORDER,
  boot,
  createPage,
  fireDOMContentLoaded,
  loadScripts,
  pageHtml,
  rubricRow,
};
