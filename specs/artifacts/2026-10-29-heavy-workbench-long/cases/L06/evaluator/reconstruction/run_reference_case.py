"""Run the existing reference method on one explicitly assigned full maritime input."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import traceback
from types import SimpleNamespace

from run_original_baseline import run_instance
from export_operational_plan import export
from construct_economic_bounds import construct
from assess_operating_delivery import assess


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n', encoding="utf-8")


def command(argv, prefix):
    record = {"argv": argv, "started_at": now()}
    with prefix.with_suffix(".stdout.txt").open("w", encoding="utf-8") as out, prefix.with_suffix(".stderr.txt").open("w", encoding="utf-8") as err:
        process = subprocess.Popen(argv, stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)
        record["launcher_pid"] = process.pid
        write(prefix.with_suffix(".started.json"), record)
        code = process.wait()
    record.update(finished_at=now(), native_exit=code)
    write(prefix.with_suffix(".terminal.json"), record)
    if code:
        raise RuntimeError(f"reference_case_step:{prefix.name}:{code}")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ["model", "raw-archive", "report-python", "out"]:
        p.add_argument("--"+name, type=Path, required=True)
    p.add_argument("--instance", required=True)
    a = p.parse_args(); a.out.mkdir(parents=True, exist_ok=False)
    write(a.out/"owner-started.json", {"at":now(), "actual_python_pid":os.getpid(), "argv":sys.argv,
          "numerical_profile":{"cold_solver_seconds":60,"class_pair_nominal_wall_seconds":120,"solver_threads":1,"seed":0},
          "scope":"First complete input-parameterized integration of existing reference, not a new algorithm, candidate or effective-hours claim"})
    try:
        cold_root=a.out/"cold";cold_root.mkdir()
        cold=run_instance(a.model.read_bytes(), a.instance, cold_root, a.model.name)
        if cold["independent_validation"] is None:
            write(a.out/"owner-terminal.json", {"at":now(),"native_exit":4,"status":"no_initial_feasible_plan","cold":cold,"later_dependencies":"unexecuted","total_score":None})
            raise SystemExit(4)
        initial=cold_root/a.instance; method_root=a.out/"method"
        command([sys.executable,"-u","-X","utf8","-B",str(Path(__file__).with_name("run_class_pair_study.py")),
                 "--closed-plan",str(initial),"--strategy","class-pairs","--method-wall-seconds","120","--out",str(method_root)],a.out/"method-command")
        method=json.loads((method_root/"execution-terminal.json").read_text(encoding="utf-8"))
        plan=method_root/"final-values.json";check=json.loads((method_root/"independent-original-model-check.json").read_text(encoding="utf-8"))
        operating=a.out/"operating";operating.mkdir()
        closure=export(SimpleNamespace(original_mps=a.model,values=plan,reported_objective=check["reported_objective"],
                      raw_archive=a.raw_archive,instance=a.instance,out=operating,computation_status="class_pair_pass_complete" if method["complete_single_pass"] else "class_pair_wall_end",
                      computation_scope="conditional_pass",original_model_bound=None))
        bounds=construct(a.model,plan,a.out/"bounds")
        layout={"values":"method/final-values.json","reported_objective":{"file":"method/independent-original-model-check.json","key":"reported_objective"},
                "arcs":"operating/class-arc-plan.csv","paths":"operating/anonymous-vessel-paths.csv","ledger":"operating/port-period-ledger.csv","costs":"operating/economic-components.csv"}
        write(a.out/"delivery-layout.json",layout)
        assessment=assess(SimpleNamespace(model=a.model,raw_archive=a.raw_archive,instance=a.instance,delivery=a.out,
                          layout=a.out/"delivery-layout.json",lower_certificate=a.out/"bounds/lower-certificate.json",upper_values=a.out/"bounds/upper-values.json",role="author_reference"))
        write(a.out/"numeric-assessment.json",assessment)
        if assessment["engineering_status"]!="numeric_delivery_valid_science_unreviewed":
            raise ValueError("reference_numeric_delivery_contract:"+str(assessment.get("error")))
        write(a.out/"case-facts.json",{"instance":a.instance,"cold":cold,"method":method,"operating":closure,"bounds":bounds,
                                       "source_model":str(a.model),"source_raw":str(a.raw_archive),"total_score":None,"scientific_review":"unreviewed"})
        command([str(a.report_python),"-X","utf8","-B",str(Path(__file__).with_name("render_reference_case.py")),"--run",str(a.out),"--out",str(a.out/"report")],a.out/"report-command")
        write(a.out/"owner-terminal.json",{"at":now(),"native_exit":0,"status":"complete_reference_numeric_and_report_delivery",
              "cold_cost":cold["independent_validation"]["independent_objective"],"final_cost":closure["original_cost"],
              "numeric_delivery":assessment["engineering_status"],"scientific_review":"unreviewed","whole_heavy_benchmark_qualified":False,"total_score":None})
    except BaseException as error:
        if not isinstance(error,SystemExit):
            write(a.out/"owner-error.json",{"at":now(),"type":type(error).__name__,"error":str(error),"traceback":traceback.format_exc()})
        raise


if __name__=="__main__":
    main()
