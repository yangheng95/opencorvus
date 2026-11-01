import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path


TIMESTAMP = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]{1,6})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])"
)


def parse_timestamp(value):
    if TIMESTAMP.fullmatch(value) is None:
        raise ValueError("Invalid timestamp: {!r}".format(value))
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def canonical(value):
    return value.isoformat(timespec="microseconds").replace("+00:00", "Z")


def build_report(input_directory):
    sessions = []
    daily = {}
    total_microseconds = 0
    with (Path(input_directory) / "sessions.csv").open(
        encoding="utf-8", newline=""
    ) as source:
        reader = csv.DictReader(source)
        if not {"session", "started_at", "ended_at"}.issubset(reader.fieldnames or []):
            raise ValueError(
                "sessions.csv must contain session, started_at and ended_at columns"
            )
        for row in reader:
            start = parse_timestamp(row["started_at"])
            end = parse_timestamp(row["ended_at"])
            if end < start:
                return {
                    "error": {"code": "NEGATIVE_INTERVAL", "session": row["session"]}
                }, 2
            elapsed = end - start
            microseconds = (
                elapsed.days * 86400 + elapsed.seconds
            ) * 1000000 + elapsed.microseconds
            day = start.date().isoformat()
            sessions.append(
                {
                    "session": row["session"],
                    "start_utc": canonical(start),
                    "end_utc": canonical(end),
                    "seconds": microseconds / 1000000,
                    "start_utc_date": day,
                }
            )
            bucket = daily.setdefault(day, {"sessions": 0, "microseconds": 0})
            bucket["sessions"] += 1
            bucket["microseconds"] += microseconds
            total_microseconds += microseconds
    return {
        "sessions": sessions,
        "daily": [
            {
                "date": day,
                "sessions": daily[day]["sessions"],
                "seconds": daily[day]["microseconds"] / 1000000,
            }
            for day in sorted(daily)
        ],
        "total_seconds": total_microseconds / 1000000,
    }, 0


def main():
    parser = argparse.ArgumentParser(description="Report session durations in UTC.")
    parser.add_argument("input", help="Directory containing sessions.csv")
    parser.add_argument("--output", required=True, help="Destination JSON file")
    args = parser.parse_args()
    report, status = build_report(args.input)
    Path(args.output).write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return status


if __name__ == "__main__":
    raise SystemExit(main())
