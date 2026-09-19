"""Native-arm JSONL transport over the single existing official world bridge.

The model-facing tool list comes from AutomationBenchEnv. Administrative setup
and scoring are host operations; the model cannot choose them.
"""
import argparse
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harness", type=Path, required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--task", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sys.path.insert(0, str(args.harness.resolve()))
    from automationbench_bridge import BridgeState, ToolExecutionError
    from automationbench.runner import AutomationBenchEnv
    from automationbench.domains import get_domain_dataset
    import verifiers as vf

    args.output.mkdir(parents=True, exist_ok=False)
    world = BridgeState(args.domain, args.task, args.output / "automationbench-events.jsonl",
                        args.output / "automationbench-initial-world.json", args.output / "automationbench-final-world.json")
    environment = AutomationBenchEnv(dataset=get_domain_dataset(args.domain), rubric=vf.Rubric(), toolset="api", max_turns=50)
    tools = [{"name": item.name, "description": item.description, "parameters": item.parameters}
             for item in environment._all_tool_defs]
    definitions = {tool["name"] for tool in tools}
    handlers = {"api_fetch": world.fetch, "api_search": world.search, "base64_encode": world.encode}
    if definitions != set(handlers):
        raise ValueError("official_native_tool_set_mismatch")
    print(json.dumps({"kind": "ready", "prompt": world.row["prompt"], "tools": tools,
                      "example_id": world.row["example_id"], "task_contract_sha256": world.task_contract_sha256,
                      "package_tree_sha256": world.package_tree_sha256,
                      "initial_world_sha256": world.initial_world_sha256}), flush=True)
    for line in sys.stdin:
        request = json.loads(line)
        if request["kind"] == "tool":
            name = request["name"]
            if name not in definitions:
                raise ValueError("unknown_native_tool")
            # Same optional-empty-object normalization as the official environment.
            arguments = {key: value for key, value in request["arguments"].items()
                         if not (isinstance(value, dict) and len(value) == 0)}
            try:
                answer = {"kind": "tool_result", "ok": True, "output": handlers[name](arguments)}
            except ToolExecutionError as error:
                answer = {"kind": "tool_result", "ok": False, "output": error.public_message}
            print(json.dumps(answer, ensure_ascii=False), flush=True)
        elif request["kind"] == "score":
            score = world.score()
            score["initial_world_sha256"] = world.initial_world_sha256
            (args.output / "official-score.json").write_text(json.dumps(score, indent=2) + "\n")
            print(json.dumps({"kind": "score", **score}), flush=True)
            return
        else:
            raise ValueError("unknown_host_world_operation")


if __name__ == "__main__":
    main()
