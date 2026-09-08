export interface Settings {
  splitScrolling: boolean;
  collapseCompleted: boolean;
  appendGraderName: boolean;
}
export type SettingName = keyof Settings;

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
  generatedBadge: HTMLElement | null;
  shortLabel: string;
}
export interface Criterion {
  name: string;
  root: HTMLElement;
  heading: HTMLButtonElement;
  summary: HTMLElement;
  body: HTMLElement;
  items: RubricItem[];
  attempted: boolean;
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
