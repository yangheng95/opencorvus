import argparse
import csv
import json
from decimal import Decimal, localcontext
from fractions import Fraction
from pathlib import Path


ABSOLUTE_ZERO = {"C": Fraction("-273.15"), "F": Fraction("-459.67"), "K": Fraction(0)}


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as source:
        yield from csv.DictReader(source)


def make_report(root):
    sensors = {
        row["sensor"]: {
            name: Fraction(Decimal(row[name]))
            for name in ("gain", "offset_c", "low_c", "high_c")
        }
        for row in read_csv(root / "sensors.csv")
    }
    readings = []
    counts = dict(LOW=0, OK=0, HIGH=0)
    for row in read_csv(root / "readings.csv"):
        value = Fraction(Decimal(row["temperature"]))
        unit = row["unit"]
        if value < ABSOLUTE_ZERO[unit]:
            return {
                "success": False,
                "error": {
                    "code": "BELOW_ABSOLUTE_ZERO",
                    "sequence": row["sequence"],
                    "sensor": row["sensor"],
                },
            }, 2
        if unit == "F":
            celsius = (value - 32) * 5 / 9
        elif unit == "K":
            celsius = value - Fraction("273.15")
        else:
            celsius = value
        sensor = sensors[row["sensor"]]
        calibrated = celsius * sensor["gain"] + sensor["offset_c"]
        status = (
            "LOW"
            if calibrated < sensor["low_c"]
            else "HIGH"
            if calibrated > sensor["high_c"]
            else "OK"
        )
        counts[status] += 1
        readings.append(
            {
                "sequence": row["sequence"],
                "sensor": row["sensor"],
                "celsius": celsius,
                "calibrated_c": calibrated,
                "status": status,
            }
        )
    return {"success": True, "readings": readings, "counts": counts}, 0


def encode_json(value):
    if isinstance(value, Fraction):
        # Precision scales with magnitude so even large numbers meet absolute tolerance.
        with localcontext() as context:
            context.prec = len(str(abs(value.numerator))) + 20
            return str(Decimal(value.numerator) / Decimal(value.denominator))
    if isinstance(value, dict):
        return (
            "{"
            + ",".join(
                json.dumps(key, ensure_ascii=False) + ":" + encode_json(item)
                for key, item in value.items()
            )
            + "}"
        )
    if isinstance(value, list):
        return "[" + ",".join(encode_json(item) for item in value) + "]"
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def main():
    parser = argparse.ArgumentParser(
        description="Produce a calibrated temperature report."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report, exit_code = make_report(args.input)
    args.output.write_text(encode_json(report) + "\n", encoding="utf-8")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
