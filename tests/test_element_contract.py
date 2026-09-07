import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
ELEMENT = ROOT / "elements" / "pl-manual-grading-enhancements"


class ElementContractTests(unittest.TestCase):
    def test_element_metadata_declares_controller_and_dependency_order(self):
        metadata = json.loads((ELEMENT / "info.json").read_text(encoding="utf-8"))
        self.assertEqual(metadata["controller"], "controller.py")
        self.assertEqual(
            metadata["dependencies"]["elementScripts"],
            [
                "src/config.js",
                "src/contract.js",
                "src/rubric-groups.js",
                "src/shortcuts.js",
                "src/attribution.js",
                "src/view-options.js",
                "src/main.js",
            ],
        )
        for relative_path in metadata["dependencies"]["elementScripts"] + metadata["dependencies"]["elementStyles"]:
            self.assertTrue((ELEMENT / relative_path).is_file(), relative_path)

    def test_element_has_no_unlisted_javascript_source(self):
        metadata = json.loads((ELEMENT / "info.json").read_text(encoding="utf-8"))
        declared = {pathlib.Path(item).name for item in metadata["dependencies"]["elementScripts"]}
        actual = {path.name for path in (ELEMENT / "src").glob("*.js")}
        self.assertEqual(actual, declared)

    def test_question_example_uses_the_canonical_element_name(self):
        example = (ROOT / "question.html.example").read_text(encoding="utf-8")
        self.assertIn("<pl-manual-grading-enhancements>", example)
        self.assertNotIn("pl-manual-rubric-groups", example)


if __name__ == "__main__":
    unittest.main()
