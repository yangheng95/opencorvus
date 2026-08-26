"""Validated JSON/JSONL loading and deterministic benchmark manifests."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

from inspect_ai.dataset import MemoryDataset, Sample

from .definition import BenchmarkDefinition, SourceFormat


class BenchmarkDataError(ValueError):
    """Typed invalid benchmark data or manifest contract."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


@dataclass(frozen=True)
class DatasetEvidence:
    """Exact local data and selection identity stored in the Inspect log."""

    sha256: str
    sample_count: int
    manifest_sha256: str | None

    def metadata(self) -> dict[str, object]:
        return {
            "sha256": self.sha256,
            "sample_count": self.sample_count,
            "manifest_sha256": self.manifest_sha256,
        }


@dataclass(frozen=True)
class LoadedBenchmarkDataset:
    dataset: MemoryDataset
    evidence: DatasetEvidence


@dataclass(frozen=True)
class _Manifest:
    benchmark: str
    sample_ids: tuple[str, ...]
    sha256: str


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _source_format(path: Path) -> SourceFormat:
    if path.suffix.lower() == ".jsonl":
        return "jsonl"
    if path.suffix.lower() == ".json":
        return "json"
    raise BenchmarkDataError(
        "unsupported_source_format",
        f"{path} must have a .json or .jsonl suffix",
    )


def _read_rows(path: Path, source_format: SourceFormat) -> tuple[list[dict[str, Any]], bytes]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise BenchmarkDataError("dataset_unreadable", f"cannot read {path}: {error}") from error

    rows: list[dict[str, Any]] = []
    try:
        if source_format == "json":
            value = json.loads(raw.decode("utf-8"))
            if not isinstance(value, list):
                raise BenchmarkDataError(
                    "dataset_shape_invalid", f"{path} must contain a top-level JSON list"
                )
            candidates = value
        else:
            candidates = [
                json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()
            ]
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BenchmarkDataError("dataset_json_invalid", f"cannot parse {path}: {error}") from error

    for index, candidate in enumerate(candidates, start=1):
        if not isinstance(candidate, dict):
            raise BenchmarkDataError(
                "dataset_row_invalid", f"row {index} in {path} must be a JSON object"
            )
        rows.append(candidate)
    return rows, raw


def _string_field(row: dict[str, Any], field: str, *, row_number: int) -> str:
    value = row.get(field)
    if not isinstance(value, str) or not value.strip():
        raise BenchmarkDataError(
            "dataset_field_invalid",
            f"row {row_number} field {field!r} must be a non-empty string",
        )
    return value.strip()


def _id_field(row: dict[str, Any], field: str, *, row_number: int) -> str:
    value = row.get(field)
    if not isinstance(value, (str, int)) or not str(value).strip():
        raise BenchmarkDataError(
            "dataset_id_invalid",
            f"row {row_number} field {field!r} must be a non-empty string or integer",
        )
    return str(value).strip()


def _target_field(
    row: dict[str, Any],
    field: str,
    *,
    row_number: int,
    allow_empty: bool,
) -> str:
    if field not in row:
        raise BenchmarkDataError(
            "dataset_target_missing", f"row {row_number} has no target field {field!r}"
        )
    value = row[field]
    if isinstance(value, str):
        target = value.strip()
        if target or allow_empty:
            return target
        raise BenchmarkDataError(
            "dataset_target_empty", f"row {row_number} field {field!r} must not be empty"
        )
    if value is None:
        if allow_empty:
            return ""
        raise BenchmarkDataError(
            "dataset_target_empty", f"row {row_number} field {field!r} must not be null"
        )
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except (TypeError, ValueError) as error:
        raise BenchmarkDataError(
            "dataset_target_invalid", f"row {row_number} field {field!r} is not JSON data"
        ) from error


