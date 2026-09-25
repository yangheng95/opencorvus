"""Real Git identity contract for the four-arm benchmark controller."""

from __future__ import annotations

import subprocess
from pathlib import Path

import httpx
import pytest

from script.run_factorial_trials import (
    Block,
    Episode,
    SourceRevisionDriftError,
    current_source_revision,
    paired_early_stop,
    require_frozen_source,
    settle_owned_activity,
)


def test_preregistered_paired_early_stop_reports_scored_harm_and_unscored_arms() -> None:
    harm = {"1": {"results": {
        "TS": {"strict": 1.0, "partial": 1.0},
        "TE": {"strict": 0.0, "partial": 0.5},
        "MS": {"strict": 1.0, "partial": 1.0},
        "ME": {"strict": 0.0, "partial": 0.4},
    }}}
    assert paired_early_stop(harm) == {"kind": "paired_regression", "block": 1}
    incomplete = {"1": {"results": {
        **harm["1"]["results"], "ME": {"strict": None, "partial": None},
    }}}
    assert paired_early_stop(incomplete) == {"kind": "unscored", "block": 1, "arms": ["ME"]}


def test_preregistered_three_block_partial_regression_and_continue_receipts() -> None:
    row = {
        "TS": {"strict": 0.0, "partial": 0.6},
        "TE": {"strict": 0.0, "partial": 0.4},
        "MS": {"strict": 0.0, "partial": 0.6},
        "ME": {"strict": 0.0, "partial": 0.4},
    }
    assert paired_early_stop({"1": {"results": row}}) == {"kind": "continue", "block": 1}
    decision = paired_early_stop({str(index): {"results": row} for index in (1, 2, 3)})
    assert decision == {
        "kind": "three_block_regression",
        "block": 3,
        "partial_effects": {"TE": pytest.approx(-0.2), "ME": pytest.approx(-0.2)},
        "strict_gains": {"TE": 0.0, "ME": 0.0},
    }


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


@pytest.mark.asyncio
async def test_mission_cleanup_preserves_settled_outcomes_and_aborts_pending(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    episode = Episode(
        arm="MS",
        block=Block(1, "case", 1, ("TS", "TE", "MS", "ME")),
        directory=tmp_path / "block-01" / "MS",
        source=tmp_path,
        url="http://host.test",
    )
    directory = str(episode.directory / "projects" / "sample" / "epoch-1" / "attempt-1")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path == "/mission":
            return httpx.Response(200, json=[
                {"missionID": "accepted", "directory": directory, "outcome": {"kind": "accepted"}},
                {"missionID": "blocked", "directory": directory, "outcome": {"kind": "blocked"}},
                {"missionID": "pending", "directory": directory, "outcome": None},
            ])
        if request.method == "POST" and request.url.path == "/mission/pending/abort":
            return httpx.Response(200, json=True)
        if request.method == "GET" and request.url.path == "/global/tasks":
            return httpx.Response(200, json={"tasks": []})
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    client = httpx.AsyncClient
    monkeypatch.setattr(
        "script.run_factorial_trials.httpx.AsyncClient",
        lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs),
    )
    receipt = await settle_owned_activity(episode)
    assert receipt == {
        "owned_actions": [
            {"mission_id": "accepted", "state": "accepted"},
            {"mission_id": "blocked", "state": "blocked"},
            {
                "mission_id": "pending",
                "state": "abort_requested",
                "http_status": 200,
                "request_id": "trial:1:MS:cleanup",
            },
        ],
        "active_after_cleanup": [],
    }
