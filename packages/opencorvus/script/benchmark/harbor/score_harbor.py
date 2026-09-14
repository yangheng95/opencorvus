#!/usr/bin/env python3
"""Invoke the private official scorer once and project its metrics to Harbor."""

from __future__ import annotations

import http.client
import hashlib
import json
import socket
import shutil
from pathlib import Path


class UnixHTTPConnection(http.client.HTTPConnection):
    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect("/run/automationbench/admin.sock")


def require_agent_settlement(
    disposition_path: Path, settlement_path: Path, revoked_path: Path
) -> dict[str, object]:
    if revoked_path.is_file():
        revoked = json.loads(revoked_path.read_text(encoding="utf-8"))
        raise RuntimeError(f"Agent settlement was revoked: {revoked.get('reason', 'unspecified')}")
    disposition_bytes = disposition_path.read_bytes()
    disposition = json.loads(disposition_bytes)
    settlement = json.loads(settlement_path.read_text(encoding="utf-8"))
    if disposition.get("status") != "runtime_settled" or settlement.get("status") != "agent_settled":
        raise RuntimeError(f"Agent execution is not score eligible: {disposition.get('status', 'missing')}")
    if settlement.get("runtime_disposition_sha256") != hashlib.sha256(disposition_bytes).hexdigest():
        raise RuntimeError("Agent settlement does not bind the sealed runtime disposition")
    return settlement


def main() -> None:
    connection = UnixHTTPConnection("localhost", timeout=120)
    connection.request(
        "POST",
        "/admin/score",
        body=b"{}",
        headers={
            "authorization": "Bearer harbor-official-verifier-v1",
            "content-type": "application/json",
        },
    )
    response = connection.getresponse()
    payload = json.loads(response.read())
    connection.close()
    if response.status != 200:
        raise SystemExit(f"official scorer failed with HTTP {response.status}")
    Path("/logs/verifier/official-score.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    shutil.copy2("/run/automationbench/private/events.jsonl", "/logs/verifier/automationbench-events.jsonl")
    shutil.copy2("/run/automationbench/private/final-world.json", "/logs/verifier/final-world.json")
    require_agent_settlement(
        Path("/logs/agent/attempt-disposition.json"),
        Path("/run/opencorvus-host/agent-settlement.json"),
        Path("/run/opencorvus-host/agent-settlement-revoked.json"),
    )
    Path("/logs/verifier/reward.json").write_text(
        json.dumps(
            {
                "reward": float(payload["task_completed_correctly"]),
                "task_completed_correctly": float(payload["task_completed_correctly"]),
                "partial_credit": float(payload["partial_credit"]),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
