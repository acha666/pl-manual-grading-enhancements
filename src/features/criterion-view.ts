import type { RubricItem } from "../core/types.js";
import { stripTextPrefix } from "../core/dom.js";

/** Adds a heading without reparenting rows owned by the upstream renderer. */
export class CriterionView {
  readonly root: HTMLElement;
  readonly heading: HTMLButtonElement;
  readonly summary: HTMLElement;
  expanded = true;
  readonly items: RubricItem[] = [];
  attempted = false;
  private restorations: (() => void)[] = [];

  constructor(
    readonly name: string,
    index: number,
  ) {
    const root = document.createElement("section");
    const heading = document.createElement("button");
    const nameElement = document.createElement("span");
    const summary = document.createElement("span");
    const toggle = document.createElement("i");
    const headingId = `plmge-criterion-heading-${index + 1}`;

    root.className = "plmge-criterion";
    root.setAttribute("role", "group");
    root.setAttribute("aria-labelledby", headingId);

    heading.type = "button";
    heading.id = headingId;
    heading.className = "plmge-criterion-heading";
    heading.setAttribute("aria-expanded", "true");

    nameElement.className = "plmge-criterion-name";
    nameElement.textContent = name;
    summary.className = "plmge-criterion-summary";
    toggle.className = "bi bi-chevron-up plmge-criterion-toggle";
    toggle.setAttribute("aria-hidden", "true");

    heading.append(nameElement, summary, toggle);
    root.append(heading);

    this.root = root;
    this.heading = heading;
    this.summary = summary;
  }

  addItem(item: RubricItem) {
    const originalId = item.row.id;
    const originalHidden = item.row.hidden;
    item.row.id ||= `${this.heading.id}-item-${this.items.length + 1}`;
    item.row.dataset.plmgeCriterion = this.heading.id;
    const originalText: [Text, string][] = [];
    const walker = document.createTreeWalker(
      item.description,
      NodeFilter.SHOW_TEXT,
    );
    let node: Node | null;
    while ((node = walker.nextNode()))
      originalText.push([node as Text, node.textContent ?? ""]);
    this.restorations.push(() => {
      item.row.id = originalId;
      item.row.hidden = originalHidden;
      delete item.row.dataset.plmgeCriterion;
      for (const [text, value] of originalText) text.data = value;
      item.row.classList.remove("plmge-item");
    });
    stripTextPrefix(item.description, item.prefixLength);
    item.row.classList.add("plmge-item");
    this.items.push(item);
    const rowIds = this.items.map((entry) => entry.row.id).join(" ");
    this.heading.setAttribute("aria-controls", rowIds);
    this.root.setAttribute("aria-owns", rowIds);
  }

  selectedItems() {
    return this.items.filter((item) => item.input.checked);
  }

  setExpanded(expanded: boolean) {
    this.heading.setAttribute("aria-expanded", String(expanded));
    this.expanded = expanded;
    for (const item of this.items) item.row.hidden = !expanded;
  }

  refresh() {
    const selected = this.selectedItems();
    const complete = selected.length === 1;
    const invalid = this.attempted && !complete;

    this.root.dataset.state = invalid
      ? "invalid"
      : complete
        ? "complete"
        : "incomplete";

    if (complete) {
      this.summary.replaceChildren(
        `${selected[0].shortLabel} `,
        Object.assign(document.createElement("span"), {
          className: "plmge-criterion-summary-score",
          textContent: selected[0].score.textContent.trim(),
        }),
      );
    } else if (selected.length > 1) {
      this.summary.textContent = "Choose one item";
    } else {
      this.summary.textContent = "Required";
    }
  }

  stop() {
    for (const restore of this.restorations.splice(0)) restore();
    this.root.remove();
  }
}
