import { LONG_PREVIEW_LINES, SELECTORS } from "../core/config.js";
import { lineCount } from "../core/dom.js";
import type { Lifecycle } from "../core/types.js";

// Native previews reveal content (including empty files), or an alert, when
// fetch finishes. Expand is not shown for short files or failures.
const LOADED_PREVIEW =
  ".file-preview pre:not(.d-none), " +
  ".js-notebook-preview:not(.d-none), " +
  ".js-file-preview-pdf-container:not(.d-none), " +
  ".file-preview img:not(.d-none), " +
  ".js-info-alert:not(.d-none), .js-error-alert:not(.d-none)";

const isClosed = (element: HTMLElement | null | undefined) =>
  !!element?.classList.contains("collapse") &&
  !element.classList.contains("show");

/**
 * Expands the newest submission and brings it into view once. File answers
 * open the first preview short enough to read in full, falling back to the
 * first file when every text preview is long.
 */
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
    this.enabled = false;
    this.stopWatching();
    this.initializedBlock?.removeAttribute(
      "data-plmge-latest-preview-initialized",
    );
    this.initializedBlock = null;
  }

  private stopWatching() {
    this.previewObserver?.disconnect();
    this.previewObserver = null;
    this.cleanup?.();
    this.cleanup = null;
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
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
    const closedToggles = new WeakSet<Element>();
    const toggleOf = (item: HTMLElement) =>
      item.querySelector<HTMLButtonElement>(
        'button[data-bs-toggle="collapse"]',
      );
    const previewOf = (item: HTMLElement) =>
      item.querySelector<HTMLElement>(".file-preview");
    // Bootstrap ignores toggles during a transition, so click only when idle.
    const open = (item: HTMLElement) => {
      const toggle = toggleOf(item) as HTMLButtonElement;
      if (
        !openedToggles.has(toggle) &&
        toggle.getAttribute("aria-expanded") !== "true" &&
        !previewOf(item)?.classList.contains("collapsing")
      ) {
        openedToggles.add(toggle);
        toggle.click();
      }
    };
    // Restore only previews this feature opened and then skipped.
    const close = (item: HTMLElement) => {
      const toggle = toggleOf(item) as HTMLButtonElement;
      if (
        openedToggles.has(toggle) &&
        !closedToggles.has(toggle) &&
        toggle.getAttribute("aria-expanded") === "true" &&
        !previewOf(item)?.classList.contains("collapsing")
      ) {
        closedToggles.add(toggle);
        toggle.click();
      }
    };
    const status = (item: HTMLElement) => {
      if (previewOf(item) && !item.querySelector(LOADED_PREVIEW))
        return "loading";
      const text =
        item.querySelector(".file-preview pre:not(.d-none)")?.textContent ?? "";
      return lineCount(text) > LONG_PREVIEW_LINES ? "long" : "readable";
    };

    const cancelScroll = () => {
      if (this.frame !== null) window.cancelAnimationFrame(this.frame);
      this.frame = null;
    };
    const update = () => {
      cancelScroll();
      // A collapsed submission can render its body asynchronously. Always
      // resolve previews inside this submission, never the question upload.
      if (
        body &&
        (isClosed(body) ||
          body.classList.contains("render-pending") ||
          !body.firstElementChild)
      )
        return;
      const items = [
        ...latest.querySelectorAll<HTMLElement>(
          `${SELECTORS.submissionBody} ${SELECTORS.filePreviewItem}`,
        ),
      ].filter((item) => toggleOf(item));

      // Answers without files scroll to the submission itself.
      let target = latest;
      if (items.length) {
        // Load previews in order until one can be read in full.
        let readable: HTMLElement | undefined;
        for (const item of items) {
          open(item);
          const state = status(item);
          if (state === "loading") return;
          if (state === "readable") {
            readable = item;
            break;
          }
        }
        target = readable ?? items[0];
        for (const item of items) if (item !== target) close(item);

        if (readable) {
          const expandButton = readable.querySelector<HTMLButtonElement>(
            ".file-preview-expand:not(.d-none)",
          );
          const container = readable.querySelector<HTMLElement>(
            ".file-preview-container",
          );
          if (
            expandButton &&
            container &&
            container.style.maxHeight !== "none"
          ) {
            expandButton.click();
          }
        }
        if (isClosed(previewOf(target))) return;
        const img = target.querySelector<HTMLImageElement>(
          ".file-preview img:not(.d-none)",
        );
        if (img && !img.complete) return;
      }
      if (document.readyState !== "complete") return;
      if (latest.querySelector(".collapsing")) return;

      // Allow layout and code decoration to settle before computing the final
      // scroll destination. Mutations in between cancel and reschedule this.
      this.frame = window.requestAnimationFrame(() => {
        this.frame = window.requestAnimationFrame(() => {
          this.stopWatching();
          if (target.isConnected) {
            target.scrollIntoView({ behavior: "instant", block: "start" });
          }
        });
      });
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
    latest.addEventListener("load", update, true);
    latest.addEventListener("error", update, true);
    window.addEventListener("load", update);
    this.cleanup = () => {
      latest.removeEventListener("shown.bs.collapse", update);
      latest.removeEventListener("load", update, true);
      latest.removeEventListener("error", update, true);
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
