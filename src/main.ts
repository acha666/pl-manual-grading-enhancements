import { SELECTORS, VERSION } from "./core/config.js";
import { buildContract } from "./core/contract.js";
import type { FeatureRuntime } from "./core/runtime.js";
import { startFeatures } from "./features/index.js";

function showFailure(
  panel: HTMLElement,
  feature: string,
  error: unknown,
  critical = false,
) {
  console.error(`Manual grading enhancement failed: ${feature}.`, error);
  if (critical) {
    panel
      .querySelectorAll<HTMLButtonElement>(
        `${SELECTORS.form} ${SELECTORS.gradeAction}`,
      )
      .forEach((button) => {
        button.disabled = true;
        button.title = "Manual grading enhancements failed to initialize.";
      });
  }
  let container = panel.querySelector<HTMLElement>(".plmge-feature-messages");
  if (!container) {
    container = document.createElement("div");
    container.className = "plmge-feature-messages";
    panel.prepend(container);
  }
  const alert = document.createElement("div");
  alert.className = `alert ${critical ? "alert-danger" : "alert-warning"} m-3`;
  alert.setAttribute("role", "alert");
  alert.textContent = critical
    ? `${feature} failed to initialize. Grade submission has been disabled. Open the browser console for details.`
    : `${feature} is unavailable on this page. Other manual grading enhancements remain active.`;
  container.append(alert);
}

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
