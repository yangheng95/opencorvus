#!/usr/bin/env python3
"""Project-side client exposing only the three official AutomationBench API-mode tools."""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path


def _call(config: dict[str, str], route: str, payload: dict) -> None:
    request = urllib.request.Request(
        config["base_url"].rstrip("/") + route,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "authorization": f"Bearer {config['tool_token']}",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            print(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        print(error.read().decode("utf-8"))
        raise SystemExit(1) from error


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
    else:
        _call(config, "/v1/base64", {"text": args.text})


if __name__ == "__main__":
    main()
