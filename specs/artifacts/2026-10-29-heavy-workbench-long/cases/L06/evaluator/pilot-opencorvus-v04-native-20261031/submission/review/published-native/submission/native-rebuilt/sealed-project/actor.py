"""Deterministic online table actor with full original-prefix validation."""

from pathlib import Path
from fractions import Fraction
import hashlib, json, sys

sys.dont_write_bytecode = True
public = Path(sys.argv[1])
instance = Path(sys.argv[2])
sys.path.insert(0, str(public))
from model import (
    load,
    packet,
    posterior,
    belief_wire,
    canonical,
    require,
    ContractError,
)


def normalize(x):
    if isinstance(x, Fraction):
        return str(x)
    if isinstance(x, dict):
        return {k: normalize(v) for k, v in x.items()}
    if isinstance(x, list):
        return [normalize(v) for v in x]
    return x


data = load(instance)
table = json.loads(
    (Path(__file__).parent / "tables" / (data["id"] + ".json")).read_text(
        encoding="utf-8"
    )
)
require(canonical(normalize(data)) == canonical(table["law"]), "changed_original_facts")


def key_for(current):
    # SHA-256 binds idempotency identity to the full packet and exact original law.
    return (
        "l06-"
        + hashlib.sha256(
            (canonical(table["law"]) + "\n" + canonical(current)).encode("utf-8")
        ).hexdigest()
    )


def response(current):
    require(
        canonical(normalize(load(instance))) == canonical(table["law"]),
        "changed_original_facts",
    )
    require(current["format"] == "l06-inspection-packet/1", "packet_version")
    require(current["instance_id"] == data["id"], "original_instance_identity")
    history = current["committed"]
    keys = set()
    prefix = []
    for item in history:
        require(item["request_id"] not in keys, "duplicate_original_key")
        require(
            item["request_id"] == key_for(packet(data, prefix)),
            "changed_original_request_key",
        )
        keys.add(item["request_id"])
        prefix.append(item)
    expected = packet(data, history)
    require(canonical(expected) == canonical(current), "complete_original_packet")
    s = current["state"]
    require(not s["terminal"], "terminal_business")
    k = sum(
        (1 if (v["action"]["test"] == "A") == (v["observation"] == "good") else -1)
        for v in history
        if v["phase"] == "laboratory" and v["action"]["test"]
    )
    key = canonical(
        [
            s["phase"],
            s["week"],
            s["good"],
            s["quarantine"]["A"] + 2 * s["quarantine"]["B"],
            s["cash"],
            k,
        ]
    )
    require(key in table["actions"], "unsupported_policy_state")
    return {
        "format": "l06-inspection-response/1",
        "request_id": key_for(current),
        "belief": belief_wire(posterior(data, history)),
        "action": table["actions"][key],
    }


def unique(pairs):
    out = {}
    for k, v in pairs:
        require(k not in out, "duplicate_json_field")
        out[k] = v
    return out


if __name__ == "__main__":
    try:
        for line in sys.stdin:
            print(
                canonical(response(json.loads(line, object_pairs_hook=unique))),
                flush=True,
            )
    except Exception as error:
        print(
            json.dumps(
                {
                    "diagnosis": getattr(error, "code", type(error).__name__),
                    "detail": str(error),
                }
            ),
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)
