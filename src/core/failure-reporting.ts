import { SELECTORS } from "./config.js";

export function showFailure(
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
