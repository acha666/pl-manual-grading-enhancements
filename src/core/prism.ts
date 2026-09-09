import type * as PrismType from "prismjs";

// esbuild resolves these static calls into the shipping browser bundle.
declare const require: (id: string) => unknown;

let prism: typeof PrismType | undefined;

/** Load only our bundled components, without auto-highlighting the host page. */
export function highlightC(code: HTMLElement) {
  const host = window as Window & { Prism?: Partial<typeof PrismType> };
  const previous = host.Prism;
  try {
    host.Prism = prism ?? { manual: true };
    if (!prism) {
      // Synchronous require keeps Prism's global-dependent components in order.
      prism = require("prismjs/components/prism-core.js") as typeof PrismType;
      require("prismjs/components/prism-clike.js");
      require("prismjs/components/prism-c.js");
      require("prismjs/plugins/line-numbers/prism-line-numbers.js");
      // HTML parsing normalizes literal CRLF; retain the submitted line endings.
      prism.hooks.add("before-insert", (env) => {
        env.highlightedCode = env.highlightedCode?.replace(/\r/g, "&#13;");
      });
    }
    const text = code.textContent ?? "";
    prism.highlightElement(code);
    // Prism normalizes NBSP to spaces. Restore original characters within tokens
    // so copying or disabling the preview never changes the submitted source.
    if (text.includes("\u00a0")) {
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const length = node.nodeValue?.length ?? 0;
        node.nodeValue = text.slice(offset, offset + length);
        offset += length;
      }
    }
  } finally {
    if (previous === undefined) delete host.Prism;
    else host.Prism = previous;
  }
}
