# Process Validation and Control-strategy Trace Matrix

Use one `PVC-###` record for one lifecycle requirement, CQA, material attribute, process step/CPP, control, method, sampling/statistical rationale, qualification result or evidence gap. This matrix cannot approve validation, set limits or release equipment/areas/batches.

Canonical fields: `record_id`, `object_ids`, `value_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Trace fields

- Site/facility/area/process/product/version and lifecycle stage: process design, process qualification or continued process verification.
- CQA/CPP/material attribute/control IDs and definitions exactly from current approved sources.
- Process step, equipment/train/utility/computerized-system IDs and qualification/calibration/maintenance status as supplied.
- Approved range/criterion and unit; never derive a new limit.
- Monitoring/control, analytical method/version, sample point/type/frequency, statistical plan and rationale source/version.
- Cleaning, hold-time, transport, contamination-control, environmental/utility and sterile/non-sterile applicability.
- Protocol/report/batch/result IDs, raw value/unit, calculation/statistical method as supplied, exclusions/censored/missing data.
- Linked deviation/change/CAPA, counterevidence, owner, Quality Unit and qualified validation/process/statistics/microbiology/engineering reviewers.
- Source/effective/observation dates, applicability, uncertainty and status.
- Decision not made: no parameter/criterion, protocol/report approval, validation success, state of control, equipment/area/batch release, sterility or compliance decision.
- Stop/escalation: missing approved CQA/CPP/criterion, unclear equipment/method state, incompatible process versions, active quality concern or live change.

## PVC-001 baseline

- Product/process/lifecycle/CQA/CPP/control IDs: unknown
- Approved source/range/unit/method/sampling/statistics: unknown
- Equipment/utility/cleaning/contamination applicability: unknown
- Qualification/batch/result/deviation links: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no validation, control, release, sterility or GMP decision
- Stop/escalation: Validation and Quality Unit authorities must confirm current approved inputs
