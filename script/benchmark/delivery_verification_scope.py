"""Fixed business cases and an external final-zipapp consumer; no model calls."""
import argparse
import csv
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile


CONTRACTS = {
    "csv": """Deliver a reusable Python 3 standard-library command line program as deliverable.pyz.
Usage: python deliverable.pyz INPUT --output OUTPUT
INPUT is a UTF-8 standard comma-separated CSV with a header. Required named columns are
customer and amount; additional columns are metadata. customer is a nonempty text value;
amount is a signed decimal with at most two fractional places. Sum all amounts by the
exact customer value. Write UTF-8 JSON {"totals":[{"customer":NAME,"amount":DECIMAL_STRING},...]}
sorted by customer in Unicode code-point order, amounts with exactly two fractional places.
The input can contain any legal records satisfying that contract, including zero data records.
The delivered archive must work from an arbitrary working directory using Python alone.
""",
    "json": """Deliver a reusable Python 3 standard-library command line program as deliverable.pyz.
Usage: python deliverable.pyz INPUT --output OUTPUT
INPUT is any UTF-8 JSON value. Flatten it to a JSON object mapping RFC 6901 JSON Pointer
strings to leaf values. Object member names use RFC 6901 escaping; array indices use decimal
positions. Scalars and empty containers are leaves; the root pointer is the empty string.
Preserve exact string values and JSON scalar types. Write the mapping as UTF-8 JSON.
The delivered archive must work from an arbitrary working directory using Python alone.
""",
}

PROTOTYPES = {
    "csv": '''import argparse, json
p = argparse.ArgumentParser()
p.add_argument("input")
p.add_argument("--output", required=True)
a = p.parse_args()
totals = {}
for line in open(a.input, encoding="utf-8").read().splitlines()[1:]:
    name, amount = line.split(",")
    totals[name] = totals.get(name, 0.0) + float(amount)
json.dump({"totals": [{"customer": k, "amount": f"{v:.2f}"} for k,v in sorted(totals.items())]}, open(a.output,"w",encoding="utf-8"))
''',
    "json": '''import argparse, json
p = argparse.ArgumentParser()
p.add_argument("input")
p.add_argument("--output", required=True)
a = p.parse_args()
result = {}
def visit(value, pointer):
    if isinstance(value, dict):
        for key, item in value.items():
            visit(item, pointer + "/" + key)
    else:
        result[pointer] = value
visit(json.load(open(a.input, encoding="utf-8")), "")
json.dump(result, open(a.output,"w",encoding="utf-8"))
''',
}


def csv_text(columns, rows, newline="\r\n"):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator=newline)
    writer.writerow(columns)
    writer.writerows(rows)
    return stream.getvalue()


def csv_expected(*pairs):
    return {"totals": [{"customer": k, "amount": v} for k, v in pairs]}


