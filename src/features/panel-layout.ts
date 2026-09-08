import type { PanelLayoutContract } from "../core/feature-contracts.js";
import type { Lifecycle } from "../core/types.js";

/** Owns pane sizing and the resize listener for independent scrolling. */
export class PanelLayout implements Lifecycle {
  private resizeFrame: number | null = null;

  constructor(
    private contract: PanelLayoutContract,
    private isEnabled: () => boolean,
    private onError: (error: unknown) => void,
  ) {}

  start() {
    this.sync();
    window.addEventListener("resize", this.handleResize);
  }

  sync() {
    const { layoutRow, leftColumn, rightColumn } = this.contract;
    layoutRow.classList.add("plmge-layout");
    leftColumn.classList.add("plmge-scroll-pane");
    rightColumn.classList.add("plmge-scroll-pane");
    layoutRow.classList.toggle("plmge-split-scroll", this.isEnabled());
    if (this.isEnabled()) this.updatePaneHeight();
    else layoutRow.style.removeProperty("--plmge-pane-height");
  }

  stop() {
    window.removeEventListener("resize", this.handleResize);
    if (this.resizeFrame !== null) {
      window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }
    const { layoutRow, leftColumn, rightColumn } = this.contract;
    layoutRow.classList.remove("plmge-layout", "plmge-split-scroll");
    layoutRow.style.removeProperty("--plmge-pane-height");
    leftColumn.classList.remove("plmge-scroll-pane");
    rightColumn.classList.remove("plmge-scroll-pane");
  }

  private handleResize = () => {
    if (!this.isEnabled() || this.resizeFrame !== null) return;
    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = null;
      if (!this.isEnabled()) return;
      try {
        this.updatePaneHeight();
      } catch (error) {
        this.onError(error);
      }
    });
  };

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
