from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path

import pytest

from opencorvus_inspect.benchmark.apodex import FRONTIER_SCIENCE_RESEARCH
from opencorvus_inspect.benchmark.dataset import BenchmarkDataError, load_benchmark_dataset


def test_dataset_manifest_selects_exact_ids_and_records_provenance(tmp_path: Path) -> None:
    dataset = tmp_path / "frontier-science.jsonl"
    rows = [
        {
            "task_id": "physics-1",
            "task_question": "Explain the measured effect.",
            "ground_truth": "Award 10 points for the complete derivation.",
            "subject": "physics",
            "private_annotation": "must not be projected",
        },
        {
            "task_id": "biology-1",
            "task_question": "Identify the causal mechanism.",
            "ground_truth": "Award 10 points for the supported mechanism.",
            "subject": "biology",
        },
    ]
    dataset_bytes = "".join(json.dumps(row) + "\n" for row in rows).encode()
    dataset.write_bytes(dataset_bytes)
    manifest = tmp_path / "hard-2.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "benchmark": FRONTIER_SCIENCE_RESEARCH.id,
                "sample_ids": ["biology-1", "physics-1"],
            }
        ),
        encoding="utf-8",
    )

    loaded = load_benchmark_dataset(
        FRONTIER_SCIENCE_RESEARCH,
        dataset,
        manifest=manifest,
    )

    assert [sample.id for sample in loaded.dataset] == ["biology-1", "physics-1"]
    assert loaded.dataset[0].input == "Identify the causal mechanism."
    assert loaded.dataset[0].target == "Award 10 points for the supported mechanism."
    assert loaded.dataset[0].metadata is not None
    assert loaded.dataset[0].metadata["subject"] == "biology"
    assert loaded.dataset[1].metadata == {
        "subject": "physics",
        "opencorvus_title": "FrontierScience Research — physics-1",
        "benchmark": FRONTIER_SCIENCE_RESEARCH.metadata(),
        "dataset": loaded.evidence.metadata(),
    }
    assert loaded.evidence.sha256 == hashlib.sha256(dataset_bytes).hexdigest()
    assert loaded.evidence.sample_count == 2
    assert loaded.evidence.manifest_sha256 == hashlib.sha256(manifest.read_bytes()).hexdigest()


def test_json_dataset_serializes_structured_target_deterministically(tmp_path: Path) -> None:
    dataset = tmp_path / "frontier-science.json"
    dataset.write_text(
        json.dumps(
            [
                {
                    "task_id": "structured-1",
                    "task_question": "Apply the rubric.",
                    "ground_truth": {"points": [2, 3], "criterion": "complete"},
                }
            ]
        ),
        encoding="utf-8",
    )

    loaded = load_benchmark_dataset(FRONTIER_SCIENCE_RESEARCH, dataset)

    assert loaded.dataset[0].target == '{"criterion":"complete","points":[2,3]}'


def test_empty_target_requires_explicit_schema_permission(tmp_path: Path) -> None:
    dataset = tmp_path / "frontier-science.jsonl"
    dataset.write_text(
        json.dumps(
            {
                "task_id": "empty-1",
                "task_question": "Apply the rubric.",
                "ground_truth": None,
            }
        )
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises(BenchmarkDataError, match="dataset_target_empty"):
        load_benchmark_dataset(FRONTIER_SCIENCE_RESEARCH, dataset)

    empty_allowed = replace(
        FRONTIER_SCIENCE_RESEARCH,
        id="custom/empty-target@1",
        dataset=replace(FRONTIER_SCIENCE_RESEARCH.dataset, allow_empty_target=True),
    )
    loaded = load_benchmark_dataset(empty_allowed, dataset)
    assert loaded.dataset[0].target == ""
