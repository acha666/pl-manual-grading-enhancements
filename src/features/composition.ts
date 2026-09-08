import { readSettings } from "../core/settings.js";
import {
  buildAttributionContract,
  buildViewContract,
} from "../core/feature-contracts.js";
import type { Contract } from "../core/contract.js";
import { FeatureRuntime } from "../core/runtime.js";
import type { SettingName } from "../core/types.js";
import { RubricGroups } from "./rubric-groups.js";
import { ShortcutManager } from "./shortcuts.js";
import { FeedbackAttribution } from "./attribution.js";
import { ViewOptions } from "./view-options.js";
import { LatestAnswerPreview } from "./latest-answer-preview.js";
import { ScoreColors } from "./score-colors.js";

type Report = (name: string, error: unknown, critical: boolean) => void;

/** Composes independent features and owns only their cross-feature wiring. */
export function composeFeatures(contract: Contract, report: Report) {
  const settings = readSettings();
  const runtime = new FeatureRuntime(report);
  let shortcuts: ShortcutManager | null = null;
  let attribution: FeedbackAttribution | null = null;
  let latestAnswerPreview: LatestAnswerPreview | null = null;
  let scoreColors: ScoreColors | null = null;

  const appendAttribution = () => {
    if (!settings.appendGraderName || !attribution) return;
    try {
      attribution.append();
    } catch (error) {
      attribution.stop();
      attribution = null;
      report("Grader attribution", error, false);
    }
  };

  const rubric = runtime.mount(
    "Grouped rubric",
    () =>
      new RubricGroups(
        contract,
        settings,
        () => {
          syncShortcuts();
          scoreColors?.sync();
        },
        appendAttribution,
      ),
    true,
  );

  if (rubric) {
    shortcuts = runtime.mount(
      "Rubric shortcuts",
      () =>
        new ShortcutManager(contract, rubric, () => settings.collapseCompleted),
    );
  }

  attribution = runtime.mount("Grader attribution", () => {
    const { feedback, graderName } = buildAttributionContract(contract);
    return new FeedbackAttribution(
      feedback,
      graderName,
      contract.form,
      rubric ? null : (event) => handleUngroupedSubmit(event),
    );
  });

  runtime.mount(
    "View options",
    () =>
      new ViewOptions(
        buildViewContract(contract),
        settings,
        handleSettingChanged,
        new Set<SettingName>(attribution ? [] : ["appendGraderName"]),
        (error) => report("View options", error, false),
      ),
  );
  latestAnswerPreview = runtime.mount(
    "Latest answer preview",
    () => new LatestAnswerPreview(() => settings.latestAnswerPreview),
  );
  scoreColors = runtime.mount(
    "Score colors",
    () => new ScoreColors(() => settings.scoreColors),
  );

  function syncShortcuts() {
    if (!shortcuts) return;
    try {
      shortcuts.sync();
    } catch (error) {
      shortcuts.stop();
      shortcuts = null;
      report("Rubric shortcuts", error, false);
    }
  }

  function handleUngroupedSubmit(event: SubmitEvent) {
    const action =
      (event.submitter as HTMLButtonElement | null)?.value ??
      "add_manual_grade";
    if (action.startsWith("add_manual_grade")) appendAttribution();
  }

  function handleSettingChanged(name: SettingName) {
    if (name === "collapseCompleted")
      rubric?.setCollapseEnabled(settings.collapseCompleted);
    if (name === "latestAnswerPreview") latestAnswerPreview?.sync();
    if (name === "scoreColors") scoreColors?.sync();
  }

  return runtime;
}
