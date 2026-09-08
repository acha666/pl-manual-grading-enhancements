import { SELECTORS } from "../core/config.js";
import type { Lifecycle } from "../core/types.js";

const SCORE_PATTERN = /\(\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\)/g;

/** Adds semantic Bootstrap color classes to rubric score fractions. */
export class ScoreColors implements Lifecycle {
  private enabled = false;

  constructor(private isEnabled: () => boolean) {}

  start() {
    this.sync();
  }

  stop() {
    document.querySelectorAll(".plmge-score").forEach((score) => {
      const parent = score.parentNode;
      if (!parent) return;
      parent.replaceChild(
        document.createTextNode(score.textContent ?? ""),
        score,
      );
      parent.normalize();
    });
  }

  sync() {
    const enabled = this.isEnabled();
    if (enabled === this.enabled && !enabled) return;
    this.enabled = enabled;
    if (enabled) {
      document
        .querySelectorAll<HTMLElement>(SELECTORS.description)
        .forEach((description) => this.colorScores(description));
      this.colorCriterionScores();
    } else {
      this.stop();
    }
  }

  private colorScores(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) textNodes.push(node as Text);

    for (const textNode of textNodes) {
      if (textNode.parentElement?.classList.contains("plmge-score")) continue;
      const text = textNode.nodeValue ?? "";
      SCORE_PATTERN.lastIndex = 0;
      if (!SCORE_PATTERN.test(text)) continue;
      SCORE_PATTERN.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let position = 0;
      for (const match of text.matchAll(SCORE_PATTERN)) {
        const start = match.index ?? 0;
        fragment.append(text.slice(position, start));
        const score = document.createElement("span");
        const numerator = Number(match[1]);
        const denominator = Number(match[2]);
        score.className = this.classFor(numerator, denominator);
        score.dataset.score = `${match[1]}/${match[2]}`;
        score.textContent = match[0];
        fragment.append(score);
        position = start + match[0].length;
      }
      fragment.append(text.slice(position));
      textNode.replaceWith(fragment);
    }
  }

  private colorCriterionScores() {
    document
      .querySelectorAll<HTMLElement>(".plmge-criterion")
      .forEach((root) => {
        const selected = root.querySelector<HTMLInputElement>(
          ".plmge-item input:checked",
        );
        const source = selected
          ?.closest(".plmge-item")
          ?.querySelector<HTMLElement>(".plmge-score");
        const target = root.querySelector<HTMLElement>(
          ".plmge-criterion-summary-score",
        );
        if (!target) return;
        target.className = source?.className ?? "plmge-criterion-summary-score";
        target.classList.add("plmge-criterion-summary-score");
      });
  }

  private classFor(numerator: number, denominator: number) {
    if (denominator > 0 && numerator >= denominator)
      return "plmge-score text-success";
    if (numerator <= 0) return "plmge-score text-danger";
    return "plmge-score text-warning";
  }
}
