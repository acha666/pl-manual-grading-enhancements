import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTROLLER_PATH = ROOT / "elements" / "pl-manual-grading-enhancements" / "controller.py"
SPEC = importlib.util.spec_from_file_location("pl_manual_grading_enhancements_controller", CONTROLLER_PATH)
CONTROLLER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(CONTROLLER)


class ControllerTests(unittest.TestCase):
    def test_manual_question_panel_renders_hidden_marker(self):
        rendered = CONTROLLER.render("ignored", {"manual_grading": True, "panel": "question"})
        self.assertEqual(rendered, '<span data-pl-manual-grading-enhancements hidden></span>')

    def test_marker_is_not_rendered_for_student_question_panel(self):
        self.assertEqual(CONTROLLER.render("ignored", {"panel": "question"}), "")

    def test_marker_is_not_rendered_for_non_question_panels(self):
        for panel in ("submission", "answer", "manual_grading", None):
            with self.subTest(panel=panel):
                self.assertEqual(
                    CONTROLLER.render("ignored", {"manual_grading": True, "panel": panel}), ""
                )

    def test_ai_grading_takes_precedence_over_human_manual_grading(self):
        self.assertEqual(
            CONTROLLER.render(
                "ignored",
                {"manual_grading": True, "ai_grading": True, "panel": "question"},
            ),
            "",
        )

    def test_missing_or_false_manual_grading_is_safe(self):
        for data in ({}, {"manual_grading": False}, {"manual_grading": None}):
            with self.subTest(data=data):
                self.assertEqual(CONTROLLER.render("ignored", data), "")


if __name__ == "__main__":
    unittest.main()
