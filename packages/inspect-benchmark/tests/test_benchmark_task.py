from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from opencorvus_inspect.benchmark.apodex import BROWSECOMP
from opencorvus_inspect.benchmark.task import opencorvus_suite


def test_registered_suite_freezes_effective_environment_config(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("OPENCORVUS_INSPECT_MODEL", "provider/sut-model")
    monkeypatch.setenv("OPENCORVUS_INSPECT_PROMPT_PROFILE", "resolved-profile")
    dataset = tmp_path / "browsecomp.jsonl"
    dataset.write_text(
        json.dumps(
            {
                "task_id": "browse-1",
                "task_question": "Find the named item.",
                "ground_truth": "The item",
                "category": "Art",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    configured = opencorvus_suite(
        BROWSECOMP.id,
        str(dataset),
        base_url="http://localhost:7878",
        project_dir="D:/bench",
    )

    assert configured.model is None
    assert [sample.id for sample in configured.dataset] == ["browse-1"]
    assert configured.metadata is not None
    assert configured.metadata["adapter"] == "opencorvus-task-api"
    assert configured.metadata["benchmark"] == BROWSECOMP.metadata()
    assert configured.metadata["dataset"]["sample_count"] == 1
    assert configured.metadata["system"]["model"] == "provider/sut-model"
    assert configured.metadata["system"]["prompt_profile"] == "resolved-profile"
    assert configured.metadata["system"]["adapter_distribution"] == {
        "name": "opencorvus-inspect",
        "version": "0.2.0",
    }
    assert configured.metadata["system"]["project"]["isolation"] == "shared"
    assert configured.metadata["run"] == {"comparable_mode": False}
    assert configured.dataset[0].metadata is not None
    assert configured.dataset[0].metadata["system"] == configured.metadata["system"]


def test_explicit_same_transport_judge_override_records_component_matches(
    tmp_path: Path,
) -> None:
    dataset = tmp_path / "browsecomp.jsonl"
    dataset.write_text(
        json.dumps(
            {
                "task_id": "browse-override",
                "task_question": "Find the item.",
                "ground_truth": "The item",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    configured = opencorvus_suite(
        BROWSECOMP.id,
        str(dataset),
        judge_model="openai-api/judge/test-judge",
        base_url="http://localhost:7878",
        project_dir="D:/bench",
    )

    expected_judge = {
        "model": "openai-api/judge/test-judge",
        "official_model": "gpt-4.1-2025-04-14",
        "official_model_pin_match": False,
        "official_route_pin_match": True,
        "upstream_execution_policy_match": False,
        "official_protocol_match": False,
        "execution_policy_revision": "opencorvus-inspect/judge-no-retry-v1",
        "max_tokens": 16384,
        "reasoning_effort": None,
        "streaming": True,
        "transport": {
            "argument_keys": ("base_url", "stream"),
            "base_url_sha256": hashlib.sha256(b"https://api.openai.com/v1").hexdigest(),
        },
    }
    assert configured.metadata is not None
    assert configured.dataset[0].metadata is not None
    assert configured.metadata["benchmark"]["judge"] == expected_judge
    assert configured.dataset[0].metadata["benchmark"]["judge"] == expected_judge


def test_cross_transport_judge_override_requires_new_definition(tmp_path: Path) -> None:
    dataset = tmp_path / "browsecomp.jsonl"
    dataset.write_text(
        '{"task_id":"browse-1","task_question":"Find it.","ground_truth":"It"}\n',
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="register a new benchmark definition"):
        opencorvus_suite(
            BROWSECOMP.id,
            str(dataset),
            judge_model="google/gemini-judge",
            project_dir="D:/bench",
        )


def test_comparable_mode_freezes_system_config_and_sample_isolation(tmp_path: Path) -> None:
    dataset = tmp_path / "browsecomp.jsonl"
    dataset.write_text(
        '{"task_id":"browse-1","task_question":"Find it.","ground_truth":"It"}\n',
        encoding="utf-8",
    )
    manifest = tmp_path / "hard-1.json"
    manifest.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "benchmark": BROWSECOMP.id,
                "sample_ids": ["browse-1"],
            }
        ),
        encoding="utf-8",
    )

    configured = opencorvus_suite(
        BROWSECOMP.id,
        str(dataset),
        manifest=str(manifest),
        project_dir=str(tmp_path / "project-root"),
        model="provider/model",
        prompt_profile="benchmark-v1",
        product_pillar="work",
        project_isolation="sample_epoch",
        comparable=True,
    )

    assert configured.metadata is not None
    assert configured.metadata["run"] == {"comparable_mode": True}
    assert configured.metadata["system"]["model"] == "provider/model"
    assert configured.metadata["system"]["prompt_profile"] == "benchmark-v1"
    assert configured.metadata["system"]["product_pillar"] == "work"
    assert configured.metadata["system"]["project"] == {
        "root_sha256": configured.metadata["system"]["project"]["root_sha256"],
        "isolation": "sample_epoch",
        "init_git": True,
    }
