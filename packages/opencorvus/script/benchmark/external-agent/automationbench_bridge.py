#!/usr/bin/env python3
"""Restricted HTTP bridge from an OpenCorvus Task to AutomationBench's official API tools."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from automationbench.domains import get_domain_dataset
from automationbench.rubric import partial_credit, task_completed_correctly
from automationbench.runner import compute_allowed_services, strip_none_values
from automationbench.schema.world import WorldState
from automationbench.tools.api import api_fetch, api_search, base64_encode


MAX_BODY_BYTES = 1024 * 1024


def _task_name(row: dict[str, Any]) -> str:
    info = row.get("info", {})
    if isinstance(info, str):
        info = json.loads(info)
    return str(info.get("task_name", ""))


def _load_task(domain: str, task_name: str) -> tuple[dict[str, Any], dict[str, Any]]:
    dataset = get_domain_dataset(domain)
    for index in range(len(dataset)):
        row = dict(dataset[index])
        if _task_name(row) != task_name:
            continue
        info = row.get("info", {})
        if isinstance(info, str):
            info = json.loads(info)
        return row, copy.deepcopy(info)
    raise ValueError(f"AutomationBench task not found in {domain}: {task_name}")


class BridgeState:
    def __init__(self, domain: str, task_name: str, events_path: Path):
        self.row, self.info = _load_task(domain, task_name)
        initial = strip_none_values(copy.deepcopy(self.info.get("initial_state", {})))
        self.info["assertions"] = [strip_none_values(item) for item in self.info.get("assertions", [])]
        self.world = WorldState(**initial)
        self.world.meta.allowed_services = compute_allowed_services(
            initial,
            self.info.get("assertions", []),
            self.info.get("zapier_tools", []),
        )
        self.initial_state = copy.deepcopy(initial)
        self.domain = domain
        self.task_name = task_name
        self.events_path = events_path
        self.lock = threading.Lock()
        self.sequence = 0
        self.tool_calls = 0
        self.started_at = int(time.time() * 1000)
        self.events_path.parent.mkdir(parents=True, exist_ok=True)
        self.events_path.write_text("", encoding="utf-8")

    def record(self, event: dict[str, Any]) -> None:
        with self.lock:
            self.sequence += 1
            payload = {"sequence": self.sequence, "ts": int(time.time() * 1000), **event}
            with self.events_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")

    def search(self, payload: dict[str, Any]) -> str:
        query = payload.get("query")
        top_k = payload.get("top_k", 5)
        if not isinstance(query, str) or not query.strip():
            raise ValueError("query must be a non-empty string")
        if not isinstance(top_k, int) or not 1 <= top_k <= 20:
            raise ValueError("top_k must be an integer from 1 through 20")
        started = int(time.time() * 1000)
        result = api_search(query=query, top_k=top_k)
        self.tool_calls += 1
        self.record(
            {
                "kind": "tool",
                "tool": "api_search",
                "start": started,
                "end": int(time.time() * 1000),
                "query": query,
                "top_k": top_k,
                "output_bytes": len(result.encode("utf-8")),
            }
        )
        return result

    def fetch(self, payload: dict[str, Any]) -> str:
        method = payload.get("method")
        url = payload.get("url")
        params = payload.get("params")
        body = payload.get("body")
        if not isinstance(method, str) or method.upper() not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
            raise ValueError("method must be GET, POST, PUT, PATCH, or DELETE")
        if not isinstance(url, str) or not url.strip():
            raise ValueError("url must be a non-empty string")
        for label, value in (("params", params), ("body", body)):
            if value is not None and not isinstance(value, str):
                raise ValueError(f"{label} must be a JSON string when provided")
        started = int(time.time() * 1000)
        with self.lock:
            result = api_fetch(self.world, method.upper(), url, params=params, body=body)
        self.tool_calls += 1
        self.record(
            {
                "kind": "tool",
                "tool": "api_fetch",
                "start": started,
                "end": int(time.time() * 1000),
                "method": method.upper(),
                "url": url,
                "params": params,
                "body": body,
                "output_bytes": len(result.encode("utf-8")),
            }
        )
        return result

    def encode(self, payload: dict[str, Any]) -> str:
        text = payload.get("text")
        if not isinstance(text, str):
            raise ValueError("text must be a string")
        started = int(time.time() * 1000)
        result = base64_encode(text)
        self.tool_calls += 1
        self.record(
            {
                "kind": "tool",
                "tool": "base64_encode",
                "start": started,
                "end": int(time.time() * 1000),
                "input_bytes": len(text.encode("utf-8")),
                "output_bytes": len(result.encode("utf-8")),
            }
        )
        return result

    def score(self) -> dict[str, Any]:
        with self.lock:
            scoring_state: dict[str, Any] = {
                "info": self.info,
                "world": self.world,
                "initial_state": self.initial_state,
            }
            partial = partial_credit(scoring_state)
            strict = task_completed_correctly(scoring_state)
            end_state = self.world.model_dump(mode="json")
        result = {
            "partial_credit": partial,
            "task_completed_correctly": strict,
            "assertion_results": scoring_state.get("_assertion_results", []),
            "end_state_sha256": hashlib.sha256(
                json.dumps(end_state, sort_keys=True, separators=(",", ":")).encode("utf-8")
            ).hexdigest(),
            "tool_calls": self.tool_calls,
        }
        self.record({"kind": "score", **{key: value for key, value in result.items() if key != "assertion_results"}})
        return result


def _handler(state: BridgeState, tool_token: str, admin_token: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = "OpenCorvusAutomationBenchBridge/1"

        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def _authorized(self, expected: str) -> bool:
            return self.headers.get("authorization") == f"Bearer {expected}"

        def _json(self, status: HTTPStatus, payload: Any) -> None:
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            self.send_response(status.value)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self) -> dict[str, Any]:
            length = int(self.headers.get("content-length", "0") or "0")
            if length < 0 or length > MAX_BODY_BYTES:
                raise ValueError(f"request body exceeds {MAX_BODY_BYTES} bytes")
            raw = self.rfile.read(length)
            value = json.loads(raw or b"{}")
            if not isinstance(value, dict):
                raise ValueError("request body must be a JSON object")
            return value

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._json(
                    HTTPStatus.OK,
                    {"ok": True, "domain": state.domain, "task": state.task_name, "toolset": "api"},
                )
                return
            if self.path == "/admin/task" and self._authorized(admin_token):
                self._json(
                    HTTPStatus.OK,
                    {
                        "domain": state.domain,
                        "task": state.task_name,
                        "example_id": state.row.get("example_id"),
                        "prompt": state.row.get("prompt"),
                    },
                )
                return
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            try:
                if self.path == "/v1/search" and self._authorized(tool_token):
                    self._json(HTTPStatus.OK, json.loads(state.search(self._read_json())))
                    return
                if self.path == "/v1/fetch" and self._authorized(tool_token):
                    self._json(HTTPStatus.OK, json.loads(state.fetch(self._read_json())))
                    return
                if self.path == "/v1/base64" and self._authorized(tool_token):
                    self._json(HTTPStatus.OK, {"encoded": state.encode(self._read_json())})
                    return
                if self.path == "/admin/score" and self._authorized(admin_token):
                    self._json(HTTPStatus.OK, state.score())
                    return
                if self.path.startswith("/v1/") or self.path.startswith("/admin/"):
                    self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                    return
                self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            except (ValueError, json.JSONDecodeError) as error:
                state.record({"kind": "error", "message": str(error), "path": self.path})
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception as error:  # keep infrastructure failure visible to the runner
                state.record({"kind": "error", "message": type(error).__name__, "path": self.path})
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": type(error).__name__})

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True)
    parser.add_argument("--task", required=True)
    parser.add_argument("--events", type=Path, required=True)
    parser.add_argument("--tool-token", required=True)
    parser.add_argument("--admin-token", required=True)
    args = parser.parse_args()
    state = BridgeState(args.domain, args.task, args.events)
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0),
        _handler(state, args.tool_token, args.admin_token),
    )
    port = int(server.server_address[1])
    print(json.dumps({"event": "ready", "port": port, "domain": args.domain, "task": args.task}), flush=True)
    server.serve_forever(poll_interval=0.2)


if __name__ == "__main__":
    main()
