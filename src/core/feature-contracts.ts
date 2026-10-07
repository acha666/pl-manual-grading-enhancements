import type { Contract } from "./contract.js";
import { requireCondition, requireExactlyOne } from "./dom.js";
import { SELECTORS } from "./config.js";

export type ViewContract = ReturnType<typeof buildViewContract>;

export function buildViewContract(contract: Contract) {
  const gradingCard = contract.gradingPanel.closest<HTMLElement>(".card");
  requireCondition(
    gradingCard,
    "The main Grading panel is not inside the expected card.",
  );

  const gradingHeader = requireExactlyOne(
    gradingCard,
    ":scope > .card-header",
    "Grading card header",
  );
  requireCondition(
    gradingHeader.textContent.trim() === "Grading",
    `Expected the Grading card heading to be "Grading"; found "${gradingHeader.textContent.trim()}".`,
  );

  requireCondition(
    window.bootstrap?.Dropdown,
    "Bootstrap dropdown support is not available on the manual-grading page.",
  );
  return { gradingHeader };
}

export function buildAttributionContract(contract: Contract) {
  const feedback = requireExactlyOne<HTMLTextAreaElement>(
    contract.form,
    SELECTORS.feedback,
    "submission feedback field",
  );
  requireCondition(
    !feedback.disabled && !feedback.readOnly,
    "The submission feedback field is not editable.",
  );

  const graderMenu = requireExactlyOne(
    document,
    SELECTORS.graderMenu,
    "authenticated grader menu",
  );
  const copy = graderMenu.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".badge").forEach((badge) => badge.remove());
  const graderName = copy.textContent.replace(/\s+/g, " ").trim();
  requireCondition(
    graderName.length > 0,
    "The authenticated grader name is empty.",
  );
  requireCondition(
    graderName.length <= 200,
    "The authenticated grader name is unexpectedly long.",
  );

  return { feedback, graderName };
}
