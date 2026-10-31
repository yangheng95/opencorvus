"""Native single-thread SCIP runner. Inputs are full assigned MPS and raw ZIP."""

import argparse
import json
import os
import platform
import sys
import time
import traceback
from pathlib import Path
from pyscipopt import Model, Eventhdlr, SCIP_EVENTTYPE, SCIP_PARAMEMPHASIS
import pyscipopt
from modelio import dump, read_mps, check_vector, read_raw, export


class Incumbents(Eventhdlr):
    def __init__(self, path):
        self.path = path
        self.events = []

    def eventinit(self):
        self.model.catchEvent(SCIP_EVENTTYPE.BESTSOLFOUND, self)

    def eventexit(self):
        self.model.dropEvent(SCIP_EVENTTYPE.BESTSOLFOUND, self)

    def eventexec(self, event):
        s = self.model.getBestSol()
        if s is None:
            return
        e = dict(
            solver_seconds=self.model.getSolvingTime(),
            objective=self.model.getSolObjVal(s),
            full_model_dual_bound=self.model.getDualbound(),
            nodes=self.model.getNNodes(),
        )
        self.events.append(e)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(e) + "\n")


def main():
    ap = argparse.ArgumentParser()
    for flag in ("model", "raw", "instance", "out"):
        ap.add_argument("--" + flag, required=True)
    ap.add_argument("--optimization-seconds", type=float, default=180)
    ap.add_argument(
        "--method", choices=["default", "feasibility"], default="feasibility"
    )
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if (out / "native-result.json").exists():
        raise FileExistsError(
            "Use a fresh output directory; records must not be overwritten"
        )
    start, cpu = time.perf_counter(), time.process_time()
    result = dict(
        instance=a.instance,
        method=a.method,
        argv=sys.argv,
        python=sys.version,
        platform=platform.platform(),
        pyscipopt=pyscipopt.__version__,
        optimization_allowance=a.optimization_seconds,
        solver_threads=1,
        bound_scope="full original integer MPS",
        status="setup",
        actual_objective=None,
    )
    dump(out / "run-registration.json", result)
    try:
        parsed = read_mps(a.model)
        ports, caps, raw = read_raw(a.raw, a.instance)
        dump(
            out / "raw-input-summary.json",
            dict(ports=ports, capacities=caps, supplied_file_names=list(raw)),
        )
        m = Model()
        m.setLogfile(str(out / "solver.log"))
        m.readProblem(a.model)
        if a.method == "feasibility":
            m.setEmphasis(SCIP_PARAMEMPHASIS.FEASIBILITY)
        m.setIntParam("parallel/maxnthreads", 1)
        m.setIntParam("lp/threads", 1)
        m.setIntParam("randomization/randomseedshift", 0)
        m.setRealParam("numerics/feastol", 1e-9)
        m.setRealParam("limits/time", a.optimization_seconds)
        m.writeParams(str(out / "parameters.set"), comments=True, onlychanged=False)
        events = Incumbents(out / "incumbents.jsonl")
        (out / "incumbents.jsonl").touch()
        m.includeEventhdlr(events, "incumbents", "Actual BESTSOLFOUND events only")
        setup = time.perf_counter() - start
        optstart, optcpu = time.perf_counter(), time.process_time()
        m.optimize()
        optwall, optcpusec = (
            time.perf_counter() - optstart,
            time.process_time() - optcpu,
        )
        result.update(
            status=str(m.getStatus()),
            setup_seconds=setup,
            optimization_wall_seconds=optwall,
            optimization_cpu_seconds=optcpusec,
            native_solving_seconds=m.getSolvingTime(),
            numerical_overrun_seconds=max(0, optwall - a.optimization_seconds),
            full_model_dual_bound=m.getDualbound(),
            native_gap=m.getGap(),
            nodes=m.getNNodes(),
            native_solutions=m.getNSols(),
            incumbent_event_count=len(events.events),
        )
        validation_start = time.perf_counter()
        s = m.getBestSol()
        if s is None:
            result["no_feasible_plan"] = True
        else:
            values = {v.name: m.getSolVal(s, v) for v in m.getVars(transformed=False)}
            dump(out / "values.json", values)
            result["actual_objective"] = m.getSolObjVal(s)
            checked = check_vector(parsed, values)
            checked["objective_matches_native"] = abs(
                checked["objective"] - result["actual_objective"]
            ) <= 1e-6 + 1e-9 * abs(checked["objective"])
            dump(out / "validation.json", checked)
            assert checked["valid"] and checked["objective_matches_native"], checked
            result["operations"] = export(parsed, values, ports, caps, out)
            dump(
                out / "layout.json",
                dict(
                    values="values.json",
                    reported_objective=dict(
                        file="native-result.json", key="actual_objective"
                    ),
                    arcs="arcs.csv",
                    paths="paths.csv",
                    ledger="port-period.csv",
                    costs="costs.csv",
                ),
            )
        result["validation_export_seconds"] = time.perf_counter() - validation_start
    except Exception:
        result["error"] = traceback.format_exc()
        (out / "error.txt").write_text(result["error"], encoding="utf-8")
        raise
    finally:
        result["total_wall_seconds"] = time.perf_counter() - start
        result["total_process_cpu_seconds"] = time.process_time() - cpu
        dump(out / "native-result.json", result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
