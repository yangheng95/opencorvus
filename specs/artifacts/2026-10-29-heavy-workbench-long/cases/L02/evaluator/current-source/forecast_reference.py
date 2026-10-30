"""Point reference: latest released versions, explicit missing exclusion, exact OLS."""
import argparse
from fractions import Fraction
import json
from pathlib import Path


def forecast(snapshot):
    latest = {}
    for r in snapshot["observations"]:
        key = r["series_id"], r["event_tick"]
        if key not in latest or r["revision_id"] > latest[key]["revision_id"]:
            latest[key] = r
    predictions = []
    for series in sorted(snapshot["series"]):
        points = [(tick, r["value"]) for (s, tick), r in latest.items() if s == series and r["quality_flag"] == "valid"]
        n = len(points)
        sx, sy = sum(x for x, y in points), sum(y for x, y in points)
        sxx, sxy = sum(x*x for x, y in points), sum(x*y for x, y in points)
        denominator = n*sxx-sx*sx
        if n < 2 or denominator == 0:
            raise ValueError("insufficient_history:" + series)
        slope = Fraction(n*sxy-sx*sy, denominator)
        intercept = (sy-slope*sx)/n
        for t in range(snapshot["origin"], snapshot["origin"]+snapshot["horizon"]):
            value = intercept+slope*t
            predictions.append({"series_id": series, "target_tick": t, "value": {"numerator": value.numerator, "denominator": value.denominator}})
    return {"format": "l02-point-forecasts/1", "origin": snapshot["origin"], "forecasts": predictions,
            "method": "ordinary least squares over highest published revision; latest missing rows explicitly excluded"}


if __name__ == "__main__":
    p = argparse.ArgumentParser();p.add_argument("--input", type=Path, required=True);p.add_argument("--out", type=Path, required=True);a = p.parse_args()
    try:
        result = forecast(json.loads(a.input.read_text(encoding="utf-8")))
    except (OSError, ValueError, KeyError, TypeError) as e:
        print(json.dumps({"status": "execution_failed", "error": str(e)}), flush=True);raise SystemExit(2)
    a.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"status": "prediction_completed", "prediction_count": len(result["forecasts"])}), flush=True)
