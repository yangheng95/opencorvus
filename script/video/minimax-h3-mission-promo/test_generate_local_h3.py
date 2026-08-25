from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("generate-local-h3.py")
SPEC = importlib.util.spec_from_file_location("generate_local_h3", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class GenerateLocalH3ContractTest(unittest.TestCase):
    def test_canonical_digest_is_key_order_independent(self) -> None:
        self.assertEqual(MODULE.canonical_sha256({"b": 2, "a": 1}), MODULE.canonical_sha256({"a": 1, "b": 2}))

    def test_inspection_extracts_five_named_checkpoints(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            video = root / "sample.mp4"
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "testsrc2=size=160x96:rate=24:duration=2",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=440:sample_rate=32000:duration=2",
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-ac",
                    "2",
                    "-ar",
                    "32000",
                    "-shortest",
                    str(video),
                ],
                check=True,
            )
            result = MODULE.inspect_clip(video, root / "frames")
            self.assertEqual(
                [item["label"] for item in result["frames"]],
                ["start", "quarter", "middle", "three_quarter", "end"],
            )
            self.assertEqual(result["audio_channels"], 2)
            self.assertEqual(result["audio_sample_rate"], 32000)
            self.assertGreaterEqual(result["motion_checkpoint_count"], 2)
            self.assertTrue(result["passed"])

    def test_model_identities_bind_inventory_sha_and_physical_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            install = Path(temporary)
            requested = {
                "diffusion_models/model.safetensors": b"diffusion",
                "text_encoders/encoder.safetensors": b"encoder",
                "vae/video.safetensors": b"video",
                "vae/audio.safetensors": b"audio",
            }
            inventory = []
            for relative, payload in requested.items():
                path = install / "runtime" / "ComfyUI" / "models" / Path(relative)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(payload)
                inventory.append({"path": relative, "size": len(payload), "sha256": MODULE.sha256_file(path)})
            inventory_path = install / "installer" / "assets" / "hf_model_inventory.json"
            inventory_path.parent.mkdir(parents=True, exist_ok=True)
            inventory_path.write_text(json.dumps(inventory), encoding="utf-8")
            workflow = {
                "6": {"class_type": "UNETLoader", "inputs": {"unet_name": "model.safetensors"}},
                "13": {"class_type": "CLIPLoader", "inputs": {"clip_name": "encoder.safetensors"}},
                "11": {"class_type": "VAELoader", "inputs": {"vae_name": "video.safetensors"}},
                "24": {"class_type": "VAELoader", "inputs": {"vae_name": "audio.safetensors"}},
            }
            identities = MODULE.model_identities(install, workflow)
            self.assertEqual([item["role"] for item in identities], ["diffusion", "text_encoder", "video_vae", "audio_vae"])
            self.assertTrue(all(item["inventory_sha256"] == item["physical_sha256"] for item in identities))
            model = install / "runtime" / "ComfyUI" / "models" / "diffusion_models" / "model.safetensors"
            model.write_bytes(b"tampered!")
            with self.assertRaisesRegex(RuntimeError, "digest differs"):
                MODULE.model_identities(install, workflow)

    def test_v9_manifest_selects_a_prompt_locked_shot(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path = Path(temporary) / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "creative_direction": "live-type-runtime-v9",
                        "production_status": "prompt-locked",
                        "shots": [
                            {
                                "id": "S03",
                                "mode": "FL2VA",
                                "duration_seconds": 4,
                                "integrated_multimodal_description": "The context ring sheds its oldest constraint.",
                                "overall_soundscape": "Dry paper hiss.",
                                "non_diegetic_music": "Restrained pulse.",
                                "references": [],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            _, shot = MODULE.load_shot(manifest_path, "S03")
            self.assertEqual(shot["mode"], "FL2VA")
            self.assertEqual(shot["duration_seconds"], 4)

    def test_fl2va_workflow_binds_both_hash_locked_frames(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            workflow_path = Path(temporary) / "workflow.json"
            workflow_path.write_text(
                json.dumps(
                    {
                        "6": {"class_type": "UNETLoader", "inputs": {"unet_name": "old"}},
                        "13": {"class_type": "CLIPLoader", "inputs": {"clip_name": "old"}},
                        "9": {"class_type": "BasicScheduler", "inputs": {"steps": 1}},
                        "15": {"class_type": "RandomNoise", "inputs": {"noise_seed": 1}},
                        "92": {"class_type": "SaveVideo", "inputs": {"filename_prefix": "old"}},
                        "104": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {}},
                        "114": {"class_type": "LoadImage", "inputs": {"image": "old.png"}},
                    }
                ),
                encoding="utf-8",
            )
            workflow, frame_count = MODULE.prepare_workflow(
                workflow_path,
                mode="FL2VA",
                prompt="A finite context ring visibly sheds the oldest segment.",
                width=608,
                height=352,
                duration=4,
                steps=10,
                seed=42,
                output_stem="S03",
                reference_image_names=["start.png", "end.png"],
            )
            generation = workflow["104"]["inputs"]
            self.assertEqual(workflow["114"]["inputs"]["image"], "start.png")
            last_node_id = generation["last_frame"][0]
            self.assertEqual(workflow[last_node_id]["inputs"]["image"], "end.png")
            self.assertEqual(frame_count % 17, 5)


if __name__ == "__main__":
    unittest.main()
