export const STORAGE_KEY = "pl.manualGradingEnhancements.settings.v1";

interface SettingDefinition {
  defaultValue: boolean;
  label: string;
  help: string;
}

export const SETTING_DEFINITIONS = {
  splitScrolling: {
    defaultValue: true,
    label: "Sticky grading panel",
    help: "Keep the Grading card in view with its own scrolling on desktop.",
  },
  collapseCompleted: {
    defaultValue: true,
    label: "Collapse completed criteria",
    help: "Collapse selected criteria and reassign digits to visible grouped items.",
  },
  appendGraderName: {
    defaultValue: true,
    label: "Append grader name to feedback",
    help: "Add the authenticated grader name when a grade is submitted.",
  },
  latestAnswerPreview: {
    defaultValue: false,
    label: "Open latest answer preview",
    help: "Expand and scroll to the newest submitted answer's file preview.",
  },
  scoreColors: {
    defaultValue: true,
    label: "Color rubric scores",
    help: "Color score fractions by the amount of credit awarded.",
  },
} satisfies Record<string, SettingDefinition>;

export type SettingName = keyof typeof SETTING_DEFINITIONS;
export type Settings = Record<SettingName, boolean>;
export const SETTING_NAMES = Object.keys(SETTING_DEFINITIONS) as SettingName[];
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(
  Object.fromEntries(
    SETTING_NAMES.map((name) => [name, SETTING_DEFINITIONS[name].defaultValue]),
  ) as Settings,
);

export function isSettingName(name: string | undefined): name is SettingName {
  return name !== undefined && Object.hasOwn(SETTING_DEFINITIONS, name);
}

export function readSettings(): Settings {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const stored: unknown = value ? JSON.parse(value) : null;
    const settings = { ...DEFAULT_SETTINGS };
    if (stored && typeof stored === "object") {
      for (const name of SETTING_NAMES) {
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
