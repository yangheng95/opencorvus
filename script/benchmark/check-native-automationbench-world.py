"""Exercise the real official world, API transport, and replay checker without a model."""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--harness", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    world_dir = args.output / "world"
    command = [sys.executable, str(Path(__file__).with_name("native-automationbench-world.py")),
               "--harness", str(args.harness), "--domain", "simple", "--task", "simple.email_sf_contact_phone_update", "--output", str(world_dir)]
    with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as process:
        ready = json.loads(process.stdout.readline())
        assert ready["kind"] == "ready"
        assert sorted(item["name"] for item in ready["tools"]) == ["api_fetch", "api_search", "base64_encode"]

        def call(request):
            process.stdin.write(json.dumps(request) + "\n")
            process.stdin.flush()
            return json.loads(process.stdout.readline())

        encoded = call({"kind": "tool", "name": "base64_encode", "arguments": {"text": "audit"}})
        assert encoded == {"kind": "tool_result", "ok": True, "output": "YXVkaXQ="}
        search = call({"kind": "tool", "name": "api_search", "arguments": {"query": "salesforce update contact", "top_k": 2}})
        assert search["kind"] == "tool_result" and search["ok"] and len(search["output"]) > 0
        score = call({"kind": "score"})
        process.stdin.close()
        assert process.wait() == 0, process.stderr.read()
        assert score["tool_attempts"] == 2 and score["tool_succeeded"] == 2
        assert score["task_completed_correctly"] == 0.0
    replay = subprocess.run([sys.executable, str(args.harness / "verify_automationbench_replay.py"),
                             "--domain", "simple", "--task", "simple.email_sf_contact_phone_update",
                             "--events", str(world_dir / "automationbench-events.jsonl"),
                             "--initial-world", str(world_dir / "automationbench-initial-world.json"),
                             "--final-world", str(world_dir / "automationbench-final-world.json")],
                            input=json.dumps(score), text=True, capture_output=True)
    assert replay.returncode == 0, replay.stderr
    receipt = json.loads(replay.stdout)
    assert receipt["passed"]
    result = {"passed": True, "kind": "real_official_world_and_replay_smoke", "model_calls": 0,
              "benchmark_result": False, "replay": receipt}
    (args.output / "check.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
