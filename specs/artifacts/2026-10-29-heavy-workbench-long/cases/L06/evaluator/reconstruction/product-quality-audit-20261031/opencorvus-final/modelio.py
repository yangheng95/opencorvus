"""Original free-format MPS reader and operating export, no solution inputs."""

import csv
import json
import math
import re
import zipfile
from collections import defaultdict, Counter
from pathlib import Path


def dump(path, obj):
    Path(path).write_text(json.dumps(obj, indent=2, allow_nan=False), encoding="utf-8")


def table(path, rows, fields=None):
    rows = list(rows)
    with Path(path).open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields or list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def read_mps(path):
    rows, cols, rhs, bounds, integer = {}, {}, {}, {}, set()
    section = None
    isint = False
    obj = None
    for line in Path(path).read_text().splitlines():
        p = line.split()
        if not p or p[0].startswith("*"):
            continue
        if p[0] in (
            "NAME",
            "ROWS",
            "COLUMNS",
            "RHS",
            "BOUNDS",
            "ENDATA",
            "RANGES",
            "OBJSENSE",
        ):
            section = p[0]
            if section == "RANGES":
                raise ValueError("Ranged rows are outside this declared family")
            continue
        if section == "OBJSENSE":
            assert p[0].upper() == "MIN"
        elif section == "ROWS":
            if p[0] == "N":
                obj = p[1]
            else:
                rows[p[1]] = p[0]
        elif section == "COLUMNS":
            if "'MARKER'" in p:
                isint = "'INTORG'" in p
                continue
            name = p[0]
            col = cols.setdefault(name, {})
            if isint:
                integer.add(name)
            for r, v in zip(p[1::2], p[2::2]):
                col[r] = col.get(r, 0) + float(v)
        elif section == "RHS":
            for r, v in zip(p[1::2], p[2::2]):
                rhs[r] = float(v)
        elif section == "BOUNDS":
            kind, _, name, *val = p
            b = bounds.setdefault(name, [0.0, math.inf])
            x = float(val[0]) if val else 0
            if kind in ("LO", "LI"):
                b[0] = x
            elif kind in ("UP", "UI"):
                b[1] = x
            elif kind == "FX":
                b[:] = [x, x]
            elif kind == "BV":
                b[:] = [0, 1]
                integer.add(name)
            elif kind == "FR":
                b[:] = [-math.inf, math.inf]
            elif kind == "MI":
                b[0] = -math.inf
            elif kind == "PL":
                b[1] = math.inf
            else:
                raise ValueError(kind)
            if kind in ("LI", "UI"):
                integer.add(name)
    matrix = {r: {} for r in rows}
    for n, col in cols.items():
        for r, a in col.items():
            if r != obj:
                matrix[r][n] = a
    return dict(
        rows=rows,
        cols=cols,
        rhs=rhs,
        bounds=bounds,
        integer=integer,
        matrix=matrix,
        obj=obj,
        constant=-rhs.get(obj, 0),
    )


def check_vector(m, values):
    errors = []
    if set(values) != set(m["cols"]):
        errors.append("variable dictionary coverage")
    max_row, max_domain = 0.0, 0.0
    for n in m["cols"]:
        x = values[n]
        assert math.isfinite(x), n
        lo, hi = m["bounds"].get(n, (0, math.inf))
        violation = max(0, lo - x, x - hi)
        if n in m["integer"]:
            violation = max(violation, abs(x - round(x)))
        max_domain = max(max_domain, violation)
        if violation > 1e-6:
            errors.append([n, violation])
    for r, coefs in m["matrix"].items():
        activity = math.fsum(a * values[n] for n, a in coefs.items())
        b = m["rhs"].get(r, 0)
        violation = {
            "E": abs(activity - b),
            "L": max(0, activity - b),
            "G": max(0, b - activity),
        }[m["rows"][r]]
        max_row = max(max_row, violation)
        if violation > 1e-6 + 1e-9 * abs(b):
            errors.append([r, violation])
    objective = m["constant"] + math.fsum(
        col.get(m["obj"], 0) * values[n] for n, col in m["cols"].items()
    )
    return dict(
        valid=not errors,
        errors=errors,
        variables=len(m["cols"]),
        rows=len(m["rows"]),
        max_row_violation=max_row,
        max_domain_violation=max_domain,
        objective=objective,
    )


def records(text):
    result, current = [], None
    for line in text.splitlines():
        p = line.split()
        if not p:
            continue
        if p[0] == "name":
            current = {}
            result.append(current)
        if current is not None:
            current[p[0]] = p[1:]
    return result


def read_raw(path, instance):
    # Match the exact assigned directory, not an old development vector.
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        prefixes = sorted(
            {n.rsplit("/", 1)[0] for n in names if n.endswith("/metadata.txt")}
        )
        matches = [p for p in prefixes if p.rsplit("/", 1)[-1] == instance]
        if not matches and len(prefixes) == 1:
            matches = prefixes
        if len(matches) != 1:
            raise ValueError(f"Ambiguous raw instance: {instance}, {prefixes}")
        prefix = matches[0]
        files = {
            n.rsplit("/", 1)[-1]: z.read(n).decode("utf-8-sig")
            for n in names
            if n.startswith(prefix + "/") and not n.endswith("/")
        }
    ports = {}
    for file in ("loading_port_data.txt", "discharge_port_data.txt"):
        for r in records(files[file]):
            ports[int(r["index"][0])] = r
    caps = {
        int(r["index"][0]): float(r["capacity"][0])
        for r in records(files["vessel_class_data.txt"])
    }
    return ports, caps, files


