import { SELECTORS } from "../core/config.js";
import { highlightC } from "../core/prism.js";
import type { Lifecycle } from "../core/types.js";

interface Decoration {
  pre: HTMLElement;
  preClasses: string[];
  codeClasses: string[];
  tabindex: string | null;
  text: string;
}

/** Decorates native C file previews after PrairieLearn loads their text. */
export class CodePreview implements Lifecycle {
  private observers: MutationObserver[] = [];
  private decorations = new Map<HTMLElement, Decoration>();
  private enabled = false;

  constructor(
    private isEnabled: () => boolean,
    private onError: (error: unknown) => void,
  ) {}

  start() {
    this.sync();
  }

  sync() {
    if (this.isEnabled() === this.enabled) return;
    this.stop();
    if (!this.isEnabled()) return;
    this.enabled = true;
    try {
      document
        .querySelectorAll<HTMLElement>(SELECTORS.submissionBlock)
        .forEach((block) => {
          const observer = new MutationObserver(() => {
            observer.disconnect();
            try {
              this.highlight(block);
              observe();
            } catch (error) {
              this.stop();
              this.onError(error);
            }
          });
          const observe = () =>
            observer.observe(block, {
              childList: true,
              subtree: true,
              characterData: true,
              attributes: true,
              attributeFilter: ["class"],
            });
          this.observers.push(observer);
          this.highlight(block);
          observe();
        });
    } catch (error) {
      this.stop();
      this.onError(error);
    }
  }

  private highlight(block: HTMLElement) {
    block
      .querySelectorAll<HTMLElement>(SELECTORS.filePreviewItem)
      .forEach((item) => {
        if (!item.dataset.file?.endsWith(".c")) return;
        const code = item.querySelector<HTMLElement>(SELECTORS.filePreviewCode);
        const pre = code?.parentElement;
        if (!code || !pre || pre.classList.contains("d-none")) return;
        const text = code.textContent ?? "";
        if (!text) return;
        let decoration = this.decorations.get(code);
        if (
          decoration?.text === text &&
          code.querySelector(".line-numbers-rows")
        )
          return;
        if (!decoration) {
          decoration = {
            pre,
            preClasses: [
              "plmge-code-preview",
              "language-c",
              "line-numbers",
            ].filter((name) => !pre.classList.contains(name)),
            codeClasses: ["language-c"].filter(
              (name) => !code.classList.contains(name),
            ),
            tabindex: pre.getAttribute("tabindex"),
            text,
          };
          this.decorations.set(code, decoration);
        }
        pre.classList.add(...decoration.preClasses);
        code.classList.add(...decoration.codeClasses);
        // Keep the official gutter wide enough for files with four or more digits.
        const lines = (text.match(/\n(?!$)/g)?.length ?? 0) + 1;
        pre.style.setProperty(
          "--plmge-line-digits",
          String(Math.max(3, String(lines).length)),
        );
        highlightC(code);
        decoration.text = text;
      });
  }

  stop() {
    this.enabled = false;
    this.observers.splice(0).forEach((observer) => observer.disconnect());
    for (const [code, { pre, preClasses, codeClasses, tabindex }] of this
      .decorations) {
      code.textContent = code.textContent;
      code.classList.remove(...codeClasses);
      pre.classList.remove(...preClasses);
      pre.style.removeProperty("--plmge-line-digits");
      if (tabindex === null) pre.removeAttribute("tabindex");
      else pre.setAttribute("tabindex", tabindex);
    }
    this.decorations.clear();
  }
}
