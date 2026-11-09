from pathlib import Path
import json, os
from datetime import datetime

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b64"
read = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
rows = read("after-live-requests.json")
when = lambda text: datetime.fromisoformat(text.replace("Z", "+00:00"))
result = {}
for label, filename, second_key in [
    ("repeat", "pending-repeat-observation.json", "after"),
    ("move", "moved-focus-observation.json", "afterTab"),
]:
    events = read(filename)
    first, second, settled = events["before"], events[second_key], events["settled"]
    started = [row for row in rows if row["status"] == "started" and when(row["time"]) <= when(first["at"])]
    request = started[-1]
    completed = [row for row in rows if row["status"] == "completed" and row["requestID"] == request["requestID"]]
    assert len(completed) == 1 and completed[0]["statusCode"] == 200
    completion = completed[0]
    assert when(request["time"]) <= when(first["at"]) <= when(second["at"]) < when(completion["time"]) <= when(settled["at"])
    in_window = [row for row in rows if row["status"] == "started" and when(request["time"]) <= when(row["time"]) <= when(settled["at"])]
    assert [row["requestID"] for row in in_window] == [request["requestID"]]
    assert first["busy"] == second["busy"] == "true"
    assert first["ariaDisabled"] == second["ariaDisabled"] == "true"
    assert first["focusUi"] == "mission-skill-refresh"
    assert first["nativeDisabled"] == second["nativeDisabled"] == False
    if label == "repeat":
        assert events["key"] == "delivered"
        assert second["focusUi"] == settled["focusUi"] == "mission-skill-refresh"
    else:
        assert second["focusLabel"] == settled["focusLabel"] == "Search Mission Skills"
    assert settled["busy"] is None
    result[label] = {"request": request, "completion": completion, "observed": events}
(root / "pending-verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({label: {"requestID": item["request"]["requestID"], "duration": item["completion"]["duration"], "settledFocus": item["observed"]["settled"]["focusLabel"]} for label, item in result.items()}))
