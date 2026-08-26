from __future__ import annotations

import json
from pathlib import Path

from opencorvus_inspect.task import opencorvus_benchmark


def test_task_loads_jsonl_dataset_with_model_free_solver(tmp_path: Path) -> None:
    dataset = tmp_path / "cases.jsonl"
    dataset.write_text(
        json.dumps({"id": "sample-1", "input": "solve", "target": "answer"}) + "\n",
        encoding="utf-8",
    )
    configured = opencorvus_benchmark(
        str(dataset),
        scorer="includes",
        base_url="http://localhost:7878",
        project_dir="D:/bench",
    )

    assert len(configured.dataset) == 1
    assert configured.dataset[0].id == "sample-1"
    assert configured.model is None
    assert configured.metadata == {
        "adapter": "opencorvus-task-api",
        "adapter_schema_version": 1,
    }
