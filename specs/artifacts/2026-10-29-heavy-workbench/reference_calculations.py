"""Author-owned, model-free reference calculations for diagnostic checkpoints.

These are partial computational witnesses, not expert end-to-end gold submissions.
Inputs are original fictional records. regenerate() writes into a NEW destination.
"""

import csv
import json
import math
import random
import statistics as st
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path


def write_table(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def outputs(case, rows):
    """Compute four documented diagnostic tables solely from public inputs."""
    result = {}
    if case == "H01":
        cohort = [r for r in rows if int(r["eligible"]) == 1]
        result["cohort"] = [
            {
                "id": r["id"],
                "school": r["school"],
                "arm": r["arm"],
                "observed": int(r["post"] != ""),
            }
            for r in cohort
        ]
        effects = []
        for school in sorted({r["school"] for r in cohort}):
            group = [r for r in cohort if r["school"] == school and r["post"] != ""]
            effects.append(
                {
                    "school": school,
                    "arm": int(group[0]["arm"]),
                    "change": st.mean(
                        float(r["post"]) - float(r["pre"]) for r in group
                    ),
                }
            )
        result["schools"] = effects
        arms = [[r["change"] for r in effects if r["arm"] == arm] for arm in (0, 1)]
        effect = st.mean(arms[1]) - st.mean(arms[0])
        se = math.sqrt(sum(st.variance(a) / len(a) for a in arms))
        result["estimate"] = [
            {
                "id": "complete_case",
                "effect": effect,
                "se": se,
                "low_normal": effect - 1.96 * se,
                "high_normal": effect + 1.96 * se,
            }
        ]
        result["attrition"] = [
            {"arm": arm, "eligible": len(g), "missing": sum(r["post"] == "" for r in g)}
            for arm in (0, 1)
            for g in [[r for r in cohort if int(r["arm"]) == arm]]
        ]
    elif case == "H02":
        series = [float(r["value"]) for r in rows]
        forecasts, metrics, splits, ablations = [], [], [], []
        for origin in (168, 224, 280, 336):
            splits.append(
                {"origin": origin, "train_end": origin - 1, "test_end": origin + 27}
            )
            for model in ("last", "seasonal7", "mean28"):
                errors = []
                for horizon in range(28):
                    prediction = {
                        "last": series[origin - 1],
                        "seasonal7": series[origin - 7 + horizon % 7],
                        "mean28": st.mean(series[origin - 28 : origin]),
                    }[model]
                    forecasts.append(
                        {
                            "origin": origin,
                            "model": model,
                            "horizon": horizon + 1,
                            "prediction": prediction,
                        }
                    )
                    errors.append(abs(prediction - series[origin + horizon]))
                metrics.append(
                    {"origin": origin, "model": model, "mae": st.mean(errors)}
                )
            # An explicitly labelled leaky diagnostic, never a valid baseline.
            ablations.append(
                {
                    "origin": origin,
                    "oracle_future_mean": st.mean(series[origin : origin + 28]),
                }
            )
        result = dict(
            forecasts=forecasts, metrics=metrics, splits=splits, leakage_probe=ablations
        )
    elif case == "H03":

        def money(r):
            return (Decimal(r["amount"]) * Decimal(r["fx"])).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        ledger = [
            {
                "id": r["id"],
                "month": r["month"],
                "department": r["department"],
                "amount_cny": float(money(r)),
            }
            for r in rows
            if r["status"] == "posted"
        ]
        result["ledger"] = ledger
        result["variance"] = [
            {
                "month": month,
                "department": dept,
                "actual": float(
                    sum(
                        Decimal(str(r["amount_cny"]))
                        for r in ledger
                        if r["month"] == month and r["department"] == dept
                    )
                ),
                "budget": 18000,
            }
            for month in sorted({r["month"] for r in rows})
            for dept in ("engineering", "sales", "operations")
        ]
        result["cash"] = [
            {
                "month": month,
                "net": float(
                    sum(
                        money(r)
                        for r in rows
                        if r["month"] == month and r["status"] == "paid"
                    )
                ),
            }
            for month in sorted({r["month"] for r in rows})
        ]
        result["status_audit"] = [
            {"status": status, "count": sum(r["status"] == status for r in rows)}
            for status in ("posted", "paid", "void")
        ]
    elif case == "H04":
        customers = sorted({r["customer"] for r in rows})
        result["customers"] = [
            {"customer_id": i + 1, "legacy_key": key} for i, key in enumerate(customers)
        ]
        ids = {r["legacy_key"]: r["customer_id"] for r in result["customers"]}
        result["orders"] = [
            {
                "order_id": r["id"],
                "customer_id": ids[r["customer"]],
                "currency": r["currency"],
                "total_minor": int(Decimal(r["total"]) * 100),
            }
            for r in rows
        ]
        result["audit"] = [
            {
                "currency": c,
                "count": len(g),
                "total_minor": sum(int(Decimal(r["total"]) * 100) for r in g),
            }
            for c in ("CNY", "USD")
            for g in [[r for r in rows if r["currency"] == c]]
        ]
        result["refunds"] = [
            {"order_id": r["id"], "amount_minor": int(Decimal(r["total"]) * 100)}
            for r in rows
            if float(r["total"]) < 0
        ]
    elif case == "H05":
        unique, attempts = {}, {}
        for r in rows:
            key = (r["tenant"], r["event_id"])
            attempts[key] = attempts.get(key, 0) + 1
            unique[key] = r
        result["ledger"] = [
            {"tenant": key[0], "event_id": key[1], "amount": int(r["amount"])}
            for key, r in sorted(unique.items())
        ]
        result["duplicates"] = [
            {"tenant": key[0], "event_id": key[1], "attempts": n}
            for key, n in sorted(attempts.items())
            if n > 1
        ]
        result["totals"] = [
            {
                "tenant": tenant,
                "total": sum(
                    int(r["amount"]) for key, r in unique.items() if key[0] == tenant
                ),
            }
            for tenant in ("alpha", "beta", "gamma")
        ]
        result["replay"] = [
            {
                "pass": n,
                "distinct": len(unique),
                "total": sum(int(r["amount"]) for r in unique.values()),
            }
            for n in (1, 2)
        ]
    elif case == "H06":
        result["demand"] = [
            {
                "sku": sku,
                "units": sum(int(r["demand"]) for r in rows if r["sku"] == sku),
            }
            for sku in sorted({r["sku"] for r in rows})
        ]
        result["landed"] = [
            {
                "sku": r["sku"],
                "week": r["week"],
                "regular": int(r["unit_cost"]) + 2,
                "expedite": int(r["unit_cost"]) + 12,
            }
            for r in rows
        ]
        result["capacity"] = [
            {
                "sku": r["sku"],
                "week": r["week"],
                "expedite_needed_without_inventory": max(
                    0, int(r["demand"]) - int(r["capacity"])
                ),
            }
            for r in rows
        ]
        result["baseline"] = [
            {
                "id": "just_in_time",
                "cost": sum(
                    min(int(r["demand"]), int(r["capacity"]))
                    * (int(r["unit_cost"]) + 2)
                    + max(0, int(r["demand"]) - int(r["capacity"]))
                    * (int(r["unit_cost"]) + 12)
                    for r in rows
                ),
            }
        ]
    elif case == "H07":
        included = [
            r
            for r in rows
            if r["design"] == "randomized" and int(r["followup_weeks"]) >= 8
        ]
        result["screening"] = [
            {"study": r["study"], "included": int(r in included)} for r in rows
        ]
        result["effects"] = [
            {
                "study": r["study"],
                "effect": float(r["effect"]),
                "weight": 1 / float(r["se"]) ** 2,
            }
            for r in included
        ]
        w = sum(1 / float(r["se"]) ** 2 for r in included)
        pooled = sum(float(r["effect"]) / float(r["se"]) ** 2 for r in included) / w
        result["pooled"] = [
            {"id": "fixed_effect", "effect": pooled, "se": math.sqrt(1 / w)}
        ]
        result["bias"] = [
            {"risk": risk, "count": sum(r["risk"] == risk for r in included)}
            for risk in ("low", "high")
        ]
    elif case == "H08":
        finish = {}
        for r in rows:
            finish[r["task"]] = int(r["duration"]) + max(
                [finish[p] for p in r["deps"].split("|") if p] or [0]
            )
        result["earliest"] = [
            {
                "task": r["task"],
                "start": finish[r["task"]] - int(r["duration"]),
                "finish": finish[r["task"]],
            }
            for r in rows
        ]
        result["costs"] = [
            {"task": r["task"], "cost": int(r["duration"]) * int(r["daily_cost"])}
            for r in rows
        ]
        result["roles"] = [
            {
                "role": role,
                "person_days": sum(
                    int(r["duration"]) for r in rows if r["role"] == role
                ),
            }
            for role in sorted({r["role"] for r in rows})
        ]
        result["bounds"] = [
            {
                "id": "dependency_only",
                "days": max(finish.values()),
                "cost": sum(r["cost"] for r in result["costs"]),
            }
        ]
    elif case == "H09":
        scored = [
            {
                "learner": r["learner"],
                "topic": r["topic"],
                "score": int(r["score"]),
                "mastered": int(int(r["score"]) >= 70),
            }
            for r in rows
        ]
        result["scores"] = scored
        result["mastery"] = [
            {
                "topic": topic,
                "count": sum(r["mastered"] for r in scored if r["topic"] == topic),
            }
            for topic in ("sql", "pipelines", "quality", "governance")
        ]
        result["cohorts"] = [
            {
                "cohort": c,
                "count": len({r["learner"] for r in rows if r["cohort"] == c}),
            }
            for c in ("novice", "experienced")
        ]
        result["support"] = [
            {
                "learner": learner,
                "topics_below_70": sum(
                    int(r["score"]) < 70 for r in rows if r["learner"] == learner
                ),
            }
            for learner in sorted({r["learner"] for r in rows})
        ]
    elif case == "H10":
        result["daily"] = [
            {
                "site": site,
                "day": day,
                "kwh": sum(
                    float(r["kwh"])
                    for r in rows
                    if r["site"] == site and int(r["day"]) == day
                ),
            }
            for site in ("A", "B", "C")
            for day in range(1, 31)
        ]
        result["baseline"] = [
            {
                "site": site,
                "cost": sum(
                    float(r["kwh"]) * float(r["tariff"])
                    for r in rows
                    if r["site"] == site
                ),
            }
            for site in ("A", "B", "C")
        ]
        result["peak"] = [
            {
                "site": site,
                "kw": max(float(r["kwh"]) for r in rows if r["site"] == site),
            }
            for site in ("A", "B", "C")
        ]
        result["stress"] = [
            {
                "site": site,
                "cost_plus20": 1.2
                * sum(
                    float(r["kwh"]) * float(r["tariff"])
                    for r in rows
                    if r["site"] == site
                ),
            }
            for site in ("A", "B", "C")
        ]
    else:
        raise ValueError(case)
    return result


def make_inputs():
    rng = random.Random(20261029)
    all_rows = {}
    all_rows["H01"] = [
        dict(
            id=f"P{s:02d}-{p:02d}",
            school=f"S{s:02d}",
            arm=s % 2,
            eligible=int(p != 0),
            pre=(pre := 40 + p % 13 + s % 7),
            post=""
            if (p + s) % 17 == 0
            else pre + 3 + (s % 2) * 4 + rng.randint(-4, 4),
        )
        for s in range(24)
        for p in range(30)
    ]
    all_rows["H02"] = [
        dict(t=t, value=round(80 + t * 0.08 + (t % 7) * 2 + rng.gauss(0, 1), 5))
        for t in range(392)
    ]
    all_rows["H03"] = [
        dict(
            id=f"TX{i:04d}",
            month=f"2026-{1 + i % 12:02d}",
            department=("engineering", "sales", "operations")[(i // 12) % 3],
            amount=(-1 if i % 19 == 0 else 1) * (300 + i % 700),
            currency="USD" if i % 5 == 0 else "CNY",
            fx=7.1 if i % 5 == 0 else 1,
            status=("void" if i % 23 == 0 else "paid" if i % 3 == 0 else "posted"),
        )
        for i in range(1080)
    ]
    all_rows["H04"] = [
        dict(
            id=f"O{i:04d}",
            customer=f"C{i % 71:03d}",
            currency="USD" if i % 4 == 0 else "CNY",
            total=f"{(-1 if i % 29 == 0 else 1) * (12 + i % 300)}.{i % 100:02d}",
        )
        for i in range(600)
    ]
    events = [
        dict(
            tenant=t,
            event_id=f"E{i:04d}",
            amount=100 + i % 300,
            received_at=f"2026-10-01T{(i // 60) % 24:02d}:{i % 60:02d}:00Z",
        )
        for t in ("alpha", "beta", "gamma")
        for i in range(240)
    ]
    events += [dict(r) for i, r in enumerate(events) if i % 7 == 0]
    rng.shuffle(events)
    all_rows["H05"] = events
    all_rows["H06"] = [
        dict(
            sku=f"SKU{s}",
            week=w,
            demand=30 + (s * 13 + w * 7) % 50,
            capacity=45 + s * 2,
            unit_cost=20 + s * 3,
        )
        for s in range(6)
        for w in range(1, 13)
    ]
    all_rows["H07"] = [
        dict(
            study=f"R{i:02d}",
            design="observational" if i % 5 == 0 else "randomized",
            followup_weeks=4 if i % 7 == 0 else 12,
            effect=round(0.1 + (i % 9) * 0.035, 3),
            se=round(0.06 + i % 5 * 0.012, 3),
            risk="high" if i % 4 == 0 else "low",
            population="adult_training",
            source_kind="fictional_study",
        )
        for i in range(30)
    ]
    roles = [
        "analyst",
        "engineer",
        "engineer",
        "trainer",
        "engineer",
        "analyst",
        "engineer",
        "trainer",
        "engineer",
        "engineer",
        "analyst",
        "trainer",
        "engineer",
        "analyst",
        "engineer",
        "trainer",
        "engineer",
        "engineer",
        "analyst",
        "trainer",
        "engineer",
        "analyst",
        "engineer",
        "trainer",
    ]
    all_rows["H08"] = [
        dict(
            task=f"T{i:02d}",
            duration=1 + i % 5,
            deps="|".join(
                f"T{p:02d}"
                for p in ([] if i < 4 else [i - 4])
                + ([i - 2] if i >= 6 and i % 3 == 0 else [])
            ),
            role=roles[i],
            daily_cost={"analyst": 800, "engineer": 1200, "trainer": 600}[roles[i]],
        )
        for i in range(24)
    ]
    all_rows["H09"] = [
        dict(
            learner=f"L{i:02d}",
            topic=topic,
            score=35 + (i * 17 + j * 13) % 66,
            cohort="novice" if i < 12 else "experienced",
        )
        for i in range(24)
        for j, topic in enumerate(("sql", "pipelines", "quality", "governance"))
    ]
    all_rows["H10"] = [
        dict(
            site=site,
            day=day,
            hour=hour,
            kwh=round(
                30
                + si * 10
                + 18 * int(8 <= hour <= 18)
                + (day % 7) * 2
                + rng.random() * 3,
                3,
            ),
            tariff=0.95 if 17 <= hour <= 21 else 0.62 if 8 <= hour <= 16 else 0.3,
        )
        for si, site in enumerate(("A", "B", "C"))
        for day in range(1, 31)
        for hour in range(24)
    ]
    # Normalize as CSV to guarantee identical parse semantics on the actual package.
    return {
        key: [{k: str(v) for k, v in row.items()} for row in rows]
        for key, rows in all_rows.items()
    }


def feasible_witness(case, rows, scenario="base"):
    """Construct feasible diagnostic witnesses. These are not optimized expert solutions."""
    plan = []
    if case == "H06":
        for row in rows:
            capacity = int(row["capacity"])
            if scenario == "stress" and 6 <= int(row["week"]) <= 8:
                capacity = math.floor(capacity * 0.8)
            regular = min(int(row["demand"]), capacity)
            plan.append(
                dict(
                    sku=row["sku"],
                    week=row["week"],
                    regular=regular,
                    expedite=int(row["demand"]) - regular,
                    closing_inventory=0,
                )
            )
    elif case == "H08":
        finish, available = {}, {}
        for row in rows:
            start = max(
                [finish[p] for p in row["deps"].split("|") if p]
                + [available.get(row["role"], 0)]
            )
            duration = int(row["duration"]) + (
                3 if scenario == "stress" and row["task"] == "T07" else 0
            )
            end = start + duration
            finish[row["task"]] = end
            available[row["role"]] = end
            plan.append(dict(task=row["task"], start=start, finish=end))
    elif case == "H10":
        efficiency = 0.9 if scenario == "efficiency" else 0.95
        for row in rows:
            first = row["site"] == "A" and row["day"] == "1"
            charge = 1 if first and row["hour"] == "0" else 0
            discharge = efficiency**2 if first and row["hour"] == "1" else 0
            plan.append(
                dict(
                    site=row["site"],
                    day=row["day"],
                    hour=row["hour"],
                    capacity_kwh=50 if row["site"] == "A" else 0,
                    charge_kwh=charge,
                    discharge_kwh=discharge,
                    soc_kwh=efficiency if charge else 0,
                    grid_kwh=float(row["kwh"]) + charge - discharge,
                )
            )
    else:
        raise ValueError(case)
    return plan


def regenerate(destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    catalog = {}
    for case, rows in make_inputs().items():
        write_table(destination / "inputs" / case / "records.csv", rows)
        tables = outputs(case, rows)
        catalog[case] = {}
        for name, records in tables.items():
            write_table(destination / "oracle" / case / f"{name}.csv", records)
            sample = records[0]
            catalog[case][name] = {
                "columns": list(sample),
                "numeric": [
                    k for k, v in sample.items() if isinstance(v, (float, int))
                ],
            }
    (destination / "catalog.json").write_text(
        json.dumps(catalog, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    regenerate(parser.parse_args().destination)
