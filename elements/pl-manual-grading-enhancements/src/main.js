(() => {
  "use strict";

  const PLMGE = window.PLMGE;
  if (!PLMGE) throw new Error("Manual grading enhancement configuration was not loaded.");

  function disableGradeSubmission(contract) {
    contract?.gradeButtons.forEach((button) => {
      button.disabled = true;
      button.title = "Manual grading enhancements failed to initialize.";
    });
  }

  function showMessage(panel, message, critical) {
    let container = panel.querySelector(".plmge-feature-messages");
    if (!container) {
      container = document.createElement("div");
      container.className = "plmge-feature-messages";
      panel.prepend(container);
    }

    const alert = document.createElement("div");
    alert.className = `alert ${critical ? "alert-danger" : "alert-warning"} m-3`;
    alert.setAttribute("role", "alert");
    alert.textContent = message;
    container.append(alert);
  }

  function reportFailure(panel, feature, error, critical = false) {
    console.error(`Manual grading enhancement failed: ${feature}.`, error);
    showMessage(
      panel,
      critical
        ? `${feature} failed to initialize. Grade submission has been disabled. Open the browser console for details.`
        : `${feature} is unavailable on this page. Other manual grading enhancements remain active.`,
      critical,
    );
  }

  function startEnhancements(contract) {
    const settings = PLMGE.readSettings();
    let rubric = null;
    let shortcuts = null;
    let attribution = null;
    let attributionAvailable = true;
    let viewOptions = null;
    let attributionSubmitHandler = null;

    const stopShortcuts = () => {
      if (!shortcuts) return;
      try {
        shortcuts.stop();
      } catch (error) {
        console.error("Manual grading enhancement cleanup failed: rubric shortcuts.", error);
      }
    };

    const failShortcuts = (error) => {
      stopShortcuts();
      shortcuts = null;
      reportFailure(contract.gradingPanel, "Rubric shortcuts", error);
    };

    const syncShortcuts = () => {
      if (!shortcuts) return;
      try {
        shortcuts.sync();
      } catch (error) {
        failShortcuts(error);
      }
    };

    try {
      const candidate = new PLMGE.RubricGroups(
        contract,
        settings,
        syncShortcuts,
        () => {
          if (!attribution || !settings.appendGraderName) return;
          try {
            attribution.append();
          } catch (error) {
            attribution = null;
            reportFailure(contract.gradingPanel, "Grader attribution", error);
          }
        },
      );
      if (candidate.start()) rubric = candidate;
    } catch (error) {
      rubric?.stop();
      rubric = null;
      disableGradeSubmission(contract);
      reportFailure(contract.gradingPanel, "Grouped rubric", error, true);
    }

    if (rubric) {
      try {
        shortcuts = new PLMGE.ShortcutManager(
          contract,
          rubric,
          () => settings.collapseCompleted,
        );
        shortcuts.start();
      } catch (error) {
        failShortcuts(error);
      }
    }

    let viewContract;
    try {
      viewContract = PLMGE.buildViewContract(contract);
    } catch (error) {
      reportFailure(contract.gradingPanel, "View options", error);
    }

    try {
      const attributionContract = PLMGE.buildAttributionContract(contract);
      attribution = new PLMGE.FeedbackAttribution(
        attributionContract.feedback,
        attributionContract.graderName,
      );
    } catch (error) {
      attributionAvailable = false;
      reportFailure(contract.gradingPanel, "Grader attribution", error);
    }

    if (!rubric && attribution) {
      attributionSubmitHandler = (event) => {
        const action = event.submitter?.value ?? "add_manual_grade";
        if (!action.startsWith("add_manual_grade") || !settings.appendGraderName) return;
        try {
          attribution.append();
        } catch (error) {
          attribution = null;
          reportFailure(contract.gradingPanel, "Grader attribution", error);
        }
      };
      contract.form.addEventListener("submit", attributionSubmitHandler, true);
    }

    if (viewContract) {
      try {
        const disabledSettings = attributionAvailable ? new Set() : new Set(["appendGraderName"]);
        viewOptions = new PLMGE.ViewOptions(
          viewContract,
          settings,
          (name) => {
            if (name === "collapseCompleted" && rubric) {
              rubric.setCollapseEnabled(settings.collapseCompleted);
            }
          },
          disabledSettings,
          (error) => reportFailure(contract.gradingPanel, "View options", error),
        );
        viewOptions.start();
      } catch (error) {
        reportFailure(contract.gradingPanel, "View options", error);
      }
    }

    return () => {
      if (attributionSubmitHandler) {
        contract.form.removeEventListener("submit", attributionSubmitHandler, true);
      }
      viewOptions?.stop();
      shortcuts?.stop();
      rubric?.stop();
    };
  }

  function reportPageFailure(error) {
    console.error("Manual grading enhancements failed to initialize.", error);
    document.documentElement.dataset.plManualGradingEnhancements = "failed";

    const panel = document.querySelector(PLMGE.SELECTORS.gradingPanel);
    const form = panel?.querySelector(PLMGE.SELECTORS.form);
    if (!panel || !form) return;

    const contract = {
      gradeButtons: [...form.querySelectorAll(PLMGE.SELECTORS.gradeAction)],
    };
    disableGradeSubmission(contract);
    showMessage(
      panel,
      "Manual grading enhancements failed to initialize. Grade submission has been disabled. Open the browser console for details.",
      true,
    );
  }

  function initialize(force = false) {
    if (document.documentElement.dataset.plManualGradingEnhancements && !force) return;

    const previous = PLMGE.activeRuntime;
    previous?.stop();
    PLMGE.activeRuntime = null;

    try {
      const contract = PLMGE.buildContract();
      PLMGE.activeRuntime = { stop: startEnhancements(contract) };
      document.documentElement.dataset.plManualGradingEnhancements = PLMGE.VERSION;
      console.info(`Manual grading enhancements ${PLMGE.VERSION} initialized.`);
    } catch (error) {
      reportPageFailure(error);
    }
  }

  function boot() {
    if (document.querySelectorAll(PLMGE.SELECTORS.marker).length === 0) return;
    initialize(false);

    const panel = document.querySelector(PLMGE.SELECTORS.gradingPanel);
    if (!panel || PLMGE.panelObserver) return;

    PLMGE.panelObserver = new MutationObserver(() => {
      if (PLMGE.initializing) return;
      PLMGE.initializing = true;
      PLMGE.panelObserver.disconnect();
      try {
        initialize(true);
      } finally {
        PLMGE.initializing = false;
        PLMGE.panelObserver.observe(panel, { childList: true });
      }
    });
    PLMGE.panelObserver.observe(panel, { childList: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
