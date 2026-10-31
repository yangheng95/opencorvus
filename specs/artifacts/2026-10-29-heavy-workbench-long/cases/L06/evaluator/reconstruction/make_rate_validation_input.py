"""Create the pre-registered synthetic rate-profile validation input; do not select on optimization results."""
import argparse
import datetime
import json
import math
from pathlib import Path
import random
import zipfile

from export_operational_plan import raw_data, number, fields, records


def serialize(items):
    return "\n".join(key + "  " + " ".join(values) for item in items for key, values in item.items()) + "\n"


def make(original_archive, original_instance, label, seed, periods, out):
    out.mkdir(parents=True, exist_ok=False)
    rng = random.Random(seed)
    with zipfile.ZipFile(original_archive) as source:
        metadata, ports, classes, vessels, travel = raw_data(source, original_instance)
        loading = [j for j, p in ports.items() if p["type"] == ["Loading"]]
        if len(loading) != 1:
            raise ValueError("validation_recipe_single_production_port")
        profiles, draws = {}, []
        for j in sorted(ports):
            if j == loading[0]:
                continue
            period = rng.choice([19, 23, 29])
            phase = rng.randrange(period)
            base = list(map(float, ports[j]["consumption"]))[:periods]
            if len(base) != periods:
                raise ValueError("validation_rate_prefix")
            profiles[j] = [max(0, math.floor(rate * (1 + .08 * math.sin(2 * math.pi * (t + phase) / period)) + .5))
                           for t, rate in enumerate(base)]
            draws.append({"port": j, "cycle_period": period, "phase": phase})
        profiles[loading[0]] = [sum(profiles[j][t] for j in profiles if j != loading[0]) for t in range(periods)]
        prefix = f"Group2_data_format_only_files/{original_instance}/"
        destination = f"Group2_data_format_only_files/{label}/"
        target = out / (label + ".raw.zip")
        with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED) as output:
            for name in ["metadata.txt", "vessel_data.txt", "vessel_class_data.txt", "loading_port_data.txt",
                         "discharge_port_data.txt", "travelTimes.txt", "distances.txt"]:
                raw = source.read(prefix + name)
                if name == "metadata.txt":
                    item = fields(raw.decode("utf-8")); item["numPeriods"] = [str(periods)]
                    raw = serialize([item]).encode("utf-8")
                elif name in {"loading_port_data.txt", "discharge_port_data.txt"}:
                    data = records(raw.decode("utf-8"))
                    for item in data:
                        j = int(number(item, "index"))
                        rate_field = "production" if item["type"] == ["Loading"] else "consumption"
                        item[rate_field] = list(map(str, profiles[j]))
                        if "revenue" in item:
                            item["revenue"] = item["revenue"][:periods]
                    raw = serialize(data).encode("utf-8")
                output.writestr(destination + name, raw)
            output.writestr(destination + "VALIDATION-ORIGIN.txt",
                            "Synthetic construction-validation input derived from the published operating schema.\n"
                            "Not an official MIRPLIB instance, company data, or future private benchmark test.\n")
    result = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "label": label,
              "source_instance": original_instance, "seed": seed, "periods": periods,
              "draws": draws, "rate_profiles": profiles, "raw_archive": str(target),
              "recipe": "Fixed8percent cyclic demand modulation, floor(x+0.5); production equals aggregate same-period demand",
              "unchanged": "Fleet, geometry, travel times, capacities, prices, berth limits and model rules",
              "scope": "Construction-validation input only; variability itself is not greater difficulty or future hidden-test evidence",
              "optimization_used_in_construction": False, "benchmark_score": None}
    (out / "recipe.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-archive", type=Path, required=True)
    parser.add_argument("--original-instance", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--periods", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    a = parser.parse_args()
    print(json.dumps(make(a.original_archive, a.original_instance, a.label, a.seed, a.periods, a.out)), flush=True)


if __name__ == "__main__":
    main()
