const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createPage,
  loadBundle,
  fireDOMContentLoaded,
} = require("./fixtures.cjs");

const source =
  '#include <stdio.h>\n/* documentation\n   continues */\nint main(void) {\n  puts("<script>&");\n  return 0;\n}\n';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function preview(document, file = "answer.c", text = source, hidden = false) {
  const block = document.createElement("div");
  block.dataset.testid = "submission-block";
  block.innerHTML = `<div class="js-file-preview-item"><button>Show preview</button>
    <div class="file-preview-container"><pre class="bg-dark text-white rounded p-3 mb-0${hidden ? " d-none" : ""}"><code></code></pre></div>
    <button class="file-preview-expand">Expand</button></div>`;
  block.querySelector(".js-file-preview-item").dataset.file = file;
  block.querySelector("code").textContent = text;
  document.querySelector("#response-column").append(block);
  return block;
}

function start(enabled = false, hidden = false) {
  const dom = createPage();
  const { window } = dom;
  const block = preview(
    window.document,
    "answer.c",
    hidden ? "" : source,
    hidden,
  );
  window.localStorage.setItem(
    "pl.manualGradingEnhancements.settings.v1",
    JSON.stringify({ codePreview: enabled }),
  );
  loadBundle(window);
  fireDOMContentLoaded(window);
  return {
    window,
    block,
    code: block.querySelector("code"),
    pre: block.querySelector("pre"),
  };
}

function toggle(window) {
  window.document.querySelector('[data-setting="codePreview"]').click();
}

test("C preview is off by default and restores native markup on disable", async () => {
  const { window, block, code, pre } = start();
  assert.equal(
    window.document.querySelector('[data-setting="codePreview"]').checked,
    false,
  );
  assert.equal(window.Prism, undefined);
  assert.equal(code.children.length, 0);
  toggle(window);
  assert.ok(code.querySelector(".token.keyword"));
  assert.equal(code.querySelectorAll(".line-numbers-rows > span").length, 7);
  assert.equal(code.textContent, source);
  assert.equal(code.querySelector("script"), null);
  assert.equal(
    code.querySelector(".line-numbers-rows").getAttribute("aria-hidden"),
    "true",
  );
  assert.equal(window.Prism, undefined);
  toggle(window);
  // class/style attributes may remain empty, but native classes and controls survive.
  assert.equal(pre.className, "bg-dark text-white rounded p-3 mb-0");
  assert.equal(pre.hasAttribute("tabindex"), false);
  assert.equal(code.children.length, 0);
  assert.equal(code.textContent, source);
  assert.equal(block.querySelector("button").textContent, "Show preview");
  assert.equal(
    block.querySelector(".file-preview-expand").textContent,
    "Expand",
  );
  code.textContent = "int disabled;";
  await tick();
  assert.equal(code.children.length, 0);
});

test("handles late file loads and updated text without duplicating line numbers", async () => {
  const { window, block, code, pre } = start(true, true);
  code.textContent = source;
  pre.classList.remove("d-none");
  await tick();
  assert.equal(code.textContent, source);
  assert.ok(code.querySelector(".token.comment").textContent.includes("\n"));
  block.classList.toggle("show");
  await tick();
  assert.equal(code.querySelectorAll(".line-numbers-rows").length, 1);
  const updated = "#define ADD(x) \\\n  ((x) + 1)\r\n\r\nint n = ADD(2);\r\n";
  code.textContent = updated;
  await tick();
  assert.equal(code.textContent, updated);
  assert.equal(code.querySelectorAll(".line-numbers-rows > span").length, 4);
  toggle(window);
  assert.equal(code.textContent, updated);
});

test("preserves host Prism and ignores other languages and unrelated code", () => {
  const dom = createPage();
  const { window } = dom;
  const hostPrism = { manual: false, languages: { existing: {} } };
  window.Prism = hostPrism;
  const c = preview(window.document);
  const python = preview(window.document, "answer.py", "print(1)");
  const header = preview(window.document, "answer.h", "int x;");
  const outside = window.document.createElement("code");
  outside.className = "language-c";
  outside.textContent = "int untouched;";
  window.document.body.append(outside);
  loadBundle(window);
  fireDOMContentLoaded(window);
  toggle(window);
  assert.ok(c.querySelector(".token.keyword"));
  assert.equal(python.querySelector("code").children.length, 0);
  assert.equal(header.querySelector("code").children.length, 0);
  assert.equal(outside.children.length, 0);
  assert.equal(window.Prism, hostPrism);
  assert.equal(hostPrism.manual, false);
});

test("panel reinitialization and re-enabling preserve code and a single gutter", async () => {
  const { window, code, pre } = start(true);
  window.document
    .querySelector(".js-main-grading-panel")
    .append(window.document.createElement("div"));
  await tick();
  assert.equal(code.textContent, source);
  assert.equal(code.querySelectorAll(".line-numbers-rows").length, 1);
  toggle(window);
  toggle(window);
  assert.equal(code.querySelectorAll(".line-numbers-rows").length, 1);
  code.textContent = Array(1002).fill("int x;").join("\n");
  await tick();
  assert.equal(pre.style.getPropertyValue("--plmge-line-digits"), "4");
  assert.equal(code.querySelectorAll(".line-numbers-rows > span").length, 1002);
});

test("preserves nonbreaking spaces inside highlighted tokens", () => {
  const { window, code } = start();
  const text = "int x;\r\n/* nonbreaking\u00a0space */\r\n";
  code.textContent = text;
  toggle(window);
  assert.equal(code.textContent, text);
  toggle(window);
  assert.equal(code.textContent, text);
});
