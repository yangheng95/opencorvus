from pathlib import Path
import json, os, sys

phase, name = sys.argv[1:3]
root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b64"
source = root / f"profile-{phase}/log/dev.log"
rows = []
for line in source.read_text(encoding="utf-8").splitlines():
    try:
        row = json.loads(line)
    except json.JSONDecodeError:
        continue
    data = row.get("data", {})
    if row.get("service") == "server" and row.get("message") == "request" and isinstance(data, dict):
        if data.get("method") == "GET" and data.get("path") == "/mission-skill/settings":
            rows.append({"time": row["time"], **data})
(root / (name + ".json")).write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
for row in rows:
    print(json.dumps(row))
