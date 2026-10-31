"""Construct the declared Group2 class-flow model from operating raw data, never an MPS or solution."""
import argparse
from collections import Counter, defaultdict
import datetime
import importlib.metadata
import json
import math
from pathlib import Path
import zipfile

from pyscipopt import Model, quicksum
from export_operational_plan import raw_data, number


def build(raw_archive, instance, periods, out):
    out.mkdir(parents=True, exist_ok=False)
    with zipfile.ZipFile(raw_archive) as archive:
        metadata, ports, classes, vessels, travel = raw_data(archive, instance)
    if periods <= 0 or periods > int(number(metadata, "numPeriods")):
        raise ValueError("model_horizon_outside_raw_data")
    if sorted(ports) != list(range(len(ports))) or sorted(classes) != list(range(len(classes))):
        raise ValueError("raw_contiguous_port_class_identity")
    if int(number(metadata, "numVesselClasses")) != len(classes):
        raise ValueError("raw_declared_class_count")
    names = {p["name"][0]: j for j, p in ports.items()}
    fleet = Counter(int(number(v, "vesselClass")) for v in vessels)
    declared_fleet = list(map(int, metadata["numTermVesselsInClass"]))
    if [fleet[c] for c in classes] != declared_fleet:
        raise ValueError("raw_declared_initial_class_fleet")
    sources = Counter()
    for vessel in vessels:
        if vessel["type"] != ["Term"]:
            raise ValueError("group2_terminal_fleet_required")
        c, j, t = int(number(vessel, "vesselClass")), names[vessel["initialPort"][0]], int(number(vessel, "firstTimeAvailable"))
        if t < 0 or t >= periods:
            raise ValueError("initial_availability_outside_horizon")
        sources[c, j, t] += 1
    signs, rates = {}, {}
    for j, port in ports.items():
        if port["type"] not in [["Loading"], ["Discharge"]]:
            raise ValueError("group2_port_role")
        signs[j] = 1 if port["type"] == ["Loading"] else -1
        rates[j] = list(map(float, port["production" if signs[j] == 1 else "consumption"]))[:periods]
        if len(rates[j]) != periods or any(not math.isfinite(x) or x < 0 for x in rates[j]):
            raise ValueError("raw_rate_prefix")
    model = Model(instance)
    model.setMinimize()
    outgoing, incoming, services = defaultdict(list), defaultdict(list), defaultdict(list)
    source_node = -len(ports) - 1
    arc_counts = Counter()

    def arc(i, t, j, u, c, lower, upper, cost, kind):
        name = f"x_({i},{t}),({j},{u}),{c},Term"
        variable = model.addVar(name=name, vtype="I", lb=lower, ub=upper, obj=cost)
        outgoing[c, i, t].append(variable)
        incoming[c, j, u].append(variable)
        if kind in {"travel", "exit"}:
            services[i, t].append((variable, number(classes[c], "capacity")))
        arc_counts[kind] += 1

    reward = number(metadata, "perPeriodRewardForFinishingEarly")
    for c, klass in classes.items():
        for (c0, j, t), count in sorted(sources.items()):
            if c0 == c:
                arc(source_node, -1, j, t, c, count, count, number(ports[j], "fixedPortFee"), "source")
        for i, port in ports.items():
            for t in range(periods):
                arc(i, t, source_node, periods, c, 0, fleet[c], -(periods - 1 - t) * reward, "exit")
                if t + 1 < periods:
                    arc(i, t, i, t + 1, c, 0, fleet[c], 0, "wait")
                for j, destination in ports.items():
                    if signs[i] == signs[j]:
                        continue
                    duration = travel[c, i, j]
                    if duration <= 0:
                        raise ValueError("positive_interport_travel_time")
                    if t + duration >= periods:
                        continue
                    distance = math.hypot(number(port, "x_coordinate") - number(destination, "x_coordinate"),
                                          number(port, "y_coordinate") - number(destination, "y_coordinate"))
                    factor = 1 if signs[i] == 1 else 1 - number(klass, "discountTravelingEmpty")
                    cost = distance * number(klass, "travelCostAsTermPerKm") * factor + number(destination, "fixedPortFee")
                    arc(i, t, j, t + duration, c, 0, 1, cost, "travel")
    stocks, alpha = {}, {}
    penalty = number(metadata, "spotMarketPricePerUnit")
    discount = number(metadata, "spotMarketDiscountFactor")
    for j, port in ports.items():
        for t in range(periods + 1):
            label = f"supplyAtNode_({j},{t})" if t < periods else f"endingSupplyInRegion_{j}"
            lower = number(port, "initialInventory") if t == 0 else 0
            upper = lower if t == 0 else number(port, "capacity")
            stocks[j, t] = model.addVar(name=label, vtype="C", lb=lower, ub=upper)
        for t in range(periods):
            alpha[j, t] = model.addVar(name=f"alphaSlack_({j},{t})", vtype="C", lb=0, ub=None,
                                      obj=penalty * discount ** t)
    for c in classes:
        for j in ports:
            for t in range(periods):
                model.addCons(quicksum(outgoing[c, j, t]) - quicksum(incoming[c, j, t]) == 0,
                              name=f"flowBalance_({j},{t}),{c},Term")
    for j, port in ports.items():
        for t in range(periods):
            model.addCons(stocks[j, t + 1] - stocks[j, t] + signs[j] * alpha[j, t]
                          + signs[j] * quicksum(capacity * var for var, capacity in services[j, t])
                          == signs[j] * rates[j][t], name=f"invBalanceRegion_({j},{t})")
            model.addCons(quicksum(var for var, capacity in services[j, t]) <= number(port, "numBerths"),
                          name=f"berthLimit_({j},{t})")
    mps = out / (instance + f"_t{periods}.mps")
    model.writeProblem(str(mps), trans=False, genericnames=False, verbose=False)
    result = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "instance": instance,
              "periods": periods, "raw_metadata_periods": int(number(metadata, "numPeriods")),
              "raw_archive": str(raw_archive), "model": str(mps), "model_variables": model.getNVars(),
              "model_constraints": model.getNConss(), "arc_counts": dict(arc_counts),
              "initial_class_fleet": dict(fleet), "initial_sources": [list(k) + [v] for k, v in sorted(sources.items())],
              "packages": {p: importlib.metadata.version(p) for p in ["pyscipopt", "numpy"]},
              "omitted_original_redundancies": "Zero dummy variables and fixed-zero possible source arcs; actual fleet source arcs are retained",
              "inputs_read": "Operating raw data only; no original MPS, known solution or known objective",
              "optimization_executed": False, "benchmark_score": None}
    (out / "construction.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    model.freeProb()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-archive", type=Path, required=True)
    parser.add_argument("--instance", required=True)
    parser.add_argument("--periods", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.raw_archive, args.instance, args.periods, args.out)), flush=True)


if __name__ == "__main__":
    main()
