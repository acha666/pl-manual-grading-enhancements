import { SELECTORS } from "../core/config.js";
import type { Lifecycle } from "../core/types.js";

/** Expands the newest submission and its file preview, then brings it into view once. */
export class LatestAnswerPreview implements Lifecycle {
  private frame: number | null = null;
  private cleanup: (() => void) | null = null;
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
    this.cleanup?.();
    this.cleanup = null;
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
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

    latest.dataset.plmgeLatestPreviewInitialized = "true";
    this.initializedBlock = latest;

    const openedToggles = new WeakSet<Element>();
    const cancelScroll = () => {
      if (this.frame !== null) window.cancelAnimationFrame(this.frame);
      this.frame = null;
    };
    const update = () => {
      cancelScroll();
      // A collapsed submission can render its body asynchronously. Always
      // resolve the preview inside this submission, never the question upload.
      const item = latest.querySelector<HTMLElement>(
        `${SELECTORS.submissionBody} ${SELECTORS.filePreviewItem}`,
      );
      const toggle = item?.querySelector<HTMLButtonElement>(
        'button[data-bs-toggle="collapse"]',
      );
      if (!item || !toggle) return;
      const preview = item.querySelector<HTMLElement>(".file-preview");
      if (
        !openedToggles.has(toggle) &&
        toggle.getAttribute("aria-expanded") !== "true" &&
        !preview?.classList.contains("collapsing")
      ) {
        openedToggles.add(toggle);
        toggle.click();
      }
      const expandButton = item.querySelector<HTMLButtonElement>(
        ".file-preview-expand:not(.d-none)",
      );
      const container = item.querySelector<HTMLElement>(
        ".file-preview-container",
      );
      if (expandButton && container && container.style.maxHeight !== "none") {
        expandButton.click();
      }
      // Native previews reveal content (including empty files), or an alert,
      // when fetch finishes. Expand is not shown for short files or failures.
      const ready =
        !preview ||
        !!item.querySelector(
          ".file-preview pre:not(.d-none), " +
            ".js-notebook-preview:not(.d-none), " +
            ".js-file-preview-pdf-container:not(.d-none), " +
            ".file-preview img:not(.d-none), " +
            ".js-info-alert:not(.d-none), .js-error-alert:not(.d-none)",
        );
      if (!ready || document.readyState !== "complete") return;
      if (latest.querySelector(".collapsing")) return;
      if (
        preview?.classList.contains("collapse") &&
        !preview.classList.contains("show")
      )
        return;
      if (
        body?.classList.contains("collapse") &&
        !body.classList.contains("show")
      )
        return;
      const img = preview?.querySelector<HTMLImageElement>("img:not(.d-none)");
      if (img && !img.complete) return;

      // Allow layout and code decoration to settle before computing the final
      // scroll destination. Mutations in between cancel and reschedule this.
      this.frame = window.requestAnimationFrame(() => {
        this.frame = window.requestAnimationFrame(() => {
          this.frame = null;
          this.previewObserver?.disconnect();
          this.previewObserver = null;
          this.cleanup?.();
          this.cleanup = null;
          if (item.isConnected) {
            item.scrollIntoView({ behavior: "instant", block: "start" });
          }
        });
      });
    };
    const onLoad = () => {
      update();
    };
    this.previewObserver = new MutationObserver(update);
    this.previewObserver.observe(latest, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "src"],
    });
    latest.addEventListener("shown.bs.collapse", update);
    latest.addEventListener("load", onLoad, true);
    latest.addEventListener("error", onLoad, true);
    window.addEventListener("load", update);
    this.cleanup = () => {
      latest.removeEventListener("shown.bs.collapse", update);
      latest.removeEventListener("load", onLoad, true);
      latest.removeEventListener("error", onLoad, true);
      window.removeEventListener("load", update);
    };
    update();
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
