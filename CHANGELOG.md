# Changelog

## Unreleased

- Added **Highlight C code previews**, disabled by default, with bundled Prism C syntax highlighting, a dark palette, and line numbers in native submitted-file previews. Disabling the option restores plain text.

- Fully expand the latest answer’s code preview after its file finishes loading.
- Keep Grading and Staff information together in the sticky, scrolling column so the cards do not overlap.

- Enabled all manual-grading options by default except **Open latest answer preview** and **Highlight C code previews**.

## 3.2.0

- Desktop grading supports a sticky, independently scrolling Grading card sized to the main content viewport. Rubric settings and student answers remain in the normal page flow.
- Fixed the sticky Grading card stacking order so it remains visible above response cards while scrolling.
- Fixed **Open latest answer preview** on current PrairieLearn pages by expanding the newest answer and its file preview when the answer heading has no number.
- Fixed **Collapse completed criteria** from re-collapsing a criterion after it was manually expanded.
- Fixed **Color rubric scores** so score fractions in selected criterion headings are colored too.

## 3.1.2

- Refactored manual-grading features into independently validated modules with isolated optional-feature failures and safer panel refresh cleanup.
- Expanded browser, settings, rubric, layout, shortcut, attribution, and answer-preview test coverage.
- Split development and deployment testing guidance into dedicated documents and included them in release packages.

## 3.1.1

- Fixed score coloring for the selected score shown in grouped criterion headings.

## 3.1.0

- Added an option to open and scroll to the newest submitted answer's file preview on manual-grading pages.
- Added an option to color rubric score fractions according to the credit awarded.

## 3.0.0

- Rebuilt the browser integration in TypeScript and bundled it into production JavaScript and CSS assets.
- Added a release packaging workflow that produces an installable course-element ZIP from a version tag.
- Added modular feature lifecycle management with isolated optional-feature failures and cleanup on reinitialization.
- Added Docker-based PrairieLearn deployment tests using a reproducible PostgreSQL grading fixture.
- Expanded browser coverage for panel refreshes, conflict-modal forms, settings, attribution, and persisted grading behavior.
- Updated the documentation and CI workflows for local verification, pinned deployment testing, and latest-upstream compatibility checks.

## 2.0.1

- Fixed the upstream compatibility workflow to use the published `setup-uv` v10.0.1 action reference.

## 2.0.0

- Repositioned the element as a PrairieLearn manual-grading enhancement bundle.
- Kept grouped rubric behavior enabled by default as the core feature.
- Split grouped rubric behavior into its own module and made view options, shortcuts, and attribution independently startable.
- Scoped the grading form contract to the main grading panel, including pages with conflict-modal forms.
- Added feature-level validation and failure isolation so optional modules do not stop one another.
- Standardized on the new element name and storage key so the package has one canonical integration path.
- Skip activation during PrairieLearn AI grading renders.
- Removed deployment-only HAR and manual test artifacts from the release tree.

## 1.1.0

- Split the browser integration into configuration, DOM contract, shortcut, attribution, view-option, and main modules.
- Added concise comments around DOM-preserving prefix removal, PrairieLearn shortcut interception, and terminal attribution replacement.
- Added the **Append grader name to feedback** option, enabled by default.
- Added authenticated grader-name and feedback-field checks to the fail-early DOM contract.
- Expanded deployment tests for attribution and persisted settings.

## 1.0.0

- Added grouped, mutually exclusive, required rubric criteria.
- Added independent panel scrolling.
- Added completed-criterion collapsing with safe numeric shortcut remapping.
- Added fail-early DOM validation and visible failure handling.
