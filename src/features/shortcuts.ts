import type { Contract } from "../core/contract.js";
import type { RubricItem, Lifecycle } from "../core/types.js";
import { DIGIT_KEYS } from "../core/config.js";
export class ShortcutManager implements Lifecycle {
  private generatedBadges = new Map<RubricItem, HTMLElement>();
  private shortcutMap = new Map<string, HTMLInputElement>();
  constructor(
    private contract: Contract,
    private getVisibleItems: () => readonly RubricItem[],
    private isEnabled: () => boolean,
  ) {
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  start() {
    // Own digit shortcuts before React changes selection without DOM change events.
    document.addEventListener("keydown", this.handleKeydown, true);
    this.sync();
  }

  stop() {
    document.removeEventListener("keydown", this.handleKeydown, true);
    this.restore();
  }

  sync() {
    if (!this.isEnabled()) {
      this.restore();
      for (const item of this.contract.items) {
        if (item.originalKey)
          this.shortcutMap.set(item.originalKey, item.input);
      }
      return;
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
    const visibleItems = this.getVisibleItems().filter(
      (item) => !item.input.matches(":disabled, [readonly]"),
    );

    this.shortcutMap.clear();
    for (const item of this.contract.items) {
      if (!item.groupName && item.originalKey)
        this.shortcutMap.set(item.originalKey, item.input);
    }
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
        this.generatedBadges.get(item)?.remove();
        this.generatedBadges.delete(item);
      }
    }
  }

  private setShortcut(item: RubricItem, key: string | null) {
    let badge = item.originalBadge ?? this.generatedBadges.get(item);

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
      this.generatedBadges.set(item, badge);
    }

    item.input.dataset.keyBinding = key;
    badge.textContent = key;
    badge.hidden = false;
  }

  private handleKeydown(event: KeyboardEvent) {
    if (!DIGIT_KEYS.includes(event.key)) return;

    if (
      event.target instanceof Element &&
      event.target.closest(".plmge-options-menu")
    ) {
      event.stopImmediatePropagation();
      return;
    }

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

    // Also consume unmapped digits: upstream still retains the original keys.
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = this.shortcutMap.get(event.key);
    if (input && !input.matches(":disabled, [readonly]")) input.click();
  }
}
