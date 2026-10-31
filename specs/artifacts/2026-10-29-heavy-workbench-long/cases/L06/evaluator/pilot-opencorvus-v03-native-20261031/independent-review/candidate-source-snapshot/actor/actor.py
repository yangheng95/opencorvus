"""Deterministic current-prefix actor; no selected future or local checkpoint."""

import argparse
import hashlib
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", type=Path, required=True)
    args = parser.parse_args()
    sys.path[:0] = [
        str(args.public / "exercise-tools/upgrade-v0.3/source"),
        str(args.public / "exercise-tools/qualification/current-source"),
    ]
    from tree_business import load_data, packet, canonical, event, action_at, advance
    from l06_physics import initial_state

    data, _ = load_data(args.public)
    policy = json.loads(
        Path(__file__).with_name("policy.json").read_text(encoding="utf-8")
    )
    for line in sys.stdin:
        current = json.loads(line)
        t = current["week"]
        assert type(t) is int and 0 <= t < 16
        # Recompute every queue, receipt and state from the immutable supplied prefix.
        rebuilt = packet(data, current["committed"], current["history"][-1])
        if canonical(rebuilt) != canonical(current):
            raise ValueError("packet disagrees with authoritative committed prefix")
        matching = [
            s
            for s in data["scenarios"]
            if canonical([event(s, k) for k in range(t + 1)])
            == canonical(current["history"])
        ]
        if not matching:
            raise ValueError("unsupported observation")
        actions = [action_at(policy, s["id"], t) for s in matching]
        if any(canonical(a) != canonical(actions[0]) for a in actions):
            raise ValueError("policy anticipates an unobserved future")
        # A different previously committed action invalidates this policy's state.
        for item in current["committed"]:
            for s in matching:
                if canonical(item["action"]) != canonical(
                    action_at(policy, s["id"], item["week"])
                ):
                    raise ValueError("committed action differs from installed policy")
        action = actions[0]
        advance(data, current["post_week_state"], current["history"][-1], action)
        # This digest identifies the original logical payload for idempotency only;
        # it is not a correctness or acceptance checksum.
        payload = canonical({"history": current["history"], "action": action})
        request_id = (
            "policy-v1-w"
            + str(t)
            + "-"
            + hashlib.sha256(payload.encode("utf-8")).hexdigest()
        )
        print(
            canonical(
                {
                    "format": "l06-action-response/1",
                    "request_id": request_id,
                    "action": action,
                }
            ),
            flush=True,
        )


if __name__ == "__main__":
    main()
