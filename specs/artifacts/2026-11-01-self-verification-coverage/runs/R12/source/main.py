import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_utc(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def canonical(value):
    return value.isoformat(timespec="microseconds").replace("+00:00", "Z")


def build_report(input_directory):
    rows = []
    daily = {}
    total_microseconds = 0
    with (Path(input_directory) / "sessions.csv").open(
        encoding="utf-8", newline=""
    ) as source:
        for row in csv.DictReader(source):
            start = parse_utc(row["started_at"])
            end = parse_utc(row["ended_at"])
            if end < start:
                return {
                    "error": {"code": "NEGATIVE_INTERVAL", "session": row["session"]}
                }, 2
            elapsed = end - start
            microseconds = (
                elapsed.days * 86400 + elapsed.seconds
            ) * 1_000_000 + elapsed.microseconds
            day = start.date().isoformat()
            rows.append(
                {
                    "session": row["session"],
                    "start_utc": canonical(start),
                    "end_utc": canonical(end),
                    "seconds": microseconds / 1_000_000,
                    "start_utc_date": day,
                }
            )
            bucket = daily.setdefault(day, {"sessions": 0, "microseconds": 0})
            bucket["sessions"] += 1
            bucket["microseconds"] += microseconds
            total_microseconds += microseconds

    return {
        "sessions": rows,
        "daily": [
            {
                "date": day,
                "sessions": daily[day]["sessions"],
                "seconds": daily[day]["microseconds"] / 1_000_000,
            }
            for day in sorted(daily)
        ],
        "total_seconds": total_microseconds / 1_000_000,
    }, 0


def main():
    parser = argparse.ArgumentParser(description="Report session durations in UTC.")
    parser.add_argument("input", help="Directory containing sessions.csv")
    parser.add_argument("--output", required=True, help="Destination JSON file")
    args = parser.parse_args()
    report, status = build_report(args.input)
    Path(args.output).write_text(
        json.dumps(report, ensure_ascii=False), encoding="utf-8"
    )
    return status


if __name__ == "__main__":
    raise SystemExit(main())
