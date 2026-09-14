#!/usr/bin/env python3
"""Invoke the private official scorer once and project its metrics to Harbor."""

from __future__ import annotations

import http.client
import json
import socket
import shutil
from pathlib import Path


class UnixHTTPConnection(http.client.HTTPConnection):
    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect("/run/automationbench/admin.sock")


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
shutil.copy2("/run/automationbench/private/events.jsonl", "/logs/verifier/automationbench-events.jsonl")
shutil.copy2("/run/automationbench/private/final-world.json", "/logs/verifier/final-world.json")
