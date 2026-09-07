# PrairieLearn Manual Grading Enhancements

This course-specific PrairieLearn element adds small client-side enhancements to the manual-grading page. Its core feature groups rubric items into required criteria; optional settings provide panel layout, shortcut, and grader-attribution improvements.

## Installation

Copy `elements/pl-manual-grading-enhancements` into the course repository and add the element once near the end of each applicable `question.html`:

```html
<pl-manual-grading-enhancements></pl-manual-grading-enhancements>
```

The element renders a hidden marker only in the human manual-grading question panel. It renders nothing for students or AI grading.

## Group rubric items

Start a rubric item description with a bracketed criterion name:

```text
[Opening Documentation] Exceptional
[Opening Documentation] One item missing or incorrect
[Opening Documentation] Three or more items missing or incorrect

[Headers] Exceptional
[Headers] Unnecessary header included
[Headers] Required header missing
```

Each distinct prefix creates one criterion. The prefix is displayed as the criterion heading and removed from the item label. Items without a prefix remain unchanged.

Grouped criteria have these rules:

- Exactly one item must be selected in every criterion before a grade can be submitted.
- Selecting an item clears the other items in the same criterion.
- Rubric item IDs and PrairieLearn's rubric data model are unchanged.
- Validation is client-side workflow protection; it is not server-side validation.

## Options

The **Manual grading options** menu is available in the Grading card header. Settings are stored in local storage for the current browser profile.

### Independent panel scrolling

On desktop widths, the response and Grading panes scroll independently. Narrow screens retain the normal document layout.

### Collapse completed criteria

Completed criteria collapse after one item is selected. Their headings remain available for changes.

When enabled, digits `1` through `9`, followed by `0`, are assigned to visible grouped items in document order. Digit shortcuts already assigned to ungrouped items remain reserved.

### Append grader name to feedback

Enabled by default. Before a valid grade submission, the element appends this line to the feedback field:

```text
Graded by: Grader Name
```

The name is read from PrairieLearn's authenticated staff menu. A terminal `Graded by:` line is replaced rather than duplicated. Skip, navigation, and reassignment actions do not add attribution.

## Compatibility and failure behavior

The integration targets PrairieLearn's current manual-grading markup and Bootstrap dropdown support. It validates the activation marker, the main grading panel, the grading form, rubric inputs, and required controls before changing the page. It also reinitializes after PrairieLearn refreshes the grading panel in place, such as after rubric or AI-grading updates.

The grading form is resolved inside the main grading panel, so other manual-grading forms in conflict modals are ignored. If the core contract is invalid, available grade-submission buttons are disabled and a visible error is shown. Read-only pages without grade actions remain usable. Optional feature failures disable only the affected feature and show a warning; details are also written to the browser console.

The element makes no network requests and does not store sensitive information.

## Verification

Install the JavaScript test dependency and run the local checks from the repository root:

```sh
npm ci
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Run syntax and metadata checks with:

```sh
for file in elements/pl-manual-grading-enhancements/src/*.js; do node --check "$file"; done
python3 -m json.tool elements/pl-manual-grading-enhancements/info.json >/dev/null
python3 -m py_compile elements/pl-manual-grading-enhancements/controller.py
```

An optional real-server compatibility test runs against a prepared PrairieLearn checkout:

```sh
PRAIRIELEARN_SOURCE_DIR=/path/to/PrairieLearn npm run test:upstream:e2e
```

The checkout must have its dependencies, Chromium, and PrairieLearn support services ready. The test modifies the checkout's `testCourse`; use a disposable checkout.

## Removal

Remove the element tag from the affected `question.html` files. The element directory can then be removed after no questions reference it.
