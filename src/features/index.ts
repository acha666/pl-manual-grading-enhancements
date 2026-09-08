import { readSettings } from "../core/settings.js";
import {
  buildAttributionContract,
  buildViewContract,
} from "../core/contract.js";
import type { Contract } from "../core/contract.js";
import { FeatureRuntime } from "../core/runtime.js";
import type { SettingName } from "../core/types.js";
import { RubricGroups } from "./rubric-groups.js";
import { ShortcutManager } from "./shortcuts.js";
import { FeedbackAttribution } from "./attribution.js";
import { ViewOptions } from "./view-options.js";

/** Explicit composition keeps dependencies visible without a plugin framework. */
export function startFeatures(
  contract: Contract,
  report: (name: string, error: unknown, critical: boolean) => void,
) {
  const settings = readSettings();
  const runtime = new FeatureRuntime(report);
  let shortcuts: ShortcutManager | null = null;
  let attribution: FeedbackAttribution | null = null;
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
          if (!shortcuts) return;
          try {
            shortcuts.sync();
          } catch (error) {
            shortcuts.stop();
            shortcuts = null;
            report("Rubric shortcuts", error, false);
          }
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
      rubric
        ? null
        : (event) => {
            const action =
              (event.submitter as HTMLButtonElement | null)?.value ??
              "add_manual_grade";
            if (action.startsWith("add_manual_grade")) appendAttribution();
          },
    );
  });
  runtime.mount(
    "View options",
    () =>
      new ViewOptions(
        buildViewContract(contract),
        settings,
        (name) => {
          if (name === "collapseCompleted")
            rubric?.setCollapseEnabled(settings.collapseCompleted);
        },
        new Set<SettingName>(attribution ? [] : ["appendGraderName"]),
        (error) => report("View options", error, false),
      ),
  );
  return runtime;
}
