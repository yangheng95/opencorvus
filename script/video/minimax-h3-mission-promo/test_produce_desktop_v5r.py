from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
MODULE_PATH = HERE / "produce-desktop-v5r.py"
SPEC = importlib.util.spec_from_file_location("desktop_v5r", MODULE_PATH)
assert SPEC and SPEC.loader
V5R = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V5R)


class DesktopV5RTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.storyboard = json.loads(V5R.STORYBOARD.read_text(encoding="utf-8"))
        cls.english_storyboard = json.loads(V5R.EN_STORYBOARD.read_text(encoding="utf-8"))
        cls.assets = V5R.evidence()

    def test_locale_storyboards_share_one_timeline_and_renderer_contract(self) -> None:
        chinese = self.storyboard
        english = self.english_storyboard
        self.assertEqual(chinese["locale"], "zh-CN")
        self.assertEqual(english["locale"], "en-US")
        self.assertEqual(
            [(scene["id"], scene["mode"], scene["duration"]) for scene in chinese["scenes"]],
            [(scene["id"], scene["mode"], scene["duration"]) for scene in english["scenes"]],
        )
        self.assertEqual(sum(float(scene["duration"]) for scene in english["scenes"]), 251.0)
        self.assertTrue(all(scene["narration"].strip() for scene in english["scenes"]))
        self.assertNotEqual(
            V5R.build_inputs(chinese)["storyboard_sha256"],
            V5R.build_inputs(english)["storyboard_sha256"],
        )

    def test_storyboard_and_renderers_cover_the_frozen_twelve_scene_story(self) -> None:
        scenes = self.storyboard["scenes"]
        self.assertEqual(len(scenes), 12)
        self.assertEqual(sum(float(scene["duration"]) for scene in scenes), 251.0)
        self.assertEqual(set(scene["mode"] for scene in scenes), set(V5R.RENDERERS))
        for scene in scenes:
            image = V5R.RENDERERS[scene["mode"]](float(scene["duration"]) * 0.5, float(scene["duration"]), self.assets)
            self.assertEqual(image.size, (1280, 720), scene["id"])
            self.assertGreater(len(image.convert("RGB").getcolors(maxcolors=1280 * 720) or []), 24, scene["id"])

    def test_minimum_type_size_is_mobile_readable_after_1080p_scale(self) -> None:
        self.assertEqual(V5R.font(10).size, 18)
        self.assertEqual(V5R.font(22).size, 22)

    def test_cartoon_material_is_sha_gated_b_roll_not_a_replacement_storyboard(self) -> None:
        sources = V5R.accepted_cartoon_sources()
        self.assertEqual(list(sources), ["C01", "C02", "C03"])
        inputs = V5R.build_inputs(self.storyboard)
        self.assertEqual(set(inputs["cartoon_sources"]), set(sources))
        self.assertEqual([scene["id"] for scene in self.storyboard["scenes"]], [
            "R01-project", "R02-failure", "R03-fragmentation", "R04-mission-record", "R05-scheduler", "R06-recovery",
            "R07-artifact", "R08-review", "R09-evolution", "R10-open-ecosystem", "R11-proof", "R12-personal-cta",
        ])

    def test_subtitles_preserve_english_tokens_and_end_with_spoken_audio(self) -> None:
        wrapped = V5R.wrap_subtitle("Mission checkpoint physical attempt artifact_locator_ref")
        flattened = wrapped.replace(r"\N", " ")
        for token in ("Mission", "checkpoint", "physical", "attempt", "artifact_locator_ref"):
            self.assertIn(token, flattened)
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "subtitles.ass"
            V5R.subtitles(
                {"scenes": [{"id": "sample", "duration": 18, "narration": "Mission checkpoint physical attempt。"}]},
                [{"scene": "sample", "spoken_duration": 5.0}],
                destination,
            )
            dialogue = next(line for line in destination.read_text(encoding="utf-8-sig").splitlines() if line.startswith("Dialogue:"))
            self.assertIn(",0:00:05.", dialogue)
            self.assertIn("Mission", dialogue)

    def test_english_subtitle_sentence_boundaries_preserve_decimal_metrics(self) -> None:
        text = "Validation and test Macro F1 were 83.43 and 83.61. Raw was 8.07; Mission reached 34.00, up 25.93 points."
        sentences = V5R.split_sentences(text)
        self.assertEqual(len(sentences), 3)
        self.assertIn("83.43", sentences[0])
        self.assertIn("83.61", sentences[0])
        self.assertIn("8.07", sentences[1])
        self.assertIn("25.93", sentences[2])

    def test_subtitle_wrapping_keeps_ratios_and_punctuation_with_the_previous_line(self) -> None:
        wrapped = V5R.wrap_subtitle("AutomationBench 原始严格通过率 8.07%；按用户最新更新，已核验 100 / 600。", 28)
        self.assertIn("8.07%；", wrapped)
        self.assertIn("100/600", wrapped)
        for orphan in (r"\N；", r"\N，", r"\N。", r"\N/", r"/\N"):
            self.assertNotIn(orphan, wrapped)

    def test_opening_brand_overlay_contains_the_full_delivery_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            overlay = V5R.opening_brand_overlay(Path(temporary))
            with V5R.Image.open(overlay) as image:
                self.assertEqual(image.size, (560, 108))

    def test_hybrid_edit_preserves_v5r_scene_order_and_durations(self) -> None:
        raw = V5R.accepted_scene_files(V5R.DEFAULT_OUTPUT, self.storyboard)
        with tempfile.TemporaryDirectory() as temporary:
            hybrid = V5R.hybrid_scene_files(raw, self.storyboard, Path(temporary))
            self.assertEqual(len(hybrid), len(raw))
            hybrid_ids = {"R01-project", "R02-failure", "R07-artifact"}
            for index, scene in enumerate(self.storyboard["scenes"]):
                if scene["id"] in hybrid_ids:
                    self.assertAlmostEqual(V5R.media_duration(hybrid[index]), float(scene["duration"]), delta=0.08)
                else:
                    self.assertEqual(hybrid[index], raw[index])

    def test_sha_bound_acceptance_returns_current_candidates_in_story_order(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            digest, root, _, acceptance_path = V5R.gate_paths(output, self.storyboard)
            candidates = root / "candidates"
            candidates.mkdir(parents=True)
            accepted = []
            for index, scene in enumerate(self.storyboard["scenes"]):
                candidate = candidates / f"{index:02d}-{scene['id']}.mp4"
                candidate.write_bytes(f"candidate:{scene['id']}".encode())
                accepted.append({"scene": scene["id"], "candidate": str(candidate), "sha256": V5R.sha256_file(candidate)})
            acceptance_path.write_text(
                json.dumps({"build_digest": digest, "manual_reviewer": "test", "reason": "reviewed", "accepted": accepted}),
                encoding="utf-8",
            )
            self.assertEqual(V5R.accepted_scene_files(output, self.storyboard), [Path(item["candidate"]) for item in accepted])

    def test_event_soundtrack_is_a_real_stereo_wave(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            soundtrack = Path(temporary) / "sound.wav"
            V5R.build_sound(2.0, soundtrack)
            probe = json.loads(
                V5R.run(
                    ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(soundtrack)],
                    capture=True,
                ).stdout
            )
            stream = probe["streams"][0]
            self.assertEqual(stream["codec_name"], "pcm_s16le")
            self.assertEqual(int(stream["sample_rate"]), 48000)
            self.assertEqual(int(stream["channels"]), 2)
            self.assertAlmostEqual(float(probe["format"]["duration"]), 2.0, places=2)
            with wave.open(str(soundtrack), "rb") as source:
                samples = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2")
            self.assertGreater(float(np.sqrt(np.mean(samples.astype(np.float64) ** 2))), 40.0)

    def test_sound_cue_ledger_covers_every_scene_with_action_bound_foley(self) -> None:
        schedule = V5R.sound_cue_schedule()
        by_scene: dict[str, list[float]] = {}
        for scene, timestamp, _ in schedule:
            by_scene.setdefault(scene, []).append(timestamp)
        self.assertEqual(set(by_scene), {scene["id"] for scene in self.storyboard["scenes"]})
        self.assertEqual(len(schedule), 67)
        for scene in self.storyboard["scenes"]:
            timestamps = by_scene[scene["id"]]
            self.assertGreaterEqual(len(timestamps), 4, scene["id"])
        self.assertEqual(V5R.NARRATION_RATE, "+25%")

    def test_closing_frame_uses_a_fixed_full_canvas_brand_grid(self) -> None:
        frame = V5R.render_personal_cta(15.8, 16.0, self.assets)
        self.assertEqual(frame.size, (1280, 720))
        self.assertEqual(frame.mode, "RGB")
        self.assertGreater(len(frame.getcolors(maxcolors=1280 * 720) or []), 64)

    def test_automationbench_claim_revision_is_bound_to_the_build(self) -> None:
        claims = V5R.AUTOMATIONBENCH_CLAIMS
        self.assertEqual(claims["model"], "openai/gpt-5.6-luna")
        self.assertEqual(claims["raw_strict_percent"], 8.07)
        self.assertEqual(claims["mission_verified_cases"], 100)
        self.assertEqual(claims["public_target_cases"], 600)
        self.assertEqual(claims["mission_strict_percent"], 34.00)
        inputs = V5R.build_inputs(self.storyboard)
        self.assertEqual(inputs["automationbench_claims"], claims)
        frame = V5R.render_proof(32.8, 34.0, self.assets)
        self.assertEqual(frame.size, (1280, 720))


if __name__ == "__main__":
    unittest.main()
