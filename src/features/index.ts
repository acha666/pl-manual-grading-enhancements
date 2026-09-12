import { isGradeSubmission } from "../core/submission.js";
import { readSettings } from "../core/settings.js";
import {
  buildAttributionContract,
  buildViewContract,
  buildPanelLayoutContract,
} from "../core/feature-contracts.js";
import type { Contract } from "../core/contract.js";
import { FeatureRuntime } from "../core/runtime.js";
import type { SettingName } from "../core/settings.js";
import { RubricGroups } from "./rubric-groups.js";
import { ShortcutManager } from "./shortcuts.js";
import { FeedbackAttribution } from "./attribution.js";
import { PanelLayout } from "./panel-layout.js";
import { ViewOptions } from "./view-options.js";
import { LatestAnswerPreview } from "./latest-answer-preview.js";
import { ScoreColors } from "./score-colors.js";
import { CodePreview } from "./code-preview.js";

type Report = (name: string, error: unknown, critical: boolean) => void;

/** Composes independent features and owns only their cross-feature wiring. */
export function startFeatures(contract: Contract, report: Report) {
  const settings = readSettings();
  const runtime = new FeatureRuntime(report);
  let shortcuts: ShortcutManager | null = null;
  let attribution: FeedbackAttribution | null = null;
  let latestAnswerPreview: LatestAnswerPreview | null = null;
  let scoreColors: ScoreColors | null = null;
  let codePreview: CodePreview | null = null;

  const appendAttribution = () => {
    if (settings.appendGraderName)
      runtime.run(attribution, (feature) => feature.append());
  };

  const rubric = runtime.mount(
    "Grouped rubric",
    () =>
      new RubricGroups(
        contract,
        settings,
        () => {
          runtime.run(shortcuts, (feature) => feature.sync());
          runtime.run(scoreColors, (feature) => feature.sync());
        },
        appendAttribution,
      ),
    true,
  );

  if (rubric) {
    shortcuts = runtime.mount(
      "Rubric shortcuts",
      () =>
        new ShortcutManager(
          contract,
          () => rubric.visibleItems(),
          () => settings.collapseCompleted,
        ),
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

  const layout = runtime.mount(
    "Panel layout",
    () =>
      new PanelLayout(
        buildPanelLayoutContract(contract),
        () => settings.splitScrolling,
        (error) => report("Panel layout", error, false),
      ),
  );

  runtime.mount(
    "View options",
    () =>
      new ViewOptions(
        buildViewContract(contract),
        settings,
        handleSettingChanged,
        new Set<SettingName>([
          ...(!attribution ? ["appendGraderName" as const] : []),
          ...(!layout ? ["splitScrolling" as const] : []),
        ]),
        (error) => report("View options", error, false),
      ),
  );
  latestAnswerPreview = runtime.mount(
    "Latest answer preview",
    () => new LatestAnswerPreview(() => settings.latestAnswerPreview),
  );
  codePreview = runtime.mount(
    "C code previews",
    () =>
      new CodePreview(
        () => settings.codePreview,
        (error) => report("C code previews", error, false),
      ),
  );
  scoreColors = runtime.mount(
    "Score colors",
    () => new ScoreColors(() => settings.scoreColors),
  );

  function handleUngroupedSubmit(event: SubmitEvent) {
    if (isGradeSubmission(event)) appendAttribution();
  }

  function handleSettingChanged(name: SettingName) {
    if (name === "splitScrolling")
      runtime.run(layout, (feature) => feature.sync());
    if (name === "collapseCompleted")
      rubric?.setCollapseEnabled(settings.collapseCompleted);
    if (name === "latestAnswerPreview")
      runtime.run(latestAnswerPreview, (feature) => feature.sync());
    if (name === "scoreColors")
      runtime.run(scoreColors, (feature) => feature.sync());
    if (name === "codePreview")
      runtime.run(codePreview, (feature) => feature.sync());
  }

  return runtime;
}
