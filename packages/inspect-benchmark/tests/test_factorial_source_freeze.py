"""Real Git identity contract for the four-arm benchmark controller."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from script.run_factorial_trials import (
    SourceRevisionDriftError,
    current_source_revision,
    require_frozen_source,
)


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True, text=True)


def test_frozen_source_tracks_real_commit_and_working_source(tmp_path: Path) -> None:
    git(tmp_path, "init")
    git(tmp_path, "config", "user.name", "Benchmark Test")
    git(tmp_path, "config", "user.email", "benchmark@example.test")
    source = tmp_path / "source.txt"
    source.write_text("first\n", encoding="utf-8")
    git(tmp_path, "add", "source.txt")
    git(tmp_path, "commit", "-m", "First source")

    frozen = current_source_revision(tmp_path)
    require_frozen_source(frozen, tmp_path, ("source.txt",))

    source.write_text("second\n", encoding="utf-8")
    with pytest.raises(SourceRevisionDriftError, match="uncommitted changes"):
        require_frozen_source(frozen, tmp_path, ("source.txt",))

    git(tmp_path, "add", "source.txt")
    git(tmp_path, "commit", "-m", "Second source")
    with pytest.raises(SourceRevisionDriftError, match="revision changed"):
        require_frozen_source(frozen, tmp_path, ("source.txt",))
