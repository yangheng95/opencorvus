"""Copy one archived state with explicit attribution; no API, model, or scoring calls."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from inspect_ai.log import read_eval_log

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / ".tmp/supervision-causal-20260925/he-01"
TARGET = ROOT / ".tmp/supervision-causal-20260925/repair-01-preparation"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    result = json.loads((SOURCE / "B1/result.json").read_text(encoding="utf-8"))
    original = Path(result["log"])
    before = digest(original)
    log = read_eval_log(str(original))
    if log.status != "success" or len(log.samples or []) != 1:
        raise ValueError("Source must be the complete single B1 observation")
    sample = log.samples[0]
    if sample.id != "sales.create_new_opportunity":
        raise ValueError("Unexpected original sample identity")
    chain_path = SOURCE / "audit/B1-final-chain.json"
    chain = json.loads(chain_path.read_text(encoding="utf-8"))["official"]
    snapshot = sample.metadata["automationbench_snapshot"]
    if snapshot != chain["snapshot"] or sample.input != chain["input"]:
        raise ValueError("Source snapshot/input differs from its archived extraction")
    if sample.metadata["automationbench_events"] != chain["events"]:
        raise ValueError("Source event history differs from its archived extraction")
    if digest(original) != before:
        raise ValueError("Source eval changed while it was read")
    if not isinstance(sample.input, str):
        raise ValueError("Source input must be plain text")
    system = sample.input.split("\nSYSTEM:\n", 1)[1].split("\n\nUSER:\n", 1)[0]
    request = (
        "Review the existing Summit Industries - Analytics Module opportunity against the "
        "business requirement below. Establish the applicable source facts, correct the "
        "existing opportunity and its pricing explanation where supported, and verify the "
        "resulting business outcome. Preserve the existing opportunity identity and fields "
        "already supported by the requirement, as well as unrelated records and source facts. "
        "Work on the existing opportunity rather than creating another one. Report any "
        "remaining uncertainty truthfully.\n\n"
        "Business requirement: Summit Industries wants to add our Analytics Module, with "
        "appropriate pricing based on their account size and tier, using the latest pricing "
        "updates and account health policies.\n\n"
        "Retained task constraints from the archived request (the current request above "
        "authorizes review and correction of the existing record):\n" + system
    )
    fixture = {
        "schema_version": 1,
        "kind": "operator-derived-business-repair",
        "id": "repair-01-existing-opportunity",
        "request": request,
        "source": {
            "author": "operator",
            "reference": str(original.relative_to(ROOT)).replace("\\", "/"),
            "description": (
                "Complete archived B1 final business state copied for a new repair diagnosis. "
                "Business IDs retain local record relations; no original Task, Message, Tool "
                "or Artifact participant authority is inherited."
            ),
        },
        "state": {
            "world": snapshot["world"],
            "google_sheets_updated_row_keys": snapshot["google_sheets_updated_row_keys"],
        },
    }
    TARGET.mkdir(parents=True, exist_ok=False)
    fixture_path = TARGET / "fixture.json"
    with fixture_path.open("x", encoding="utf-8") as output:
        json.dump(fixture, output, ensure_ascii=False, indent=2)
        output.write("\n")
    receipt = {
        "schema_version": 1,
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "kind": "operator-readonly-source-copy",
        "source_eval": str(original),
        "source_eval_sha256": before,
        "source_sample_id": sample.id,
        "source_native_identity": sample.metadata["opencorvus_result"],
        "source_chain": str(chain_path),
        "source_equalities": {"snapshot": True, "events": True, "input": True},
        "source_event_count": len(chain["events"]),
        "fixture": str(fixture_path),
        "fixture_bytes": fixture_path.stat().st_size,
        "fixture_sha256": digest(fixture_path),
        "business_clock": snapshot["world"]["meta"]["current_time"],
        "allowed_services": snapshot["world"]["meta"]["allowed_services"],
        "note": "Identity/integrity only; no world session, model, API or scoring was run.",
    }
    with (TARGET / "source-receipt.json").open("x", encoding="utf-8") as output:
        json.dump(receipt, output, ensure_ascii=False, indent=2)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
