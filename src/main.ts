import { showFailure } from "./core/failure-reporting.js";
import { SELECTORS, VERSION } from "./core/config.js";
import { buildContract } from "./core/contract.js";
import type { FeatureRuntime } from "./core/runtime.js";
import { startFeatures } from "./features/index.js";

function boot() {
  if (!document.querySelector(SELECTORS.marker)) return;
  if (document.documentElement.dataset.plManualGradingEnhancements) return;
  const panel = document.querySelector<HTMLElement>(SELECTORS.gradingPanel);
  let runtime: FeatureRuntime | null = null;
  let snapshot: unknown[] = [];

  // React updates this form in place. Ignore mutations to enhancement markup
  // and totals; rebuild only when the native rubric or form contract changes.
  const readSnapshot = () => [
    panel?.querySelector(SELECTORS.form),
    panel?.querySelector(SELECTORS.feedback),
    ...[...(panel?.querySelectorAll(SELECTORS.rubricItem) ?? [])].flatMap(
      (input) => {
        const label = input.closest(SELECTORS.rubricLabel);
        return [
          input,
          label?.querySelector(SELECTORS.description)?.textContent,
          label?.querySelector(SELECTORS.score),
        ];
      },
    ),
  ];
  const observer = new MutationObserver(() => {
    const next = readSnapshot();
    if (
      next.length !== snapshot.length ||
      next.some((value, index) => value !== snapshot[index])
    )
      initialize();
  });
  function initialize() {
    observer.disconnect();
    runtime?.stop();
    runtime = null;
    try {
      const contract = buildContract();
      runtime = startFeatures(contract, (name, error, critical) =>
        showFailure(contract.gradingPanel, name, error, critical),
      );
      document.documentElement.dataset.plManualGradingEnhancements = VERSION;
    } catch (error) {
      document.documentElement.dataset.plManualGradingEnhancements = "failed";
      if (panel) showFailure(panel, "Manual grading enhancements", error, true);
      else
        console.error(
          "Manual grading enhancements failed to initialize.",
          error,
        );
    }
    snapshot = readSnapshot();
    if (panel)
      observer.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true,
      });
  }
  // Rubric/AI islands publish this before React reconciles the panel. Restore
  // decorations first, including badges whose upstream key may have changed.
  document.addEventListener(
    "instance-question-grading-panel-update",
    () => {
      observer.disconnect();
      runtime?.stop();
      runtime = null;
      window.setTimeout(initialize, 0);
    },
    true,
  );
  initialize();
}

function ready() {
  if (!document.querySelector(SELECTORS.marker)) return;
  const island = document.querySelector(SELECTORS.gradingIsland);
  if (!island) return boot();

  // Upstream's feedback-sizing effect sets inline height after React commits.
  // load (even followed by a timer) does not guarantee hydration in WebKit.
  const hydrated = () =>
    !!island.querySelector<HTMLTextAreaElement>(SELECTORS.feedback)?.style
      .height;
  if (hydrated()) return boot();
  const observer = new MutationObserver(() => {
    if (!hydrated()) return;
    observer.disconnect();
    window.clearTimeout(timeout);
    boot();
  });
  observer.observe(island, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style"],
  });
  const timeout = window.setTimeout(() => {
    observer.disconnect();
    const panel = document.querySelector<HTMLElement>(SELECTORS.gradingPanel);
    if (panel)
      showFailure(
        panel,
        "Manual grading enhancements",
        new Error("The upstream grading panel did not finish initializing."),
        true,
      );
  }, 15_000);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ready, { once: true });
} else ready();
