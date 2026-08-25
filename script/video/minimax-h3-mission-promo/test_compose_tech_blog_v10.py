from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image


MODULE_PATH = Path(__file__).with_name("compose-tech-blog-v10.py")
SPEC = importlib.util.spec_from_file_location("compose_tech_blog_v10", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ComposeTechBlogV10ContractTest(unittest.TestCase):
    def test_manifest_defines_three_contiguous_h3_shots(self) -> None:
        manifest = json.loads(MODULE.MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["manifest_kind"], "h3-video-production")
        self.assertEqual([shot["id"] for shot in manifest["shots"]], ["T01", "T02", "T03"])
        self.assertEqual(sum(float(shot["duration_seconds"]) for shot in manifest["shots"]), 30)

    def test_selected_h3_sources_match_generation_receipts(self) -> None:
        verified = MODULE.verify_h3()
        self.assertEqual(set(verified), {"T01", "T02", "T03"})
        self.assertTrue(all(len(item["sha256"]) == 64 for item in verified.values()))

    def test_each_story_stage_renders_a_full_resolution_technical_layer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            stages = [(48, MODULE.draw_editor), (336, MODULE.draw_context), (672, MODULE.draw_failure)]
            for frame, renderer in stages:
                layer = Image.new("RGBA", (MODULE.WIDTH, MODULE.HEIGHT), (0, 0, 0, 0))
                renderer(frame, layer)
                destination = root / f"{frame}.png"
                layer.save(destination)
                rendered = Image.open(destination)
                self.assertEqual(rendered.size, (1920, 1080))
                self.assertIsNotNone(rendered.getbbox())


if __name__ == "__main__":
    unittest.main()
