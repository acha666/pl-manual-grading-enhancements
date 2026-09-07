(() => {
  "use strict";

  const PLMGE = window.PLMGE;
  if (!PLMGE) throw new Error("Manual grading enhancement configuration was not loaded.");

  PLMGE.RubricGroups = class RubricGroups {
    constructor(contract, settings, onStateChanged, onValidSubmit) {
      this.contract = contract;
      this.settings = settings;
      this.onStateChanged = onStateChanged;
      this.onValidSubmit = onValidSubmit;
      this.criteria = [];
      this.internalChange = false;
      this.errorBox = null;
      this.listeners = [];
      this.handleSubmit = this.handleSubmit.bind(this);
    }

    start() {
      if (this.contract.groupedItems.length === 0) return false;

      this.buildCriteria();
      this.bindEvents();
      this.setCollapseEnabled(this.settings.collapseCompleted, { initial: true });
      return true;
    }

    buildCriteria() {
      const criteriaByName = new Map();

      for (const item of this.contract.groupedItems) {
        let criterion = criteriaByName.get(item.groupName);
        if (!criterion) {
          criterion = this.createCriterion(item.groupName, criteriaByName.size);
          item.row.before(criterion.root);
          criteriaByName.set(item.groupName, criterion);
          this.criteria.push(criterion);
        }

        PLMGE.stripTextPrefix(item.description, item.prefixLength);
        item.row.classList.add("plmge-item");
        criterion.body.append(item.row);
        criterion.items.push(item);
      }

      this.errorBox = document.createElement("div");
      this.errorBox.className = "alert alert-danger plmge-error";
      this.errorBox.hidden = true;
      this.criteria[0].root.before(this.errorBox);
      this.criteria.forEach((criterion) => this.refreshCriterion(criterion));
    }

    createCriterion(name, index) {
      const root = document.createElement("section");
      const heading = document.createElement("button");
      const nameElement = document.createElement("span");
      const summary = document.createElement("span");
      const toggle = document.createElement("i");
      const body = document.createElement("div");
      const headingId = `plmge-criterion-heading-${index + 1}`;
      const bodyId = `plmge-criterion-body-${index + 1}`;

      root.className = "plmge-criterion";
      root.setAttribute("role", "group");
      root.setAttribute("aria-labelledby", headingId);

      heading.type = "button";
      heading.id = headingId;
      heading.className = "plmge-criterion-heading";
      heading.setAttribute("aria-controls", bodyId);
      heading.setAttribute("aria-expanded", "true");

      nameElement.className = "plmge-criterion-name";
      nameElement.textContent = name;
      summary.className = "plmge-criterion-summary";
      toggle.className = "bi bi-chevron-up plmge-criterion-toggle";
      toggle.setAttribute("aria-hidden", "true");

      body.id = bodyId;
      body.className = "plmge-criterion-body";

      heading.append(nameElement, summary, toggle);
      root.append(heading, body);

      return { name, root, heading, summary, body, items: [], attempted: false };
    }

    bindEvents() {
      for (const criterion of this.criteria) {
        const headingHandler = () => {
          if (!this.settings.collapseCompleted) return;
          this.setExpanded(
            criterion,
            criterion.heading.getAttribute("aria-expanded") !== "true",
          );
          this.notifyStateChanged();
        };
        criterion.heading.addEventListener("click", headingHandler);
        this.listeners.push([criterion.heading, "click", headingHandler]);

        for (const item of criterion.items) {
          const changeHandler = () => this.handleItemChange(criterion, item);
          item.input.addEventListener("change", changeHandler);
          this.listeners.push([item.input, "change", changeHandler]);
        }
      }

      this.contract.form.addEventListener("submit", this.handleSubmit, true);
      this.listeners.push([this.contract.form, "submit", this.handleSubmit, true]);
    }

    stop() {
      for (const [target, type, handler, capture] of this.listeners) {
        target.removeEventListener(type, handler, capture);
      }
      this.listeners = [];
    }

    handleItemChange(criterion, changedItem) {
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
      this.refreshCriterion(criterion);
      if (this.settings.collapseCompleted && this.selectedItems(criterion).length === 1) {
        this.setExpanded(criterion, false);
      }
      if (this.invalidCriteria().length === 0) this.errorBox.hidden = true;
      this.notifyStateChanged();
    }

    handleSubmit(event) {
      const action = event.submitter?.value ?? "add_manual_grade";
      if (!action.startsWith("add_manual_grade")) return;

      const invalid = this.invalidCriteria();
      if (invalid.length === 0) {
        this.onValidSubmit();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      for (const criterion of this.criteria) {
        criterion.attempted = invalid.includes(criterion);
        if (criterion.attempted) this.setExpanded(criterion, true);
        this.refreshCriterion(criterion);
      }

      this.errorBox.textContent = `Select exactly one item in each criterion: ${invalid
        .map((criterion) => criterion.name)
        .join(", ")}`;
      this.errorBox.hidden = false;
      this.notifyStateChanged();

      invalid[0].root.scrollIntoView({ behavior: "smooth", block: "center" });
      invalid[0].items[0].input.focus({ preventScroll: true });
    }

    setCollapseEnabled(enabled, { initial = false } = {}) {
      this.settings.collapseCompleted = enabled;

      for (const criterion of this.criteria) {
        criterion.heading.disabled = !enabled;

        if (!enabled) {
          this.setExpanded(criterion, true);
        } else if (this.selectedItems(criterion).length === 1) {
          this.setExpanded(criterion, false);
        } else if (!initial) {
          this.setExpanded(criterion, true);
        }

        this.refreshCriterion(criterion);
      }

      this.notifyStateChanged();
    }

    selectedItems(criterion) {
      return criterion.items.filter((item) => item.input.checked);
    }

    invalidCriteria() {
      return this.criteria.filter((criterion) => this.selectedItems(criterion).length !== 1);
    }

    visibleItems() {
      return this.criteria.flatMap((criterion) => (criterion.body.hidden ? [] : criterion.items));
    }

    notifyStateChanged() {
      this.onStateChanged();
    }

    setExpanded(criterion, expanded) {
      criterion.heading.setAttribute("aria-expanded", String(expanded));
      criterion.body.hidden = !expanded;
    }

    refreshCriterion(criterion) {
      const selected = this.selectedItems(criterion);
      const complete = selected.length === 1;
      const invalid = criterion.attempted && !complete;

      criterion.root.dataset.state = invalid ? "invalid" : complete ? "complete" : "incomplete";

      if (complete) {
        criterion.summary.textContent = `${selected[0].shortLabel} [${PLMGE.formatPoints(selected[0].points)}]`;
      } else if (selected.length > 1) {
        criterion.summary.textContent = "Choose one item";
      } else {
        criterion.summary.textContent = "Required";
      }
    }
  };
})();
