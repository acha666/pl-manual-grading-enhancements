export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualGradingEnhancementIntegrationError";
  }
}

export function requireExactlyOne<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
  description: string,
): T {
  const matches = [...root.querySelectorAll<T>(selector)];
  if (matches.length !== 1) {
    throw new IntegrationError(
      `Expected exactly one ${description}; found ${matches.length}. Selector: ${selector}`,
    );
  }
  return matches[0];
}

export function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new IntegrationError(message);
}

export function stripTextPrefix(element: HTMLElement, length: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = length;

  // Remove only text nodes so inline Markdown formatting in the description survives.
  while (remaining > 0) {
    const node = walker.nextNode() as Text | null;
    requireCondition(
      node,
      "The rubric description prefix could not be removed safely.",
    );
    const consumed = Math.min(remaining, node.data.length);
    node.data = node.data.slice(consumed);
    remaining -= consumed;
  }
}

export function formatPoints(points: number) {
  return `${points >= 0 ? "+" : ""}${points}`;
}
