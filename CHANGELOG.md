# Changelog

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
