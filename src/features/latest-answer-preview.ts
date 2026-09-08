import { SELECTORS } from "../core/config.js";
import type { Lifecycle } from "../core/types.js";

/** Expands the newest submission's file preview and brings it into view once. */
export class LatestAnswerPreview implements Lifecycle {
  private timer: number | null = null;
  private enabled = false;
  private initializedBlock: HTMLElement | null = null;

  constructor(private isEnabled: () => boolean) {}

  start() {
    this.sync();
  }

  stop() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.initializedBlock?.removeAttribute(
      "data-plmge-latest-preview-initialized",
    );
    this.initializedBlock = null;
  }

  sync() {
    const enabled = this.isEnabled();
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled) this.expandLatestPreview();
    else this.stop();
  }

  private expandLatestPreview() {
    const blocks = [
      ...document.querySelectorAll<HTMLElement>(SELECTORS.submissionBlock),
    ];
    const latest = blocks
      .map((block) => ({ block, number: this.answerNumber(block) }))
      .filter(({ number }) => number !== null)
      .sort((a, b) => (b.number as number) - (a.number as number))[0]?.block;
    if (!latest || latest.dataset.plmgeLatestPreviewInitialized) return;

    const body = latest.querySelector<HTMLElement>(SELECTORS.submissionBody);
    const submissionToggle = latest.querySelector<HTMLButtonElement>(
      '[data-bs-toggle="collapse"][aria-controls="' + body?.id + '"]',
    );
    if (submissionToggle?.getAttribute("aria-expanded") !== "true") {
      submissionToggle?.click();
    }

    const previewToggle = latest.querySelector<HTMLButtonElement>(
      `${SELECTORS.filePreviewItem} button[data-bs-toggle="collapse"]`,
    );
    if (!previewToggle) return;

    latest.dataset.plmgeLatestPreviewInitialized = "true";
    this.initializedBlock = latest;
    if (previewToggle.getAttribute("aria-expanded") !== "true") {
      previewToggle.click();
    }

    this.timer = window.setTimeout(() => {
      this.timer = null;
      (
        previewToggle.closest<HTMLElement>(SELECTORS.filePreviewItem) ?? latest
      ).scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  private answerNumber(block: HTMLElement) {
    const match = block
      .querySelector("h2")
      ?.textContent?.match(/submitted answer\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }
}
