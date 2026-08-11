# Continued Process Verification Trend Review

Use one `CPV-###` record for one approved monitoring question and compatible product/process-version dataset. This asset reports reproducible evidence and uncertainty; it does not set a threshold, declare state of control, approve validation, disposition product or direct a process change.

Canonical fields: `record_id`, `object_ids`, `value_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Review contract

- Site/product/process/version, lifecycle period and batch/lot cohort with explicit inclusions/exclusions.
- Approved CPV plan, question, CQA/CPP/attribute/control ID, method and predeclared criterion/source/version.
- Raw observation IDs, values/units, sampling time/location/method, censored/missing values and data corrections.
- Equipment/train/utility, material lot, operator shift or other stratification only when authorized and relevant.
- Statistical method/version, assumptions, denominator/sample count, time ordering, multiple-comparison handling and calculation.
- Trend/signal result as evidence under the approved method, not a process-state or validation conclusion.
- Process/change/deviation/CAPA/context links and counterevidence; preserve incompatible process versions separately.
- Source/system/method version/effective and observation dates, owner, Quality Unit and qualified process/statistics/lab/microbiology reviewers.
- Applicability, uncertainty, status, decision-not-made and stop/escalation.

## CPV-001 baseline

- Product/process/version/cohort: unknown
- CPV question/CQA/CPP/control/criterion: unknown
- Raw values/units/method/missingness: unknown
- Statistical plan/calculation/result: not performed
- Change/deviation/CAPA/counterevidence: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no trend threshold, process state, parameter change, validation, release or GMP decision
- Stop/escalation: Process Validation and Quality Unit must establish a current approved CPV plan and compatible evidence

Never manufacture sample size, limits or “three-batch” rules. Stop on mixed process versions, unqualified methods, active quality/contamination concerns or requests for live control.
