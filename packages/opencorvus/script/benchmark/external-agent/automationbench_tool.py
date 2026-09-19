#!/usr/bin/env python3
"""Project-side client exposing only the three official AutomationBench API-mode tools."""

from __future__ import annotations

import argparse
import http.client
import json
import socket
import sys
from pathlib import Path


class UnixHTTPConnection(http.client.HTTPConnection):
    def __init__(self, socket_path: str):
        super().__init__("localhost", timeout=60)
        self.socket_path = socket_path

    def connect(self) -> None:
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.socket_path)


def _request(config: dict[str, str], route: str, payload: dict) -> tuple[int, str]:
    connection = UnixHTTPConnection(config["socket_path"])
    try:
        connection.request(
            "POST",
            route,
            body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"content-type": "application/json"},
        )
        response = connection.getresponse()
        text = response.read().decode("utf-8")
        return response.status, text
    finally:
        connection.close()


def _call(config: dict[str, str], route: str, payload: dict) -> None:
    status, text = _request(config, route, payload)
    print(text)
    if status >= 400:
        raise SystemExit(1)


def _json_argument(value: object | None, field: str) -> str | None:
    if value is None or isinstance(value, str):
        return value
    if not isinstance(value, (dict, list)):
        raise ValueError(f"batch {field} must be an object, array, string, or null")
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _batch_payload(operation: object) -> tuple[str, dict]:
    if not isinstance(operation, dict):
        raise ValueError("each batch operation must be an object")
    command = operation.get("command")
    if command == "search":
        query = operation.get("query")
        top_k = operation.get("top_k", 5)
        if not isinstance(query, str) or not isinstance(top_k, int):
            raise ValueError("batch search requires string query and integer top_k")
        return "/v1/search", {"query": query, "top_k": top_k}
    if command == "fetch":
        method = operation.get("method")
        url = operation.get("url")
        if not isinstance(method, str) or not isinstance(url, str):
            raise ValueError("batch fetch requires string method and url")
        if method.upper() != "GET":
            raise ValueError("batch fetch permits GET only; execute every mutation as a separate command")
        return "/v1/fetch", {
            "method": "GET",
            "url": url,
            "params": _json_argument(operation.get("params"), "params"),
            "body": _json_argument(operation.get("body"), "body"),
        }
    if command == "base64":
        text = operation.get("text")
        if not isinstance(text, str):
            raise ValueError("batch base64 requires string text")
        return "/v1/base64", {"text": text}
    raise ValueError("batch command must be search, fetch, or base64")


def _batch(config: dict[str, str], source: str) -> None:
    raw = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
    operations = json.loads(raw)
    if not isinstance(operations, list) or not 1 <= len(operations) <= 20:
        raise ValueError("batch input must contain 1 through 20 operations")
    prepared = [_batch_payload(operation) for operation in operations]
    results = []
    for index, (route, payload) in enumerate(prepared):
        try:
            status, text = _request(config, route, payload)
        except (OSError, http.client.HTTPException):
            results.append({"index": index, "transport_ok": False, "error": {"type": "transport_outcome_unknown"}})
            results.extend(
                {"index": remaining, "transport_ok": False, "error": {"type": "not_executed", "reason": "prior_transport_error"}}
                for remaining in range(index + 1, len(prepared))
            )
            break
        try:
            body: object = json.loads(text)
        except json.JSONDecodeError:
            body = text
        results.append({"index": index, "transport_status": status, "transport_ok": status < 400, "body": body})
    print(
        json.dumps(
            {"transport_complete": all(item["transport_ok"] for item in results), "results": results},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="AutomationBench API-mode tool client")
    parser.add_argument("--config", default=".automationbench-tool.json")
    subparsers = parser.add_subparsers(dest="command", required=True)

    search = subparsers.add_parser("search")
    search.add_argument("query")
    search.add_argument("--top-k", type=int, default=5)

    fetch = subparsers.add_parser("fetch")
    fetch.add_argument("method")
    fetch.add_argument("url")
    fetch.add_argument("--params")
    fetch.add_argument("--body")

    encode = subparsers.add_parser("base64")
    encode.add_argument("text")

    batch = subparsers.add_parser("batch")
    batch.add_argument("source", nargs="?", default="-", help="JSON array file, or - for stdin")

    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    if args.command == "search":
        _call(config, "/v1/search", {"query": args.query, "top_k": args.top_k})
    elif args.command == "fetch":
        _call(
            config,
            "/v1/fetch",
            {"method": args.method, "url": args.url, "params": args.params, "body": args.body},
        )
    elif args.command == "base64":
        _call(config, "/v1/base64", {"text": args.text})
    else:
        _batch(config, args.source)


if __name__ == "__main__":
    main()
