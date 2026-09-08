import { showFailure } from "./core/failure-reporting.js";
import { SELECTORS, VERSION } from "./core/config.js";
import { buildContract } from "./core/contract.js";
import type { FeatureRuntime } from "./core/runtime.js";
import { startFeatures } from "./features/index.js";

function boot() {
  if (!document.querySelector(SELECTORS.marker)) return;
  if (document.documentElement.dataset.plManualGradingEnhancements) return;
  let runtime: FeatureRuntime | null = null;
  const initialize = () => {
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
      const panel = document.querySelector<HTMLElement>(SELECTORS.gradingPanel);
      if (panel) showFailure(panel, "Manual grading enhancements", error, true);
      else
        console.error(
          "Manual grading enhancements failed to initialize.",
          error,
        );
    }
  };
  initialize();
  const panel = document.querySelector(SELECTORS.gradingPanel);
  if (!panel) return;
  const observer = new MutationObserver(() => {
    observer.disconnect();
    try {
      initialize();
    } finally {
      observer.observe(panel, { childList: true });
    }
  });
  observer.observe(panel, { childList: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