ARC = re.compile(r"x_\((-?\d+),(-?\d+)\),\((-?\d+),(-?\d+)\),(\d+),Term$")


def export(m, values, ports, caps, out):
    out = Path(out)
    T = 1 + max(
        int(re.search(r",([0-9]+)\)", r)[1])
        for r in m["rows"]
        if r.startswith("invBalanceRegion_")
    )
    arcs = []
    service, berths = defaultdict(float), defaultdict(float)
    cost = defaultdict(float)
    for n, x in values.items():
        if not n.startswith("x_") or x <= 1e-6:
            continue
        p, t, q, u, c = map(int, ARC.fullmatch(n).groups())
        kind = (
            "initial_source"
            if t == -1
            else "terminal_exit"
            if u == T
            else "waiting"
            if p == q
            else "loaded_voyage"
            if ports[p]["type"][0] == "Loading"
            else "empty_return"
        )
        serving = kind not in ("initial_source", "waiting")
        effect = (
            (-1 if ports[p]["type"][0] == "Loading" else 1) * caps[c] * round(x)
            if serving
            else 0
        )
        a = dict(
            original_variable=n,
            vessel_class=c,
            kind=kind,
            from_port=p,
            from_time_index=t,
            to_port=q,
            to_time_index=u,
            vessel_count=round(x),
            class_capacity=caps[c],
            original_cost_per_vessel=m["cols"][n].get(m["obj"], 0),
            cost_contribution=m["cols"][n].get(m["obj"], 0) * x,
            inventory_service_port=p if serving else "",
            inventory_service_time_index=t if serving else "",
            signed_inventory_effect=effect,
        )
        arcs.append(a)
        cost[kind] += a["cost_contribution"]
        if serving:
            service[p, t] += effect
            berths[p, t] += round(x)
    arcs.sort(
        key=lambda a: (a["vessel_class"], a["from_time_index"], a["original_variable"])
    )
    table(out / "arcs.csv", arcs)
    remaining = {a["original_variable"]: a["vessel_count"] for a in arcs}
    outgoing = defaultdict(list)
    for a in arcs:
        outgoing[a["vessel_class"], a["from_port"], a["from_time_index"]].append(a)
    paths = []
    for initial in [a for a in arcs if a["kind"] == "initial_source"]:
        for k in range(initial["vessel_count"]):
            path_id = f"c{initial['vessel_class']}-v{len(set(p['anonymous_path_id'] for p in paths))}"
            a, step = initial, 0
            while True:
                n = a["original_variable"]
                assert remaining[n] > 0
                remaining[n] -= 1
                paths.append(
                    dict(
                        anonymous_path_id=path_id,
                        step=step,
                        **{
                            key: a[key]
                            for key in (
                                "original_variable",
                                "vessel_class",
                                "kind",
                                "from_port",
                                "from_time_index",
                                "to_port",
                                "to_time_index",
                            )
                        },
                    )
                )
                if a["kind"] == "terminal_exit":
                    break
                a = next(
                    v
                    for v in outgoing[
                        a["vessel_class"], a["to_port"], a["to_time_index"]
                    ]
                    if remaining[v["original_variable"]] > 0
                )
                step += 1
    assert not any(remaining.values()), remaining
    table(out / "paths.csv", paths)
    ledger = []
    for p, raw in sorted(ports.items()):
        role = raw["type"][0]
        sign = 1 if role == "Loading" else -1
        rates = list(map(float, raw["production" if sign == 1 else "consumption"]))
        for t in range(T):
            r = f"invBalanceRegion_({p},{t})"
            before = values[f"supplyAtNode_({p},{t})"]
            after = (
                values[f"supplyAtNode_({p},{t + 1})"]
                if t + 1 < T
                else values[f"endingSupplyInRegion_{p}"]
            )
            n = f"alphaSlack_({p},{t})"
            alpha = values[n]
            rate = sign * rates[t]
            # Cross-check supplied raw against exact MPS, rather than replace either.
            assert abs(rate - m["rhs"].get(r, 0)) < 1e-6, (r, rate, m["rhs"].get(r, 0))
            effect = -sign * alpha
            residual = after - before - rate - service[p, t] - effect
            assert abs(residual) <= 1e-6 + 1e-9 * abs(m["rhs"].get(r, 0)), (r, residual)
            unit = m["cols"][n].get(m["obj"], 0)
            cost["lost_production" if sign == 1 else "stockout"] += unit * alpha
            ledger.append(
                dict(
                    port=p,
                    port_name=raw["name"][0],
                    role=role,
                    time_index=t,
                    stock_before=before,
                    signed_production_consumption=rate,
                    signed_vessel_service_inventory_effect=service[p, t],
                    alpha_loss_or_shortfall=alpha,
                    signed_alpha_effect=effect,
                    stock_after=after,
                    inventory_residual=residual,
                    berths_used=berths[p, t],
                    berths_available=float(raw["numBerths"][0]),
                    original_alpha_unit_penalty=unit,
                    alpha_cost=unit * alpha,
                )
            )
    cost["original_objective_constant"] = m["constant"]
    table(out / "port-period.csv", ledger)
    table(
        out / "costs.csv",
        [
            dict(component=k, original_objective_contribution=v)
            for k, v in sorted(cost.items())
        ],
    )
    return dict(
        periods=T,
        positive_arcs=len(arcs),
        paths=len({p["anonymous_path_id"] for p in paths}),
        ledger_rows=len(ledger),
        economic_components=dict(cost),
    )
