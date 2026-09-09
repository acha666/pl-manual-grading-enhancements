import type { PanelLayoutContract } from "../core/feature-contracts.js";
import type { Lifecycle } from "../core/types.js";

/** Keeps the sticky Grading card within the main scroll container. */
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
    const { gradingCard, scrollContainer } = this.contract;
    this.updateHeight();
    gradingCard.classList.add("plmge-sticky-grading");
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
    this.contract.gradingCard.classList.remove("plmge-sticky-grading");
    this.contract.gradingCard.style.removeProperty("--plmge-card-height");
  }

  private updateHeight() {
    const { gradingCard, scrollContainer } = this.contract;
    gradingCard.style.setProperty(
      "--plmge-card-height",
      `${Math.max(0, scrollContainer.clientHeight - 16)}px`,
    );
  }
}
