import json
import hashlib
from pathlib import Path
import tempfile
import unittest
from measure_publication_overhead import measure, measurement_inputs


def call(identity, tool, inp, out=None):
    return {"id": identity, "type": "tool", "tool": tool,
            "state": {"status": "completed", "input": inp, "output": json.dumps(out or {})}}


class PublicationOverheadTests(unittest.TestCase):
    def test_measurement_uses_verified_bytes_and_duplicate_identity_is_an_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            names = ["result.json", "opencorvus-transcript.json", "runtime-database-snapshot.json"]
            data = b'{"version":1}'
            entries = []
            for name in names:
                (directory / name).write_bytes(data)
                entries.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
            verified = measurement_inputs(directory, {"files": entries})
            (directory / names[0]).write_bytes(b'{"version":2}')
            self.assertEqual(json.loads(verified[names[0]]), {"version": 1})
            with self.assertRaisesRegex(ValueError, "measurement_input_seal_mismatch:result.json"):
                measurement_inputs(directory, {"files": entries})
            with self.assertRaisesRegex(ValueError, "duplicate_sealed_file_identity"):
                measurement_inputs(directory, {"files": entries + [entries[0]]})

    def test_counts_both_used_and_unused_publisher_selection_calls(self):
        messages = [{"info": {"sessionID": "worker"}, "parts": [
            call("select-a", "artifact_select", {}, {"artifact_selection_ref": "as-a"}),
            call("select-b", "artifact_select", {}, {"artifact_selection_ref": "as-b"}),
            call("publish", "artifact_publish", {"source_selection_refs": ["as-a"]}),
        ]}]
        result = measure(messages)
        self.assertEqual(result["publication_selection_calls"], 2)
        self.assertEqual(result["publication_selection_part_ids"], ["select-a", "select-b"])
        self.assertEqual(result["tool_calls"], 3)

    def test_keeps_separate_consumer_selection_and_counts_direct_publication(self):
        message = {"info": {"sessionID": "worker"}, "parts": [
            call("select", "artifact_select", {}, {"artifact_selection_ref": "as-a"}),
            call("typed", "typed_publisher", {"evidence": ["as-a"]}),
            call("publish", "artifact_publish", {"source_read_refs": ["ar-a"]}),
        ]}
        result = measure([message, message])
        self.assertEqual(result["publisher_selections_used_by_other_consumers"], 1)
        self.assertEqual(result["publication_selection_calls"], 0)
        self.assertEqual(result["direct_read_source_publications"], 1)
        self.assertEqual(result["tool_calls"], 3)

    def test_invalid_receipt_has_explicit_error(self):
        with self.assertRaisesRegex(ValueError, "selection_receipt_missing_reference"):
            measure([{"info": {"sessionID": "worker"}, "parts": [
                call("select", "artifact_select", {}), call("publish", "artifact_publish", {}),
            ]}])

    def test_failed_typed_consumer_still_required_its_selection_input(self):
        typed = call("typed", "typed_publisher", {"evidence": ["as-a"]})
        typed["state"]["status"] = "error"
        result = measure([{"info": {"sessionID": "worker"}, "parts": [
            call("select", "artifact_select", {}, {"artifact_selection_ref": "as-a"}),
            typed, call("publish", "artifact_publish", {"source_read_refs": ["ar-a"]}),
        ]}])
        self.assertEqual(result["publisher_selections_used_by_other_consumers"], 1)
        self.assertEqual(result["publication_selection_calls"], 0)
        self.assertEqual(result["failed_tool_calls"], 1)


if __name__ == "__main__":
    unittest.main()
