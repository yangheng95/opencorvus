"""Read original XLSX records and independently calculate the public quantities."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import openpyxl

MAP = {"Wrike Transition Intiative": "Wrike Transition Initiative"}
WEEKS = ["Mar. 3", "Mar. 10", "Mar. 17", "Mar. 24"]


def calculate(source):
    registry = list(openpyxl.load_workbook(source / "WDTStakeholderRegistry.xlsx", data_only=True).active.values)[1:]
    budget = list(openpyxl.load_workbook(source / "MarchBudget.xlsx", data_only=True).active.values)[1:]
    staff = {r[0]: r[1:4] for r in registry if r[0]}
    budgets = {r[0]: float(r[1]) for r in budget if r[0]}
    if len(staff) != 23 or len(budgets) != 9:
        raise ValueError("SOURCE_POPULATION_MISMATCH")
    raw, totals = [], defaultdict(lambda: defaultdict(float))
    book = openpyxl.load_workbook(source / "WDTTimekeepingExport_1.xlsx", data_only=True)
    for week in WEEKS:
        rows = list(book[week].values)
        for row in rows[1:]:
            if row[0] is None:
                continue
            for col in range(1, 11):
                project = MAP.get(rows[0][col], rows[0][col])
                if project != "Admin" and project not in budgets:
                    raise ValueError("UNMAPPED_PROJECT:" + str(project))
                h = 0.0 if row[col] is None else float(row[col])
                if h < 0:
                    raise ValueError("INVALID_HOURS")
                raw.append([week, row[0], rows[0][col], project, h])
                totals[row[0]][project] += h
    people, departments, projects = [], {}, []
    for person in [*staff, *sorted(set(totals) - set(staff))]:
        d = totals[person]
        project = sum(v for k, v in d.items() if k != "Admin")
        admin = d["Admin"]
        role, department, employment = staff.get(person, [None, None, None])
        nominal = (168.0 if employment == "FT" else 84.0) if employment else None
        available = nominal * .85 if nominal is not None else None
        allocation = project / available if available is not None else None
        status = "unknown" if allocation is None else "under" if allocation < .6 else "over" if allocation > .9 else "within"
        people.append([person, department, employment, nominal, available, project, admin, project + admin, allocation, status])
        if department:
            result = departments.setdefault(department, [department, 0.0, 0.0])
            result[1] += nominal
            result[2] += project + admin
    deps = []
    for row in departments.values():
        ratio = row[2] / row[1]
        deps.append(row + [ratio, "under" if ratio < .95 else "over" if ratio > 1.05 else "within"])
    for project, b in budgets.items():
        actual = sum(person[project] for person in totals.values())
        projects.append([project, b, actual, actual - b, "over" if actual > b else "within"])
    return {"registry": [[k, *v] for k, v in staff.items()], "raw": raw, "budgets": list(budgets.items()),
            "people": people, "departments": deps, "projects": projects,
            "recorded_h": sum(x[7] for x in people), "unassigned_h": sum(x[7] for x in people if x[1] is None),
            "registered_h": sum(x[7] for x in people if x[1] is not None),
            "period": "supplied four-sheet March export; March31 activity unknown"}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    a = p.parse_args()
    facts = calculate(a.source)
    a.output.write_text(json.dumps(facts, indent=2), encoding="utf-8")
    print(json.dumps({k: facts[k] for k in ["recorded_h", "unassigned_h", "registered_h", "departments", "projects"]}))
