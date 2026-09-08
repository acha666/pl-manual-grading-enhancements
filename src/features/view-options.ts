import type { ViewContract } from "../core/feature-contracts.js";
import type { Lifecycle } from "../core/types.js";
import {
  type Settings,
  type SettingName,
  SETTING_DEFINITIONS,
  SETTING_NAMES,
  isSettingName,
  writeSettings,
} from "../core/settings.js";
export class ViewOptions implements Lifecycle {
  private dropdown: HTMLDivElement | null = null;
  private menu: HTMLDivElement | null = null;
  constructor(
    private contract: ViewContract,
    private settings: Settings,
    private onSettingChanged: (name: SettingName) => void,
    private disabledSettings = new Set<SettingName>(),
    private onError: (error: unknown) => void = () => {},
  ) {
    this.handleMenuChange = this.handleMenuChange.bind(this);
  }

  start() {
    this.buildMenu();
  }

  private buildMenu() {
    const header = this.contract.gradingHeader;
    const dropdown = document.createElement("div");
    const button = document.createElement("button");
    const menu = document.createElement("div");

    header.querySelector(":scope > .plmge-options")?.remove();
    dropdown.className = "dropdown ms-auto plmge-options";

    button.type = "button";
    button.className = "btn btn-sm btn-outline-dark dropdown-toggle";
    button.dataset.bsToggle = "dropdown";
    button.dataset.bsAutoClose = "outside";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Manual grading options");
    button.innerHTML =
      '<i class="bi bi-gear me-1" aria-hidden="true"></i>Options';

    menu.className = "dropdown-menu dropdown-menu-end p-3 plmge-options-menu";
    for (const name of SETTING_NAMES) {
      const { label, help } = SETTING_DEFINITIONS[name];
      menu.append(this.createOption(name, label, help));
    }

    this.dropdown = dropdown;
    this.menu = menu;
    menu.addEventListener("change", this.handleMenuChange);

    dropdown.append(button, menu);
    header.append(dropdown);
    header.classList.add("d-flex", "align-items-center", "gap-2");
  }

  private handleMenuChange(event: Event) {
    const input =
      event.target instanceof Element
        ? event.target.closest<HTMLInputElement>("input[data-setting]")
        : null;
    if (!input || input.disabled) return;

    const name = input.dataset.setting;
    if (!isSettingName(name)) return;
    this.settings[name] = input.checked;
    writeSettings(this.settings);
    try {
      this.onSettingChanged(name);
    } catch (error) {
      this.onError(error);
    }
  }

  stop() {
    if (this.menu)
      this.menu.removeEventListener("change", this.handleMenuChange);
    this.dropdown?.remove();
    this.dropdown = null;
    this.menu = null;
  }

  private createOption(name: SettingName, labelText: string, helpText: string) {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    const label = document.createElement("label");
    const help = document.createElement("div");
    const id = `plmge-option-${name}`;

    wrapper.className = "form-check";
    input.className = "form-check-input";
    input.type = "checkbox";
    input.id = id;
    input.checked = this.settings[name];
    input.disabled = this.disabledSettings.has(name);
    input.dataset.setting = name;

    label.className = "form-check-label fw-semibold";
    label.htmlFor = id;
    label.textContent = labelText;

    help.className = "small text-muted";
    help.textContent = input.disabled
      ? `${helpText} Unavailable on this page.`
      : helpText;

    wrapper.append(input, label, help);
    return wrapper;
  }
}
