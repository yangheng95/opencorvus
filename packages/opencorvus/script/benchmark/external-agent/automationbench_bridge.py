#!/usr/bin/env python3
"""Restricted HTTP bridge from an OpenCorvus Task to AutomationBench's official API tools."""

from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import json
import os
import socketserver
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import automationbench
from automationbench.domains import get_domain_dataset
from automationbench.rubric import partial_credit, task_completed_correctly
from automationbench.runner import compute_allowed_services, strip_none_values
from automationbench.schema.world import WorldState
from automationbench.task_contract import TASK_CONTRACT_SCHEMA, task_contract_sha256
from automationbench.tools.api import api_fetch, api_search, base64_encode


MAX_BODY_BYTES = 1024 * 1024


class BridgeSealedError(RuntimeError):
    pass


class ToolExecutionError(RuntimeError):
    def __init__(self, status: HTTPStatus, public_message: str):
        super().__init__(public_message)
        self.status = status
        self.public_message = public_message


class BridgeHTTPServer(ThreadingHTTPServer):
    request_queue_size = 128


class BridgeUnixHTTPServer(socketserver.ThreadingUnixStreamServer):
    request_queue_size = 128
    daemon_threads = True


def _package_tree_sha256() -> str:
    root = Path(automationbench.__file__).parent
    digest = hashlib.sha256()
    for file in sorted(root.rglob("*.py")):
        digest.update(file.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(file.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


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
    def __init__(
        self,
        domain: str,
        task_name: str,
        events_path: Path,
        initial_world_path: Path,
        final_world_path: Path,
    ):
        self.row, self.info = _load_task(domain, task_name)
        self.distribution_version = importlib.metadata.version("automation-bench")
        self.package_tree_sha256 = _package_tree_sha256()
        self.task_contract_schema = TASK_CONTRACT_SCHEMA
        self.task_contract_sha256 = task_contract_sha256(
            example_id=self.row.get("example_id"),
            prompt=self.row.get("prompt"),
            info=copy.deepcopy(self.info),
        )
        initial = strip_none_values(copy.deepcopy(self.info.get("initial_state", {})))
        self.info["assertions"] = [strip_none_values(item) for item in self.info.get("assertions", [])]
        self.world = WorldState(**initial)
        self.world.meta.allowed_services = compute_allowed_services(
            initial,
            self.info.get("assertions", []),
            self.info.get("zapier_tools", []),
        )
        initial_world_path.parent.mkdir(parents=True, exist_ok=True)
        initial_world_bytes = self._world_bytes()
        initial_world_path.write_bytes(initial_world_bytes)
        self.initial_world_sha256 = hashlib.sha256(initial_world_bytes).hexdigest()
        self.final_world_path = final_world_path
        self.initial_state = copy.deepcopy(initial)
        self.domain = domain
        self.task_name = task_name
        self.events_path = events_path
        self.lock = threading.Lock()
        self.condition = threading.Condition(self.lock)
        self.sequence = 0
        self.tool_attempts = 0
        self.tool_succeeded = 0
        self.tool_failed = 0
        self.sealed = False
        self.sealing = False
        self.in_flight_stateless = 0
        self.max_in_flight_stateless = 0
        self.started_at = int(time.time() * 1000)
        self.events_path.parent.mkdir(parents=True, exist_ok=True)
        self.events_path.write_text("", encoding="utf-8")

    def _record_locked(self, event: dict[str, Any]) -> None:
        self.sequence += 1
        payload = {"sequence": self.sequence, "ts": int(time.time() * 1000), **event}
        with self.events_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")

    def _world_bytes(self) -> bytes:
        return json.dumps(
            self.world.model_dump(mode="json"),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")

    def _world_sha256_locked(self) -> str:
        return hashlib.sha256(self._world_bytes()).hexdigest()

    def record(self, event: dict[str, Any]) -> None:
        with self.lock:
            self._record_locked(event)

    def record_tool(self, event: dict[str, Any]) -> None:
        with self.lock:
            self._record_locked(event)

    def _ensure_active_locked(self) -> None:
        if self.sealed or self.sealing:
            raise BridgeSealedError("benchmark_world_sealed")

    def _run_tool(self, tool: str, started: int, attempt_metadata: dict[str, Any], operation: Any) -> str:
        if tool == "api_fetch":
            with self.condition:
                self._ensure_active_locked()
                self.tool_attempts += 1
                world_before = self._world_sha256_locked()
                try:
                    result, event = operation()
                except Exception as error:
                    self.tool_failed += 1
                    public_message = str(error) if isinstance(error, (ValueError, json.JSONDecodeError)) else type(error).__name__
                    status = HTTPStatus.BAD_REQUEST if isinstance(error, (ValueError, json.JSONDecodeError)) else HTTPStatus.INTERNAL_SERVER_ERROR
                    self._record_locked(
                        {
                            "kind": "tool_error",
                            "tool": tool,
                            "start": started,
                            "end": int(time.time() * 1000),
                            **attempt_metadata,
                            "world_before_sha256": world_before,
                            "world_after_sha256": self._world_sha256_locked(),
                            "error": public_message,
                        }
                    )
                    raise ToolExecutionError(status, public_message) from error
                self.tool_succeeded += 1
                result_bytes = result.encode("utf-8")
                self._record_locked(
                    {
                        "kind": "tool",
                        "tool": tool,
                        "start": started,
                        "end": int(time.time() * 1000),
                        **attempt_metadata,
                        **event,
                        "world_before_sha256": world_before,
                        "world_after_sha256": self._world_sha256_locked(),
                        "output_bytes": len(result_bytes),
                        "output_sha256": hashlib.sha256(result_bytes).hexdigest(),
                    }
                )
                return result

        with self.condition:
            self._ensure_active_locked()
            self.tool_attempts += 1
            self.in_flight_stateless += 1
            self.max_in_flight_stateless = max(self.max_in_flight_stateless, self.in_flight_stateless)
        try:
            result, event = operation()
        except Exception as error:
            with self.condition:
                try:
                    self.tool_failed += 1
                    public_message = str(error) if isinstance(error, (ValueError, json.JSONDecodeError)) else type(error).__name__
                    status = HTTPStatus.BAD_REQUEST if isinstance(error, (ValueError, json.JSONDecodeError)) else HTTPStatus.INTERNAL_SERVER_ERROR
                    self._record_locked(
                        {
                            "kind": "tool_error",
                            "tool": tool,
                            "start": started,
                            "end": int(time.time() * 1000),
                            **attempt_metadata,
                            "error": public_message,
                        }
                    )
                finally:
                    self.in_flight_stateless -= 1
                    self.condition.notify_all()
            raise ToolExecutionError(status, public_message) from error
        with self.condition:
            try:
                self.tool_succeeded += 1
                result_bytes = result.encode("utf-8")
                self._record_locked(
                    {
                        "kind": "tool",
                        "tool": tool,
                        "start": started,
                        "end": int(time.time() * 1000),
                        **attempt_metadata,
                        **event,
                        "output_bytes": len(result_bytes),
                        "output_sha256": hashlib.sha256(result_bytes).hexdigest(),
                    }
                )
                return result
            finally:
                self.in_flight_stateless -= 1
                self.condition.notify_all()

    def record_malformed_tool_request(self, tool: str, started: int, error: Exception) -> ToolExecutionError:
        with self.lock:
            self._ensure_active_locked()
            self.tool_attempts += 1
            self.tool_failed += 1
            public_message = str(error)
            self._record_locked(
                {
                    "kind": "tool_error",
                    "tool": tool,
                    "start": started,
                    "end": int(time.time() * 1000),
                    "error": public_message,
                }
            )
        return ToolExecutionError(HTTPStatus.BAD_REQUEST, public_message)

    def search(self, payload: dict[str, Any]) -> str:
        started = int(time.time() * 1000)

        def operation() -> tuple[str, dict[str, Any]]:
            query = payload.get("query")
            top_k = payload.get("top_k", 5)
            if not isinstance(query, str) or not query.strip():
                raise ValueError("query must be a non-empty string")
            if not isinstance(top_k, int) or not 1 <= top_k <= 20:
                raise ValueError("top_k must be an integer from 1 through 20")
            return api_search(query=query, top_k=top_k), {"query": query, "top_k": top_k}

        return self._run_tool(
            "api_search",
            started,
            {"query": payload.get("query"), "top_k": payload.get("top_k", 5)},
            operation,
        )

    def fetch(self, payload: dict[str, Any]) -> str:
        started = int(time.time() * 1000)

        def operation() -> tuple[str, dict[str, Any]]:
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
            normalized_method = method.upper()
            return api_fetch(self.world, normalized_method, url, params=params, body=body), {
                "method": normalized_method,
                "url": url,
                "params": params,
                "body": body,
            }

        return self._run_tool(
            "api_fetch",
            started,
            {
                "method": payload.get("method"),
                "url": payload.get("url"),
                "params": payload.get("params"),
                "body": payload.get("body"),
            },
            operation,
        )

    def encode(self, payload: dict[str, Any]) -> str:
        started = int(time.time() * 1000)

        def operation() -> tuple[str, dict[str, Any]]:
            text = payload.get("text")
            if not isinstance(text, str):
                raise ValueError("text must be a string")
            return base64_encode(text), {"input_bytes": len(text.encode("utf-8"))}

        text = payload.get("text")
        metadata = {
            "input_bytes": len(text.encode("utf-8")) if isinstance(text, str) else None,
            "input_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest() if isinstance(text, str) else None,
        }
        return self._run_tool("base64_encode", started, metadata, operation)

    def score(self) -> dict[str, Any]:
        with self.condition:
            self._ensure_active_locked()
            self.sealing = True
            while self.in_flight_stateless > 0:
                self.condition.wait()
            try:
                scoring_state: dict[str, Any] = {
                    "info": self.info,
                    "world": self.world,
                    "initial_state": self.initial_state,
                }
                partial = partial_credit(scoring_state)
                strict = task_completed_correctly(scoring_state)
                transient_assertion_state = {
                    "google_sheets_updated_row_keys": sorted(
                        getattr(self.world.google_sheets, "_updated_row_keys", set())
                    )
                }
                final_world_bytes = self._world_bytes()
                self.final_world_path.parent.mkdir(parents=True, exist_ok=True)
                self.final_world_path.write_bytes(final_world_bytes)
                final_world_sha256 = hashlib.sha256(final_world_bytes).hexdigest()
                result = {
                    "scorer_state_schema": 2,
                    "partial_credit": partial,
                    "task_completed_correctly": strict,
                    "assertion_results": scoring_state.get("_assertion_results", []),
                    "transient_assertion_state": transient_assertion_state,
                    "end_state_sha256": final_world_sha256,
                    "final_world_sha256": final_world_sha256,
                    "tool_calls": self.tool_attempts,
                    "tool_attempts": self.tool_attempts,
                    "tool_succeeded": self.tool_succeeded,
                    "tool_failed": self.tool_failed,
                    "max_in_flight_stateless": self.max_in_flight_stateless,
                }
                self.sealed = True
                self._record_locked(
                    {"kind": "score", **{key: value for key, value in result.items() if key != "assertion_results"}}
                )
                return result
            finally:
                self.sealing = False
                self.condition.notify_all()


def _handler(state: BridgeState, admin_token: str, surface: str):
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

        def _tool_payload(self, tool: str) -> dict[str, Any]:
            started = int(time.time() * 1000)
            try:
                return self._read_json()
            except (ValueError, json.JSONDecodeError) as error:
                raise state.record_malformed_tool_request(tool, started, error) from error

        def do_GET(self) -> None:  # noqa: N802
            if surface == "admin" and self.path == "/health":
                self._json(
                    HTTPStatus.OK,
                    {"ok": True, "domain": state.domain, "task": state.task_name, "toolset": "api"},
                )
                return
            if surface == "admin" and self.path == "/admin/task" and self._authorized(admin_token):
                self._json(
                    HTTPStatus.OK,
                    {
                        "domain": state.domain,
                        "task": state.task_name,
                        "example_id": state.row.get("example_id"),
                        "prompt": state.row.get("prompt"),
                        "distribution_version": state.distribution_version,
                        "package_tree_sha256": state.package_tree_sha256,
                        "task_contract_schema": state.task_contract_schema,
                        "task_contract_sha256": state.task_contract_sha256,
                        "initial_world_sha256": state.initial_world_sha256,
                    },
                )
                return
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            try:
                if surface == "tool" and self.path == "/v1/search":
                    self._json(HTTPStatus.OK, json.loads(state.search(self._tool_payload("api_search"))))
                    return
                if surface == "tool" and self.path == "/v1/fetch":
                    self._json(HTTPStatus.OK, json.loads(state.fetch(self._tool_payload("api_fetch"))))
                    return
                if surface == "tool" and self.path == "/v1/base64":
                    self._json(HTTPStatus.OK, {"encoded": state.encode(self._tool_payload("base64_encode"))})
                    return
                if surface == "admin" and self.path == "/admin/score" and self._authorized(admin_token):
                    self._json(HTTPStatus.OK, state.score())
                    return
                if surface == "admin" and self.path.startswith("/admin/"):
                    self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                    return
                self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            except BridgeSealedError:
                state.record({"kind": "terminal_rejection", "path": self.path, "error": "benchmark_world_sealed"})
                self._json(HTTPStatus.CONFLICT, {"error": "benchmark_world_sealed"})
            except ToolExecutionError as error:
                self._json(error.status, {"error": error.public_message})
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
    parser.add_argument("--initial-world", type=Path, required=True)
    parser.add_argument("--final-world", type=Path, required=True)
    parser.add_argument("--tool-socket", type=Path, required=True)
    parser.add_argument("--agent-uid", type=int, required=True)
    args = parser.parse_args()
    admin_token = sys.stdin.readline().strip()
    if not admin_token:
        raise RuntimeError("admin token must be provided through stdin")
    state = BridgeState(args.domain, args.task, args.events, args.initial_world, args.final_world)
    if args.tool_socket.exists():
        raise RuntimeError("tool socket path already exists")
    tool_server = BridgeUnixHTTPServer(
        str(args.tool_socket),
        _handler(state, admin_token, "tool"),
    )
    os.chown(args.tool_socket, args.agent_uid, args.agent_uid)
    os.chmod(args.tool_socket, 0o600)
    tool_thread = threading.Thread(target=tool_server.serve_forever, kwargs={"poll_interval": 0.2}, daemon=True)
    tool_thread.start()
    server = BridgeHTTPServer(
        ("127.0.0.1", 0),
        _handler(state, admin_token, "admin"),
    )
    port = int(server.server_address[1])
    print(
        json.dumps(
            {
                "event": "ready",
                "port": port,
                "domain": args.domain,
                "task": args.task,
                "example_id": state.row.get("example_id"),
                "distribution_version": state.distribution_version,
                "package_tree_sha256": state.package_tree_sha256,
                "task_contract_schema": state.task_contract_schema,
                "task_contract_sha256": state.task_contract_sha256,
                "initial_world_sha256": state.initial_world_sha256,
                "tool_transport": "unix_socket_uid_scoped",
                "agent_uid": args.agent_uid,
            }
        ),
        flush=True,
    )
    try:
        server.serve_forever(poll_interval=0.2)
    finally:
        tool_server.shutdown()
        tool_server.server_close()
        args.tool_socket.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