def _load_manifest(path: Path, definition: BenchmarkDefinition) -> _Manifest:
    try:
        raw = path.read_bytes()
        value = json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BenchmarkDataError("manifest_unreadable", f"cannot read {path}: {error}") from error
    if not isinstance(value, dict) or value.get("schema_version") != 1:
        raise BenchmarkDataError("manifest_schema_invalid", "manifest schema_version must be 1")
    if value.get("benchmark") != definition.id:
        raise BenchmarkDataError(
            "manifest_benchmark_mismatch",
            f"manifest benchmark must be {definition.id!r}",
        )
    raw_ids = value.get("sample_ids")
    if not isinstance(raw_ids, list) or not raw_ids:
        raise BenchmarkDataError(
            "manifest_sample_ids_invalid", "manifest sample_ids must be a non-empty list"
        )
    sample_ids: list[str] = []
    seen: set[str] = set()
    for index, raw_id in enumerate(raw_ids, start=1):
        if not isinstance(raw_id, (str, int)) or not str(raw_id).strip():
            raise BenchmarkDataError(
                "manifest_sample_id_invalid", f"manifest sample ID {index} is invalid"
            )
        sample_id = str(raw_id).strip()
        if sample_id in seen:
            raise BenchmarkDataError(
                "manifest_sample_id_duplicate", f"manifest repeats sample ID {sample_id!r}"
            )
        seen.add(sample_id)
        sample_ids.append(sample_id)
    return _Manifest(definition.id, tuple(sample_ids), _sha256(raw))


def load_benchmark_dataset(
    definition: BenchmarkDefinition,
    source: str | Path,
    *,
    manifest: str | Path | None = None,
    judge_model: str | None = None,
) -> LoadedBenchmarkDataset:
    """Load one declared dataset and preserve an optional exact-ID order."""

    path = Path(source).resolve()
    source_format = _source_format(path)
    if source_format not in definition.dataset.source_formats:
        raise BenchmarkDataError(
            "source_format_not_declared",
            f"benchmark {definition.id!r} does not declare {source_format}",
        )
    rows, raw = _read_rows(path, source_format)

    samples_by_id: dict[str, Sample] = {}
    source_order: list[str] = []
    for row_number, row in enumerate(rows, start=1):
        sample_id = _id_field(row, definition.dataset.id_field, row_number=row_number)
        if sample_id in samples_by_id:
            raise BenchmarkDataError(
                "dataset_sample_id_duplicate", f"dataset repeats sample ID {sample_id!r}"
            )
        prompt = _string_field(row, definition.dataset.input_field, row_number=row_number)
        target = _target_field(
            row,
            definition.dataset.target_field,
            row_number=row_number,
            allow_empty=definition.dataset.allow_empty_target,
        )
        public_metadata = {
            field: row[field] for field in definition.dataset.metadata_fields if field in row
        }
        public_metadata.update(
            {
                "opencorvus_title": f"{definition.name} — {sample_id}",
                "benchmark": definition.metadata(judge_model=judge_model),
                "dataset": {"sha256": _sha256(raw)},
            }
        )
        samples_by_id[sample_id] = Sample(
            id=sample_id,
            input=prompt,
            target=target,
            metadata=public_metadata,
        )
        source_order.append(sample_id)

    selected_ids = tuple(source_order)
    manifest_sha256: str | None = None
    if manifest is not None:
        loaded_manifest = _load_manifest(Path(manifest).resolve(), definition)
        missing = [
            sample_id for sample_id in loaded_manifest.sample_ids if sample_id not in samples_by_id
        ]
        if missing:
            raise BenchmarkDataError(
                "manifest_sample_missing",
                f"dataset has no manifest sample IDs: {', '.join(missing)}",
            )
        selected_ids = loaded_manifest.sample_ids
        manifest_sha256 = loaded_manifest.sha256

    samples = [samples_by_id[sample_id] for sample_id in selected_ids]
    evidence = DatasetEvidence(
        sha256=_sha256(raw),
        sample_count=len(samples),
        manifest_sha256=manifest_sha256,
    )
    for sample in samples:
        metadata = cast(dict[str, Any], sample.metadata)
        metadata["dataset"] = evidence.metadata()
    return LoadedBenchmarkDataset(
        dataset=MemoryDataset(samples=samples, name=definition.id, location=str(path)),
        evidence=evidence,
    )
