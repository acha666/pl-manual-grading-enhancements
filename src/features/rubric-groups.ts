import type { Settings } from "../core/settings.js";
import type { Contract } from "../core/contract.js";
import type { RubricItem, Lifecycle } from "../core/types.js";
import { CriterionView } from "./criterion-view.js";
import { isGradeSubmission } from "../core/submission.js";
export class RubricGroups implements Lifecycle {
  private criteria: CriterionView[] = [];
  private internalChange = false;
  private manuallyExpanded = new Set<CriterionView>();
  private errorBox: HTMLDivElement | null = null;
  private listeners: (() => void)[] = [];

  constructor(
    private contract: Contract,
    private settings: Settings,
    private onStateChanged: () => void,
    private onValidSubmit: () => void,
  ) {
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  start() {
    if (this.contract.groupedItems.length === 0) return false;

    this.buildCriteria();
    this.bindEvents();
    this.setCollapseEnabled(this.settings.collapseCompleted, { initial: true });
    return true;
  }

  private buildCriteria() {
    const criteriaByName = new Map<string, CriterionView>();

    for (const item of this.contract.groupedItems) {
      let criterion = criteriaByName.get(item.groupName!);
      if (!criterion) {
        criterion = new CriterionView(item.groupName!, criteriaByName.size);
        item.row.before(criterion.root);
        criteriaByName.set(item.groupName!, criterion);
        this.criteria.push(criterion);
      }

      criterion.addItem(item);
    }

    this.errorBox = document.createElement("div");
    this.errorBox.className = "alert alert-danger plmge-error";
    this.errorBox!.hidden = true;
    this.criteria[0].root.before(this.errorBox);
    this.criteria.forEach((criterion) => criterion.refresh());
  }

  private bindEvents() {
    for (const criterion of this.criteria) {
      const headingHandler = () => {
        if (!this.settings.collapseCompleted) return;
        const expanded =
          criterion.heading.getAttribute("aria-expanded") !== "true";
        criterion.setExpanded(expanded);
        if (expanded) this.manuallyExpanded.add(criterion);
        else this.manuallyExpanded.delete(criterion);
        this.onStateChanged();
      };
      criterion.heading.addEventListener("click", headingHandler);
      this.listeners.push(() =>
        criterion.heading.removeEventListener("click", headingHandler),
      );

      for (const item of criterion.items) {
        const changeHandler = () => this.handleItemChange(criterion, item);
        item.input.addEventListener("change", changeHandler);
        this.listeners.push(() =>
          item.input.removeEventListener("change", changeHandler),
        );
      }
    }

    this.contract.form.addEventListener("submit", this.handleSubmit, true);
    this.listeners.push(() =>
      this.contract.form.removeEventListener("submit", this.handleSubmit, true),
    );
  }

  stop() {
    for (const remove of this.listeners) remove();
    this.listeners = [];
    for (const criterion of this.criteria) criterion.stop();
    this.criteria = [];
    this.manuallyExpanded.clear();
    this.errorBox?.remove();
    this.errorBox = null;
  }

  private handleItemChange(criterion: CriterionView, changedItem: RubricItem) {
    if (this.internalChange) return;

    if (changedItem.input.checked) {
      this.internalChange = true;
      try {
        for (const item of criterion.items) {
          if (item === changedItem || !item.input.checked) continue;
          item.input.checked = false;
          item.input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } finally {
        this.internalChange = false;
      }
    }

    criterion.attempted = false;
    criterion.refresh();
    if (
      this.settings.collapseCompleted &&
      criterion.selectedItems().length === 1 &&
      !this.manuallyExpanded.has(criterion)
    ) {
      criterion.setExpanded(false);
    }
    if (this.invalidCriteria().length === 0) this.errorBox!.hidden = true;
    this.onStateChanged();
  }

  private handleSubmit(event: SubmitEvent) {
    if (!isGradeSubmission(event)) return;

    const invalid = this.invalidCriteria();
    if (invalid.length === 0) {
      this.onValidSubmit();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    for (const criterion of this.criteria) {
      criterion.attempted = invalid.includes(criterion);
      if (criterion.attempted) criterion.setExpanded(true);
      criterion.refresh();
    }

    this.errorBox!.textContent = `Select exactly one item in each criterion: ${invalid
      .map((criterion) => criterion.name)
      .join(", ")}`;
    this.errorBox!.hidden = false;
    this.onStateChanged();

    invalid[0].root.scrollIntoView({ behavior: "smooth", block: "center" });
    invalid[0].items[0].input.focus({ preventScroll: true });
  }

  setCollapseEnabled(enabled: boolean, { initial = false } = {}) {
    this.settings.collapseCompleted = enabled;

    for (const criterion of this.criteria) {
      criterion.heading.disabled = !enabled;

      if (!enabled) {
        criterion.setExpanded(true);
      } else if (
        criterion.selectedItems().length === 1 &&
        !this.manuallyExpanded.has(criterion)
      ) {
        criterion.setExpanded(false);
      } else if (!initial) {
        criterion.setExpanded(true);
      }

      criterion.refresh();
    }

    this.onStateChanged();
  }

  private invalidCriteria() {
    return this.criteria.filter(
      (criterion) => criterion.selectedItems().length !== 1,
    );
  }

  visibleItems() {
    return this.criteria.flatMap((criterion) =>
      criterion.body.hidden ? [] : criterion.items,
    );
  }
}
