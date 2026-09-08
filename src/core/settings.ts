import type { Settings } from "./types.js";
export const STORAGE_KEY = "pl.manualGradingEnhancements.settings.v1";
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  splitScrolling: false,
  collapseCompleted: false,
  appendGraderName: true,
});

export function readSettings(): Settings {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const stored: unknown = value ? JSON.parse(value) : null;
    const settings = { ...DEFAULT_SETTINGS };
    if (stored && typeof stored === "object") {
      for (const name of Object.keys(settings) as (keyof Settings)[]) {
        if (name in stored) {
          const candidate = (stored as Record<string, unknown>)[name];
          if (typeof candidate === "boolean") settings[name] = candidate;
        }
      }
    }
    return settings;
  } catch (error) {
    console.warn(
      "Manual grading enhancements: settings could not be read.",
      error,
    );
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn(
      "Manual grading enhancements: settings could not be saved.",
      error,
    );
  }
}
