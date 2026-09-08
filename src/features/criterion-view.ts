import type { RubricItem } from "../core/types.js";
import { stripTextPrefix, formatPoints } from "../core/dom.js";

/** Owns one criterion's markup and restores the upstream nodes on teardown. */
export class CriterionView {
  readonly root: HTMLElement;
  readonly heading: HTMLButtonElement;
  readonly summary: HTMLElement;
  readonly body: HTMLElement;
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

    this.root = root;
    this.heading = heading;
    this.summary = summary;
    this.body = body;
  }

  addItem(item: RubricItem) {
    // Preserve the original nodes and position for rollback and in-place refreshes.
    const position = document.createComment("plmge-item-position");
    item.row.before(position);
    const originalText: [Text, string][] = [];
    const walker = document.createTreeWalker(
      item.description,
      NodeFilter.SHOW_TEXT,
    );
    let node: Node | null;
    while ((node = walker.nextNode()))
      originalText.push([node as Text, node.textContent ?? ""]);
    this.restorations.push(() => {
      position.replaceWith(item.row);
      for (const [text, value] of originalText) text.data = value;
      item.row.classList.remove("plmge-item");
    });
    stripTextPrefix(item.description, item.prefixLength);
    item.row.classList.add("plmge-item");
    this.body.append(item.row);
    this.items.push(item);
  }

  selectedItems() {
    return this.items.filter((item) => item.input.checked);
  }

  setExpanded(expanded: boolean) {
    this.heading.setAttribute("aria-expanded", String(expanded));
    this.body.hidden = !expanded;
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
        `${selected[0].shortLabel} [`,
        Object.assign(document.createElement("span"), {
          className: "plmge-criterion-summary-score",
          textContent: formatPoints(selected[0].points),
        }),
        "]",
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
