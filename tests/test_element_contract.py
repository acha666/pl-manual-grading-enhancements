import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
ELEMENT = ROOT / "elements" / "pl-manual-grading-enhancements"


class ElementContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.metadata = json.loads((ELEMENT / "info.json").read_text(encoding="utf-8"))

    def test_element_declares_existing_controller(self):
        self.assertEqual(self.metadata["controller"], "controller.py")
        self.assertTrue((ELEMENT / self.metadata["controller"]).is_file())

    def test_all_shipping_assets_are_declared_and_nonempty(self):
        for dependency, suffix, expected in (
            ("elementScripts", ".js", ["dist/main.js"]),
            ("elementStyles", ".css", ["dist/styles.css"]),
        ):
            with self.subTest(dependency=dependency):
                declared = self.metadata["dependencies"][dependency]
                self.assertEqual(declared, expected)
                actual = {str(p.relative_to(ELEMENT)) for p in (ELEMENT / "dist").glob(f"*{suffix}")}
                self.assertEqual(actual, set(declared))
                for asset in declared:
                    self.assertGreater((ELEMENT / asset).stat().st_size, 0)

    def test_question_example_uses_the_canonical_element_name(self):
        example = (ROOT / "question.html.example").read_text(encoding="utf-8")
        self.assertIn("<pl-manual-grading-enhancements>", example)
        self.assertNotIn("pl-manual-rubric-groups", example)


if __name__ == "__main__":
    unittest.main()
