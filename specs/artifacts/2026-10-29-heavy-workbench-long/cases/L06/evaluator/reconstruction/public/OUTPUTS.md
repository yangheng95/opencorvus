# Complete delivery contract

Use any equivalent source language and ordinary file layout. Provide a source
map, exact dependencies, a native reproduction command and a programme argv
using assigned input/output placeholders {model}, {raw_archive}, {instance},
{out}. {optimization_seconds}=180 is available when your programme takes a
budget flag; a fixed-profile programme may declare the same allocation in its
source and command without that flag. The programme reads the full assigned input and writes
new outputs; source-only execution supplies no old output vectors or caches.

For each development experiment preserve the full finite variable dictionary,
genuine native objective claim, parameter choices, actual terminal/errors,
feasible incumbent events and bound scope. Preserve failures and dependencies
that did not run. Report actual setup/validation overhead separately.

The numeric output layout declares six semantic slots:

```json
{
  "values": "relative/full-plan.json",
  "reported_objective": {"file":"relative/native-result.json", "key":"actual_objective"},
  "arcs": "relative/arcs.csv",
  "paths": "relative/paths.csv",
  "ledger": "relative/port-period.csv",
  "costs": "relative/costs.csv"
}
```

If the objective file itself is a finite number, declare key:null. All paths are
relative to the actual output directory. JSON value dictionaries contain every
MPS variable; names refer to the supplied mathematical object, not a redefined
model. CSV semantic columns are in outputs.schema.json. Extra columns and any
row order are accepted; all required rows and unique semantic keys are required.
No author file names, directory names or anonymous path IDs are forced.

Deliver every positive original arc/count/cost/service, every port-period
inventory/production/consumption/service/alpha/berth row, a complete economic
decomposition and anonymous source-to-exit path decomposition. These must agree
with the actual vector and full assigned model.

The scientific report explains method design, actual comparable experiments,
mechanisms behind improvement or failure, operating economics, uncertainty and
scope. Include real rendered figures, not promised plots. A single feasible
value without comparison or explanation is less scientific evidence than an
actually controlled mechanism study. A source map and handoff must make each
reported result traceable to actual data and execution.

Declare the programme command in submission.json, for example:

```json
{
  "argv": ["python", "solve.py", "--model", "{model}", "--raw", "{raw_archive}", "--instance", "{instance}", "--out", "{out}", "--optimization-seconds", "{optimization_seconds}"],
  "numeric_layout": "relative/layout.json",
  "report": "relative/REPORT.md",
  "source_map": "relative/source-map.json",
  "reproduce": "relative/HANDOFF.md",
  "dependencies": "relative/requirements-lock.txt",
  "figures": ["relative/actual-figure.png"]
}
```

Your own native dependency environment may replace python when declared. The
command is an argv array, not a shell command. Do not refer to the evaluator,
private reference, other candidate projects or credentials. The human-readable
report and actual images remain original delivered bytes for independent review.

## Wire values and coverage

The complete typed/enumerated wire rules are in outputs.schema.json. Identifiers
(port/class/time/variable) refer to the provided MPS/raw and use exact integer
values where declared; decimal text such as1.0 is an integer value, not a forced
printing format. Model time is0..T-1, initial artificial source time is-1, and
exit destination time isT. Artificial source/sink port IDs follow the MPS.

kind is exactly initial_source, waiting, loaded_voyage, empty_return or
terminal_exit. Port role is Loading or Discharge. Cost component is one of those
five kinds, lost_production, stockout or original_objective_constant. These are
technical wire identifiers, not prose-language requirements. Include every
nonzero economic component uniquely; legal zero components may be omitted or
explicit0 within reconciliation tolerance. Extra explanation columns are allowed.

An initial_source or waiting arc has inventory_service_port and
inventory_service_time_index as empty CSV strings and signed_inventory_effect=0.
Other service arcs identify their actual origin service port/time. All remaining
numeric cells must be finite, with original costs and physical quantity units.
Each path has a unique ID and one unique consecutive sequence of step integers;
the first integer may be any origin. Only order and physical continuity matter.

MPS variable domains/integrality use absolute1e-6. Row feasibility uses
1e-6+1e-9*abs(rhs). Objective and ordinary operating reconciliation use
1e-6+1e-9*abs(expected). Inventory balance residuals use the same row-rhs scale,
including the residual CSV field. These are numerical tolerances, not scientific
quality thresholds. A valid expensive plan stays expensive.

## Static submission and assigned-run namespaces

submission.json is at the submitted project root. That captured source root is
the programme cwd. argv is an actual argument array: relative executable/script
paths refer to this source root; an absolute interpreter must be a declared
runtime. Placeholders expand to absolute assigned model/raw/output paths and
the assigned instance ID; optimization_seconds expands to180 when used. No shell
wrapper is added by the evaluator. Describe any necessary build step and generic
dependencies in the handoff before delivery.

report, source_map, reproduce, dependencies and figures in submission.json refer
to original static development deliverables relative to the submitted root.
They are preserved unchanged for scientific review. A per-input programme may
produce an additional report under its assigned out directory, separately named
from those static files.

numeric_layout is relative to each newly assigned out directory, not the static
project. The programme writes that layout on every run. All six numeric paths
inside it are relative to that same out directory; reported_objective.file is
also relative to out, and its explicit key selects a JSON field or null selects
the numeric file itself. No absolute/private/evaluator path or escape is valid.
All rows/vector/claims must come from this assigned execution.

Native exit0 means process completion, not mathematical or scientific success.
If no feasible plan was found, declare that fact and actual termination in the
run output; do not invent a finite objective/vector. An incomplete/invalid plan
has unavailable P, with dependent judgments unassessed, and does not become an
optimization maximum or fabricated0. A missing/invalid evaluator input, runtime
or reference is a facility failure, not a candidate failure. Preserve original
failures; no result-conditioned programme patch or substitute report is supplied.
