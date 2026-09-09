# PrairieLearn Manual Grading Enhancements

This course-specific PrairieLearn element adds small client-side enhancements to the manual-grading page. Its core feature groups rubric items into required criteria; optional settings provide panel layout, shortcut, and grader-attribution improvements.

## Installation

Download `pl-manual-grading-enhancements.zip` from a GitHub release and extract it into the course repository. It contains the ready-to-use `elements/pl-manual-grading-enhancements` directory. Add the element once near the end of each applicable `question.html`:

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

### Sticky grading panel

On desktop widths, the Grading card sticks near the top of the main content area and scrolls internally. Its maximum height follows the main content viewport. Top-level information, rubric settings, and student answers scroll with the page. Narrow screens retain the normal document layout.

### Collapse completed criteria

Completed criteria collapse after one item is selected. Their headings remain available for changes.

When enabled, digits `1` through `9`, followed by `0`, are assigned to visible grouped items in document order. Digit shortcuts already assigned to ungrouped items remain reserved.

### Append grader name to feedback

Enabled by default. Before a valid grade submission, the element appends this line to the feedback field:

```text
Graded by: Grader Name
```

The name is read from PrairieLearn's authenticated staff menu. A terminal `Graded by:` line is replaced rather than duplicated. Skip, navigation, and reassignment actions do not add attribution.

### Open latest answer preview

When enabled, opens the newest submitted answer's file preview and scrolls it
into view on manual-grading pages. Disabled by default.

### Color rubric scores

When enabled, score fractions in rubric items and selected criterion headings
are colored green for full credit, amber for partial credit, and red for no
credit. Disabled by default.

## Compatibility and failure behavior

The integration targets PrairieLearn's current manual-grading markup and Bootstrap dropdown support. It validates the activation marker, the main grading panel, the grading form, rubric inputs, and required controls before changing the page. It also reinitializes after PrairieLearn refreshes the grading panel in place, such as after rubric or AI-grading updates.

The grading form is resolved inside the main grading panel, so other manual-grading forms in conflict modals are ignored. If the core contract is invalid, available grade-submission buttons are disabled and a visible error is shown. Read-only pages without grade actions remain usable. Optional feature failures disable only the affected feature and show a warning; details are also written to the browser console.

The element makes no network requests and does not store sensitive information.

## Development

Use Node.js 20+, npm 9+, and Python 3.

```sh
npm ci
npm run verify    # Formatting, types, bundle behavior, and controller tests
npm run dev       # Watch and rebuild the element assets
npm run package   # Verify and stage an installable element in dist/
```

See the [development guide](docs/development.md) for module boundaries and feature
extension, and [deployment tests](docs/testing.md) for Docker testing and fixture
maintenance.

## Release

`package.json` is the single source of the runtime version. To release:

1. Update the version with `npm version patch` (or `minor` / `major`) after committing changes.
2. Push the commit and its version tag, for example `git push origin main --follow-tags`.
3. The tag workflow verifies that `vX.Y.Z` matches `package.json`, runs all local
   checks and the pinned Docker E2E, then publishes a GitHub release containing the installable ZIP.

For local installation without publishing, run `npm run package` and copy
`dist/elements/pl-manual-grading-enhancements` into the course repository. The
course needs only the packaged controller, metadata, JavaScript, and CSS; it does
not need Node.js or the TypeScript sources.

## Removal

Remove the element tag from the affected `question.html` files. The element directory can then be removed after no questions reference it.
