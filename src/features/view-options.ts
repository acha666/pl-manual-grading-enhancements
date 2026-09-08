import type { ViewContract } from "../core/contract.js";
import type { Settings, SettingName, Lifecycle } from "../core/types.js";
import { writeSettings } from "../core/settings.js";
export class ViewOptions implements Lifecycle {
  private resizeFrame: number | null = null;
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
    this.handleResize = this.handleResize.bind(this);
  }

  start() {
    this.buildMenu();
    this.applySplitScrolling();
    window.addEventListener("resize", this.handleResize);
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
    menu.append(
      this.createOption(
        "splitScrolling",
        "Independent panel scrolling",
        "Scroll the response and Grading panes separately on desktop.",
      ),
      this.createOption(
        "collapseCompleted",
        "Collapse completed criteria",
        "Collapse selected criteria and reassign digits to visible grouped items.",
      ),
      this.createOption(
        "appendGraderName",
        "Append grader name to feedback",
        "Add the authenticated grader name when a grade is submitted.",
      ),
    );

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

    try {
      const name = input.dataset.setting;
      if (
        name !== "splitScrolling" &&
        name !== "collapseCompleted" &&
        name !== "appendGraderName"
      )
        return;
      this.settings[name] = input.checked;
      writeSettings(this.settings);
      if (name === "splitScrolling") this.applySplitScrolling();
      this.onSettingChanged(name);
    } catch (error) {
      this.onError(error);
    }
  }

  stop() {
    if (this.menu)
      this.menu.removeEventListener("change", this.handleMenuChange);
    this.dropdown?.remove();
    const { layoutRow, leftColumn, rightColumn } = this.contract;
    layoutRow.classList.remove("plmge-layout", "plmge-split-scroll");
    layoutRow.style.removeProperty("--plmge-pane-height");
    leftColumn.classList.remove("plmge-scroll-pane");
    rightColumn.classList.remove("plmge-scroll-pane");
    this.dropdown = null;
    this.menu = null;
    window.removeEventListener("resize", this.handleResize);
    if (this.resizeFrame !== null) {
      window.cancelAnimationFrame?.(this.resizeFrame);
      this.resizeFrame = null;
    }
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

  private applySplitScrolling() {
    const { layoutRow, leftColumn, rightColumn } = this.contract;
    layoutRow.classList.add("plmge-layout");
    leftColumn.classList.add("plmge-scroll-pane");
    rightColumn.classList.add("plmge-scroll-pane");
    layoutRow.classList.toggle(
      "plmge-split-scroll",
      this.settings.splitScrolling,
    );

    if (this.settings.splitScrolling) {
      this.updatePaneHeight();
    } else {
      layoutRow.style.removeProperty("--plmge-pane-height");
    }
  }

  private handleResize() {
    if (!this.settings.splitScrolling || this.resizeFrame !== null) return;

    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = null;
      try {
        this.updatePaneHeight();
      } catch (error) {
        this.onError(error);
      }
    });
  }

  private updatePaneHeight() {
    const top = Math.max(
      this.contract.layoutRow.getBoundingClientRect().top,
      0,
    );
    const height = Math.max(window.innerHeight - top - 8, 320);
    this.contract.layoutRow.style.setProperty(
      "--plmge-pane-height",
      `${height}px`,
    );
  }
}
