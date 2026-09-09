import type { PanelLayoutContract } from "../core/feature-contracts.js";
import type { Lifecycle } from "../core/types.js";

/** Keeps the sticky grading column within the main scroll container. */
export class PanelLayout implements Lifecycle {
  private observer: ResizeObserver | null = null;

  constructor(
    private contract: PanelLayoutContract,
    private isEnabled: () => boolean,
    private onError: (error: unknown) => void,
  ) {}

  start() {
    this.sync();
  }

  sync() {
    this.stop();
    if (!this.isEnabled()) return;
    const { rightColumn, scrollContainer } = this.contract;
    this.updateHeight();
    rightColumn.classList.add("plmge-sticky-grading");
    this.observer = new ResizeObserver(() => {
      try {
        this.updateHeight();
      } catch (error) {
        this.onError(error);
      }
    });
    this.observer.observe(scrollContainer);
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    this.contract.rightColumn.classList.remove("plmge-sticky-grading");
    this.contract.rightColumn.style.removeProperty("--plmge-card-height");
  }

  private updateHeight() {
    const { rightColumn, scrollContainer } = this.contract;
    rightColumn.style.setProperty(
      "--plmge-card-height",
      `${Math.max(0, scrollContainer.clientHeight - 16)}px`,
    );
  }
}
