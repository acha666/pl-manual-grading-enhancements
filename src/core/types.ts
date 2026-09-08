export interface RubricItem {
  input: HTMLInputElement;
  label: HTMLLabelElement;
  row: HTMLElement;
  description: HTMLElement;
  points: number;
  groupName: string | null;
  prefixLength: number;
  originalKey: string | null;
  originalBadge: HTMLElement | null;
  originalBadgeText: string | null;
  shortLabel: string;
}
export interface Lifecycle {
  start(): void | boolean;
  stop(): void;
}

declare global {
  interface Window {
    bootstrap?: { Dropdown?: unknown };
  }
  const __VERSION__: string;
}
