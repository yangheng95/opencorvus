from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("compose-live-type-v9.py")
SPEC = importlib.util.spec_from_file_location("compose_live_type_v9", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ComposeLiveTypeV9ContractTest(unittest.TestCase):
    def test_edit_plan_has_42_contiguous_scene_durations(self) -> None:
        plan = json.loads(MODULE.PLAN_PATH.read_text(encoding="utf-8"))
        self.assertEqual([scene["id"] for scene in plan["scenes"]], [f"S{index:02d}" for index in range(1, 43)])
        self.assertEqual(sum(float(scene["duration"]) for scene in plan["scenes"]), 276)
        for scene in plan["scenes"]:
            if scene.get("type") == "brand_card":
                continue
            selected = sum(float(segment[2]) for segment in scene["segments"])
            self.assertGreaterEqual(selected, float(scene["duration"]), scene["id"])

    def test_every_selected_h3_source_matches_its_generation_receipt(self) -> None:
        plan = json.loads(MODULE.PLAN_PATH.read_text(encoding="utf-8"))
        sources, receipts = MODULE.load_sources(plan)
        self.assertEqual(set(sources), set(plan["assets"]))
        self.assertEqual(set(receipts), set(plan["assets"]))
        self.assertTrue(all(len(receipt["sha256"]) == 64 for receipt in receipts.values()))

    def test_brand_assets_render_official_icon_and_wordmark(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "brand-card.png"
            opening = Path(temporary) / "opening-brand.png"
            MODULE.render_brand_card(destination, 1920, 1080)
            MODULE.render_opening_brand(opening, 1920, 1080)
            self.assertGreater(destination.stat().st_size, 25_000)
            self.assertGreater(opening.stat().st_size, 25_000)
            self.assertEqual(MODULE.WORDMARK_PATH.name, "official-logo-light-4x.png")
            self.assertEqual(MODULE.ICON_PATH.name, "web-app-manifest-512x512.png")

    def test_system_fact_and_mechanism_text_render_in_deep_blue(self) -> None:
        plan = json.loads(MODULE.PLAN_PATH.read_text(encoding="utf-8"))
        manifest = json.loads((MODULE.ROOT / plan["manifest"]).read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "overlays.ass"
            MODULE.write_ass(plan, manifest, destination)
            rendered = destination.read_text(encoding="utf-8-sig")
            self.assertIn("Style: Fact,Microsoft YaHei,34,&H008F2B17", rendered)
            self.assertIn("Style: Mechanism,Consolas,28,&H008F2B17", rendered)


if __name__ == "__main__":
    unittest.main()
