import type { Contract } from "../core/contract.js";
import type { RubricItem, Lifecycle } from "../core/types.js";
import type { RubricGroups } from "./rubric-groups.js";
import { DIGIT_KEYS } from "../core/config.js";
export class ShortcutManager implements Lifecycle {
  private shortcutMap = new Map<string, HTMLInputElement>();
  private started = false;
  constructor(
    private contract: Contract,
    private rubric: RubricGroups,
    private isEnabled: () => boolean,
  ) {
    this.handleKeypress = this.handleKeypress.bind(this);
  }

  start() {
    // Capture digit keys before PrairieLearn's document-level bubbling listener.
    // Its listener checks a live data-key-binding value for every item and can
    // otherwise activate several items while the mapping changes mid-keypress.
    this.sync();
  }

  stop() {
    if (this.started) {
      document.removeEventListener("keypress", this.handleKeypress, true);
      this.started = false;
    }
    this.restore();
  }

  sync() {
    if (!this.isEnabled()) {
      if (this.started) {
        document.removeEventListener("keypress", this.handleKeypress, true);
        this.started = false;
      }
      this.restore();
      return;
    }

    if (!this.started) {
      document.addEventListener("keypress", this.handleKeypress, true);
      this.started = true;
    }

    const reservedKeys = new Set(
      this.contract.items
        .filter(
          (item) =>
            !item.groupName &&
            item.originalKey !== null &&
            DIGIT_KEYS.includes(item.originalKey),
        )
        .map((item) => item.originalKey),
    );
    const availableKeys = DIGIT_KEYS.filter((key) => !reservedKeys.has(key));
    const visibleItems = this.rubric
      .visibleItems()
      .filter((item) => !item.input.matches(":disabled, [readonly]"));

    this.shortcutMap.clear();
    this.contract.groupedItems.forEach((item) => this.setShortcut(item, null));

    visibleItems.slice(0, availableKeys.length).forEach((item, index) => {
      const key = availableKeys[index];
      this.setShortcut(item, key);
      this.shortcutMap.set(key, item.input);
    });
  }

  private restore() {
    this.shortcutMap.clear();

    for (const item of this.contract.groupedItems) {
      if (item.originalKey) {
        item.input.dataset.keyBinding = item.originalKey;
        item.originalBadge!.hidden = false;
        item.originalBadge!.textContent = item.originalBadgeText;
      } else {
        item.input.removeAttribute("data-key-binding");
        item.generatedBadge?.remove();
        item.generatedBadge = null;
      }
    }
  }

  private setShortcut(item: RubricItem, key: string | null) {
    let badge = item.originalBadge ?? item.generatedBadge;

    if (!key) {
      item.input.removeAttribute("data-key-binding");
      if (badge) badge.hidden = true;
      return;
    }

    if (!badge) {
      badge = document.createElement("kbd");
      badge.className = "pl-kbd kbd-semi-transparent";
      badge.setAttribute("aria-hidden", "true");
      item.input.after(badge);
      item.generatedBadge = badge;
    }

    item.input.dataset.keyBinding = key;
    badge.textContent = key;
    badge.hidden = false;
  }

  private handleKeypress(event: KeyboardEvent) {
    if (!DIGIT_KEYS.includes(event.key)) return;

    if (
      event.target instanceof Element &&
      event.target.closest(".plmge-options-menu")
    ) {
      event.stopImmediatePropagation();
      return;
    }

    if (!this.isEnabled()) return;
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (
      !(event.target instanceof HTMLElement) ||
      event.target.isContentEditable
    )
      return;
    if (["TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (
      event.target instanceof HTMLInputElement &&
      !["radio", "button", "submit", "checkbox"].includes(event.target.type)
    ) {
      return;
    }
    if (document.querySelector(".modal.show")) return;

    const input = this.shortcutMap.get(event.key);
    if (!input || input.matches(":disabled, [readonly]")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    input.click();
  }
}
