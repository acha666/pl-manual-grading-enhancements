"""Render the activation marker for manual-grading enhancements."""


def render(element_html, data):
    """Activate the client integration once in the manual-grading question panel."""
    if not data.get("manual_grading") or data.get("ai_grading"):
        return ""

    if data.get("panel") != "question":
        return ""

    return '<span data-pl-manual-grading-enhancements hidden></span>'