def cases(kind):
    # Expected values are fixed business results, not produced by the candidate or its parser.
    if kind == "csv":
        return [
            ("development", "customer,amount\nAda,1.25\nBo,2.00\nAda,0.75\n", csv_expected(("Ada", "2.00"), ("Bo", "2.00"))),
            ("quoted-records", csv_text(["customer", "amount"], [["Li, Mei", "1.10"], ['A "Team"', "2.20"], ["two\nlines", "3.30"]]), csv_expected(('A "Team"', "2.20"), ("Li, Mei", "1.10"), ("two\nlines", "3.30"))),
            ("named-columns", csv_text(["note", "amount", "customer"], [["meta", "3.25", "Zoë"], ["x,y", "-1.25", "Zoë"], ["", "0", "中文"]]), csv_expected(("Zoë", "2.00"), ("中文", "0.00"))),
            ("empty", csv_text(["customer", "amount"] , []), csv_expected()),
            ("exact-money", csv_text(["customer", "amount"], [["Ledger", "9999999999999999.99"], ["Ledger", "0.01"], ["Small", "-0.01"], ["Small", "0.02"]], "\n"), csv_expected(("Ledger", "10000000000000000.00"), ("Small", "0.01"))),
            ("combined", csv_text(["amount", "customer", "extra"], [["12.30", " A,\"组\"\nZ ", "a\nb"], ["-2.30", " A,\"组\"\nZ ", ""], ["0", "é", "metadata"]]), csv_expected((" A,\"组\"\nZ ", "10.00"), ("é", "0.00"))),
        ]
    return [
        ("development", '{"service":{"port":8080,"name":"api"}}', {"/service/port": 8080, "/service/name": "api"}),
        ("escaped-members", '{"a/b":{"~key":1},"~1":"literal","":{"":true}}', {"/a~1b/~0key": 1, "/~01": "literal", "//": True}),
        ("array-and-types", '[null,false,0,"0",{"items":[1,2]}]', {"/0": None, "/1": False, "/2": 0, "/3": "0", "/4/items/0": 1, "/4/items/1": 2}),
        ("empty-containers", '{"a":{},"b":[],"c":[{},[]]}', {"/a": {}, "/b": [], "/c/0": {}, "/c/1": []}),
        ("root-scalar", '"text\\n中文"', {"": "text\n中文"}),
        ("root-empty", '{}', {"": {}}),
        ("combined", '{"组/~":[{"":[]},[true,{"x/y~z":"行\\n值"}]],"n":-12.5}', {"/组~1~0/0/": [], "/组~1~0/1/0": True, "/组~1~0/1/1/x~1y~0z": "行\n值", "/n": -12.5}),
    ]


def setup(kind, project):
    project.mkdir(parents=True, exist_ok=True)
    (project / "main.py").write_text(PROTOTYPES[kind], encoding="utf-8")
    (project / "CONTRACT.md").write_text(CONTRACTS[kind], encoding="utf-8")
    name, content, expected = cases(kind)[0]
    (project / f"sample.{kind}").write_bytes(content.encode("utf-8"))
    (project / "sample.expected.json").write_text(json.dumps(expected, ensure_ascii=False), encoding="utf-8")
    return {"case": kind, "contract": CONTRACTS[kind], "sample": name}


def json_kind(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    return {str: "string", list: "array", dict: "object"}[type(value)]


def same_json(actual, expected):
    if json_kind(actual) != json_kind(expected):
        return False
    if isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(same_json(actual[key], value) for key, value in expected.items())
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(same_json(a, b) for a, b in zip(actual, expected))
    return actual == expected


def grade(kind, project, output):
    output.mkdir(parents=True, exist_ok=True)
    archive = project / "deliverable.pyz"
    results = []
    # Consumer files and cwd are outside the producing project, created only after settlement.
    with tempfile.TemporaryDirectory(prefix="oc-final-consumer-") as directory:
        consumer = Path(directory)
        for name, content, expected in cases(kind):
            source = consumer / f"input {name}.{kind}"
            target = consumer / f"result {name}.json"
            source.write_bytes(content.encode("utf-8"))
            argv = [sys.executable, "-I", str(archive.resolve()), str(source), "--output", str(target)]
            try:
                completed = subprocess.run(argv, cwd=consumer, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
                actual_text = target.read_text(encoding="utf-8") if target.is_file() else None
                actual = json.loads(actual_text) if actual_text is not None else None
                passed = completed.returncode == 0 and actual_text is not None and same_json(actual, expected)
                result = {"name": name, "argv": argv, "cwd": str(consumer), "exit": completed.returncode, "stdout": completed.stdout, "stderr": completed.stderr, "actual": actual, "expected": expected, "passed": passed}
            except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                result = {"name": name, "argv": argv, "cwd": str(consumer), "expected": expected, "passed": False, "error": str(error)}
            (output / f"{name}.input.{kind}").write_bytes(content.encode("utf-8"))
            results.append(result)
    report = {"case": kind, "passed": all(row["passed"] for row in results), "results": results}
    (output / "grade.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["setup", "grade"])
    parser.add_argument("kind", choices=CONTRACTS)
    parser.add_argument("project", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = setup(args.kind, args.project) if args.action == "setup" else grade(args.kind, args.project, args.output)
    print(json.dumps(result, ensure_ascii=True))
    sys.exit(0 if args.action == "setup" or result["passed"] else 1)
