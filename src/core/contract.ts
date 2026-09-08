import type { RubricItem } from "./types.js";
import { GROUP_PATTERN, SELECTORS } from "./config.js";
import { requireExactlyOne, requireCondition } from "./dom.js";

export type Contract = ReturnType<typeof buildContract>;
export type ViewContract = ReturnType<typeof buildViewContract>;

function readGraderName(graderMenu: HTMLElement) {
  const copy = graderMenu.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".badge").forEach((badge) => badge.remove());
  return copy.textContent.replace(/\s+/g, " ").trim();
}

function readRubricItem(
  input: HTMLInputElement,
  index: number,
  ids: Set<string>,
): RubricItem {
  requireCondition(
    input.type === "checkbox",
    `Rubric item ${index + 1} is not a checkbox.`,
  );
  requireCondition(
    input.name === "rubric_item_selected_manual",
    `Rubric item ${index + 1} has an unexpected name.`,
  );
  requireCondition(input.value, `Rubric item ${index + 1} has no item ID.`);
  requireCondition(
    !ids.has(input.value),
    `Rubric item ID ${input.value} is duplicated.`,
  );
  ids.add(input.value);

  const points = Number(input.dataset.rubricItemPoints);
  requireCondition(
    Number.isFinite(points),
    `Rubric item ${input.value} has invalid point data.`,
  );

  const label = input.closest<HTMLLabelElement>(SELECTORS.rubricLabel);
  requireCondition(label, `Rubric item ${input.value} has no expected label.`);

  const descriptions = [
    ...label.querySelectorAll<HTMLElement>(SELECTORS.description),
  ];
  requireCondition(
    descriptions.length === 1,
    `Rubric item ${input.value} must have exactly one description; found ${descriptions.length}.`,
  );

  const row = label.parentElement;
  requireCondition(
    row?.tagName === "DIV",
    `Rubric item ${input.value} has an unexpected row wrapper.`,
  );

  const description = descriptions[0];
  const match = description.textContent.match(GROUP_PATTERN);
  const key = input.dataset.keyBinding ?? null;
  const badge = label.querySelector<HTMLElement>("kbd.pl-kbd");
  requireCondition(
    Boolean(key) === Boolean(badge),
    `Rubric item ${input.value} has inconsistent shortcut markup.`,
  );

  return {
    input,
    label,
    row,
    description,
    points,
    groupName: match?.[2].trim() ?? null,
    prefixLength: match?.[1].length ?? 0,
    originalKey: key,
    originalBadge: badge,
    originalBadgeText: badge?.textContent.trim() ?? null,
    generatedBadge: null,
    shortLabel: match
      ? description.textContent.slice(match[1].length).trim()
      : description.textContent.trim(),
  };
}

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

  const rightColumn = gradingCard.parentElement;
  requireCondition(
    rightColumn && rightColumn.matches(".col-lg-4.col-12"),
    "The Grading card is not inside the expected right-hand Bootstrap column.",
  );

  const layoutRow = rightColumn.parentElement;
  requireCondition(
    layoutRow && layoutRow.matches(".row"),
    "The Grading column is not inside the expected row.",
  );

  const leftColumns = [...layoutRow.children].filter((element) =>
    element.matches(".col-lg-8.col-12"),
  );
  requireCondition(
    leftColumns.length === 1,
    `Expected one left response column; found ${leftColumns.length}.`,
  );
  requireCondition(
    window.bootstrap?.Dropdown,
    "Bootstrap dropdown support is not available on the manual-grading page.",
  );

  return {
    gradingCard,
    gradingHeader,
    leftColumn: leftColumns[0] as HTMLElement,
    rightColumn,
    layoutRow,
  };
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
  const graderName = readGraderName(graderMenu);
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

export function buildContract() {
  const marker = requireExactlyOne(
    document,
    SELECTORS.marker,
    "activation marker",
  );
  const gradingPanel = requireExactlyOne(
    document,
    SELECTORS.gradingPanel,
    "main Grading panel",
  );
  const form = requireExactlyOne<HTMLFormElement>(
    gradingPanel,
    SELECTORS.form,
    "main manual-grading form",
  );

  const rubricActive = form.dataset.rubricActive === "true";
  const inputs = [
    ...form.querySelectorAll<HTMLInputElement>(SELECTORS.rubricItem),
  ];
  requireCondition(
    !rubricActive || inputs.length > 0,
    "The active rubric has no selectable rubric items.",
  );

  const ids = new Set<string>();
  const items = inputs.map((input, index) => readRubricItem(input, index, ids));
  const groupedItems = rubricActive
    ? items.filter((item) => item.groupName)
    : [];

  if (groupedItems.length > 0) {
    const rubricParents = new Set(
      groupedItems.map((item) => item.row.parentElement),
    );
    requireCondition(
      rubricParents.size === 1,
      "Grouped rubric items do not share the expected rubric container.",
    );
  }

  const gradeButtons = [
    ...form.querySelectorAll<HTMLButtonElement>(SELECTORS.gradeAction),
  ];

  return {
    marker,
    form,
    gradingPanel,
    items,
    groupedItems,
    gradeButtons,
  };
}
