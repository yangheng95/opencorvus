"""Read-only experiment evidence; canonical API messages, never Provider request bodies."""

from __future__ import annotations

import argparse
import collections
import json
import sqlite3
import time
from pathlib import Path

import httpx

parser = argparse.ArgumentParser()
parser.add_argument("--host", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
host = json.loads(args.host.read_text(encoding="utf-8"))
database = Path(host["runtimeRoot"]) / "data/opencorvus.db"
connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
tasks = []
with httpx.Client(base_url=host["url"], timeout=30, trust_env=False) as client:
    for task_id, title, root_id, directory, created in connection.execute(
        "select t.id,t.title,t.session_id,s.directory,t.time_created "
        "from engine_task t join session s on s.id=t.session_id order by t.time_created"
    ):
        response = client.get(f"task/{task_id}/status", params={"directory": directory})
        response.raise_for_status()
        status = response.json()
        response = client.get(f"task/{task_id}", params={"directory": directory})
        response.raise_for_status()
        task = response.json()
        sessions = []
        counter: collections.Counter[str] = collections.Counter()
        counts: collections.Counter[str] = collections.Counter()
        tokens: collections.Counter[str] = collections.Counter()
        cost = 0.0
        for sid, kind, session_directory in connection.execute(
            "with recursive tree(id,kind,directory) as (select id,kind,directory from session where id=? "
            "union all select s.id,s.kind,s.directory from session s join tree p on s.parent_id=p.id) "
            "select id,kind,directory from tree",
            (root_id,),
        ):
            response = client.get(
                f"session/{sid}/message", params={"directory": session_directory}
            )
            response.raise_for_status()
            messages = []
            for message in response.json():
                info = message["info"]
                if info["role"] == "assistant":
                    counts["assistant_messages"] += 1
                    for key in ("input", "output", "reasoning"):
                        tokens[key] += info.get("tokens", {}).get(key, 0) or 0
                    for key, value in info.get("tokens", {}).get("cache", {}).items():
                        tokens["cache_" + key] += value or 0
                    cost += info.get("cost", 0) or 0
                parts = []
                for part in message.get("parts", []):
                    if part["type"] == "tool":
                        counter[part["tool"]] += 1
                        counts[
                            "tool_" + part.get("state", {}).get("status", "unknown")
                        ] += 1
                        parts.append(part)
                    elif part["type"] == "text" and info["role"] == "assistant":
                        parts.append(
                            {"id": part["id"], "type": "text", "text": part["text"]}
                        )
                messages.append(
                    {
                        "info": {
                            key: info.get(key)
                            for key in (
                                "id",
                                "role",
                                "agent",
                                "modelID",
                                "providerID",
                                "time",
                                "tokens",
                                "cost",
                                "finish",
                            )
                        },
                        "parts": parts,
                    }
                )
            sessions.append({"id": sid, "kind": kind, "messages": messages})
        item = {
            "task_id": task_id,
            "case": title.removeprefix("Inspect sample "),
            "directory": directory,
            "status": status,
            "task": task,
            "sessions": sessions,
            "counts": dict(counts),
            "tools": dict(counter),
            "tokens": dict(tokens),
            "reported_cost": cost,
            "elapsed_seconds": (
                (task.get("time", {}).get("completed") or time.time() * 1000) - created
            )
            / 1000,
        }
        tasks.append(item)
        print(
            json.dumps(
                {
                    key: item[key]
                    for key in (
                        "task_id",
                        "case",
                        "counts",
                        "tools",
                        "tokens",
                        "elapsed_seconds",
                    )
                }
                | {
                    "lifecycle": status["lifecycleStatus"],
                    "activity": [
                        (o.get("agent"), o.get("latest", {}).get("status"))
                        for o in status.get("executionProjection", {}).get(
                            "occurrences", []
                        )
                    ],
                },
                ensure_ascii=True,
            )
        )
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(
    json.dumps(
        {"observed_at": time.time(), "tasks": tasks}, ensure_ascii=True, indent=2
    )
    + "\n",
    encoding="utf-8",
)
