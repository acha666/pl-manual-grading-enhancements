import importlib.util
import itertools
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

    def test_activation_matrix(self):
        # Only human manual grading of the question panel may load the client.
        for manual, ai, panel in itertools.product(
            (False, True, None), (False, True, None),
            ("question", "submission", "answer", "manual_grading", None),
        ):
            with self.subTest(manual=manual, ai=ai, panel=panel):
                rendered = CONTROLLER.render("ignored", {
                    "manual_grading": manual, "ai_grading": ai, "panel": panel,
                })
                self.assertEqual(bool(rendered), bool(manual and not ai and panel == "question"))

    def test_missing_fields_do_not_activate(self):
        for data in ({}, {"panel": "question"}, {"manual_grading": True}):
            with self.subTest(data=data):
                self.assertEqual(CONTROLLER.render("ignored", data), "")


if __name__ == "__main__":
    unittest.main()
