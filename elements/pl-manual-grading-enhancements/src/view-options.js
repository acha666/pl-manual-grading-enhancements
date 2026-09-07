(() => {
  "use strict";

  const PLMGE = window.PLMGE;
  if (!PLMGE) throw new Error("Manual grading enhancement configuration was not loaded.");

  PLMGE.ViewOptions = class ViewOptions {
    constructor(
      contract,
      settings,
      onSettingChanged,
      disabledSettings = new Set(),
      onError = () => {},
    ) {
      this.contract = contract;
      this.settings = settings;
      this.onSettingChanged = onSettingChanged;
      this.disabledSettings = disabledSettings;
      this.onError = onError;
      this.resizeFrame = null;
      this.dropdown = null;
      this.menu = null;
      this.handleMenuChange = this.handleMenuChange.bind(this);
      this.handleResize = this.handleResize.bind(this);
    }

    start() {
      try {
        this.buildMenu();
        this.applySplitScrolling();
        window.addEventListener("resize", this.handleResize);
      } catch (error) {
        this.onError(error);
      }
    }

    buildMenu() {
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
      button.innerHTML = '<i class="bi bi-gear me-1" aria-hidden="true"></i>Options';

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

      menu.addEventListener("change", this.handleMenuChange);

      dropdown.append(button, menu);
      header.append(dropdown);
      header.classList.add("d-flex", "align-items-center", "gap-2");
      this.dropdown = dropdown;
      this.menu = menu;
    }

    handleMenuChange(event) {
      const input = event.target.closest("input[data-setting]");
      if (!input || input.disabled) return;

      try {
        const name = input.dataset.setting;
        this.settings[name] = input.checked;
        PLMGE.writeSettings(this.settings);
        if (name === "splitScrolling") this.applySplitScrolling();
        this.onSettingChanged(name);
      } catch (error) {
        this.onError(error);
      }
    }

    stop() {
      if (this.menu) this.menu.removeEventListener("change", this.handleMenuChange);
      this.dropdown?.remove();
      this.dropdown = null;
      this.menu = null;
      window.removeEventListener("resize", this.handleResize);
      if (this.resizeFrame !== null) {
        window.cancelAnimationFrame?.(this.resizeFrame);
        this.resizeFrame = null;
      }
    }

    createOption(name, labelText, helpText) {
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
      help.textContent = input.disabled ? `${helpText} Unavailable on this page.` : helpText;

      wrapper.append(input, label, help);
      return wrapper;
    }

    applySplitScrolling() {
      const { layoutRow, leftColumn, rightColumn } = this.contract;
      layoutRow.classList.add("plmge-layout");
      leftColumn.classList.add("plmge-scroll-pane");
      rightColumn.classList.add("plmge-scroll-pane");
      layoutRow.classList.toggle("plmge-split-scroll", this.settings.splitScrolling);

      if (this.settings.splitScrolling) {
        this.updatePaneHeight();
      } else {
        layoutRow.style.removeProperty("--plmge-pane-height");
      }
    }

    handleResize() {
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

    updatePaneHeight() {
      const top = Math.max(this.contract.layoutRow.getBoundingClientRect().top, 0);
      const height = Math.max(window.innerHeight - top - 8, 320);
      this.contract.layoutRow.style.setProperty("--plmge-pane-height", `${height}px`);
    }
  };
})();
