"""Positive contracts for the fixed external business oracle."""
import csv
import io
import json
import unittest

from delivery_verification_scope import cases, csv_text, json_kind, same_json


class DeliveryVerificationScopeTest(unittest.TestCase):
    def test_csv_writer_preserves_legal_field_values(self):
        fields = [[" A,\"组\"\nZ ", "-2.30", "a\nb"]]
        parsed = list(csv.reader(io.StringIO(csv_text(["customer", "amount", "extra"], fields), newline="")))
        self.assertEqual(parsed, [["customer", "amount", "extra"], *fields])

    def test_fixed_oracle_has_explicit_business_results(self):
        csv_cases = {name: expected for name, _, expected in cases("csv")}
        self.assertEqual(csv_cases["exact-money"], {"totals": [{"customer": "Ledger", "amount": "10000000000000000.00"}, {"customer": "Small", "amount": "0.01"}]})
        json_cases = {name: expected for name, _, expected in cases("json")}
        self.assertEqual(json_cases["escaped-members"], {"/a~1b/~0key": 1, "/~01": "literal", "//": True})
        self.assertEqual(json_cases["root-empty"], {"": {}})

    def test_json_inputs_keep_distinct_scalar_types(self):
        source = next(content for name, content, _ in cases("json") if name == "array-and-types")
        self.assertEqual([type(value).__name__ for value in json.loads(source)[:4]], ["NoneType", "bool", "int", "str"])

    def test_consumer_compares_json_semantics(self):
        self.assertEqual([json_kind(value) for value in [None, False, 0, 0.0, "0", [], {}]], ["null", "boolean", "number", "number", "string", "array", "object"])
        self.assertEqual(same_json({"b": [1.0, False], "a": {}}, {"a": {}, "b": [1, False]}), True)


if __name__ == "__main__":
    unittest.main()
