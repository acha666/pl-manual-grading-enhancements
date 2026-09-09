import { SELECTORS } from "../core/config.js";
import type { Lifecycle } from "../core/types.js";

/** Expands the newest submission and its file preview, then brings it into view once. */
export class LatestAnswerPreview implements Lifecycle {
  private timer: number | null = null;
  private enabled = false;
  private initializedBlock: HTMLElement | null = null;
  private previewObserver: MutationObserver | null = null;

  constructor(private isEnabled: () => boolean) {}

  start() {
    this.sync();
  }

  stop() {
    this.previewObserver?.disconnect();
    this.previewObserver = null;
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
    const numberedBlocks = blocks
      .map((block) => ({ block, number: this.answerNumber(block) }))
      .filter(({ number }) => number !== null)
      .sort((a, b) => (b.number as number) - (a.number as number));
    // Current PrairieLearn pages (as captured in the HAR) omit the answer
    // number from the heading. The submission id is a useful fallback; when
    // it is unavailable, the last block is newest in the rendered list.
    const latest = numberedBlocks[0]?.block ?? blocks.at(-1);
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
    const previewItem = previewToggle.closest<HTMLElement>(
      SELECTORS.filePreviewItem,
    )!;
    const expandCode = () => {
      const expandButton = previewItem.querySelector<HTMLButtonElement>(
        ".file-preview-expand:not(.d-none)",
      );
      if (!expandButton) return;
      this.previewObserver?.disconnect();
      this.previewObserver = null;
      const container = previewItem.querySelector<HTMLElement>(
        ".file-preview-container",
      );
      if (container && container.style.maxHeight !== "none") {
        expandButton.click();
      }
    };
    // PrairieLearn reveals Expand only after the asynchronous file load.
    this.previewObserver = new MutationObserver(expandCode);
    this.previewObserver.observe(previewItem, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    expandCode();
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
    if (match) return Number(match[1]);

    const submissionId = block.querySelector<HTMLElement>(
      SELECTORS.submissionBody,
    )?.dataset.submissionId;
    const id = submissionId ?? block.id.match(/submission-(\d+)/)?.[1];
    return id ? Number(id) : null;
  }
}
