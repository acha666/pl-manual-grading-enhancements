# PrairieLearn Manual Grading Enhancements

This course-specific PrairieLearn element adds small client-side enhancements to the manual-grading page. It groups rubric items into required criteria and provides options for panel layout, shortcuts, feedback attribution, and answer previews.

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

Enabled by default. On desktop widths, the right column containing Grading and Staff information sticks near the top of the main content area and scrolls internally. Student answers scroll with the page. Narrow screens retain the normal document layout.

### Collapse completed criteria

Enabled by default. Completed criteria collapse after one item is selected. Their headings remain available for changes; a criterion that you manually expand stays open while changing its selection.

Shortcut digits `1` through `9`, followed by `0`, are assigned to visible grouped items in document order.

### Append grader name to feedback

Enabled by default. Before a valid grade submission, the element adds or replaces a final attribution line in the feedback field:

```text
Graded by: Grader Name
```

The name is read from PrairieLearn's authenticated staff menu. Skip, navigation, and reassignment actions do not add attribution.

### Open latest answer preview

When enabled, opens the newest submitted answer's file preview and scrolls it
into view on manual-grading pages.

### Color rubric scores

Enabled by default. Score fractions in rubric items and selected criterion headings
are colored green for full credit, amber for partial credit, and red for no
credit.

### Highlight C code previews

Enable this option to add C syntax colors and line numbers
to submitted `.c` files in **Show preview**. Other file types are unchanged.

Works with both manually opened previews and **Open latest answer preview**.

## Compatibility

The element targets PrairieLearn's manual-grading markup and Bootstrap dropdowns.
It reinitializes when PrairieLearn refreshes the grading panel.

If required grading controls are missing or invalid, grade submission is disabled
and an error is shown. Read-only pages remain usable. Optional feature failures
show a warning and disable only the affected feature.

The element makes no network requests and does not store sensitive information.
Prism is bundled for C highlighting; its license is included in
`elements/pl-manual-grading-enhancements/THIRD_PARTY_NOTICES.txt`.

## Development and testing

See the [development guide](docs/development.md) for setup, module boundaries,
packaging, and releases, and the [deployment testing guide](docs/testing.md) for
Docker tests and fixture maintenance.

## Removal

Remove the element tag from the affected `question.html` files. The element directory can then be removed after no questions reference it.
