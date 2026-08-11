# Permit, Sampling and Possible-excursion Review Pack

Use this file both for source-addressable monitoring traces and as the explicit join pack after all three branch artifacts exist. It supports certified and qualified review; it does not interpret a permit, validate laboratory data, determine/report compliance, authorize discharge/bypass/overflow, declare drinking-water safety, issue public notice or direct emergency response.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Join provenance

- **review_pack_id:** `PER-###`
- **system/facility/trains/jurisdiction and evidence cutoff/time zone:**
- **operating baseline path/version/digest:**
- **flow-quality-mass ledger path/version/digest:**
- **process-monitoring evidence path/version/digest:**
- **asset-reliability register path/version/digest:**
- **permit/operating-plan source locations, authorities, versions and effective dates:**
- **laboratory methods/versions, detection/reporting limits and observation dates:**
- **accountable owner:**
- **qualified reviewers:** certified operator, process/asset engineer, laboratory QA, maintenance/electrical/instrumentation/safety, environmental compliance, public health, legal/privacy and regulator as applicable.
- **applicability / uncertainty / exclusions / status:**
- **decision_not_made:** no process control, safety declaration, result validation, discharge, bypass, overflow, compliance, report, notice, equipment release, design/capital or emergency decision.
- **stop_or_escalation:** missing branch/current authority/method, incompatible identity/unit/period, acute risk, active discharge/equipment event or protected data and recipient.

## Monitoring trace

For every `PER-M-###`, record exact permit/plan condition document and section/table; parameter; sample/location/frequency/period; required method or basis as supplied; sample/result IDs; value/unit/qualifier; method/version/detection or reporting limit; correction history; source/authority/version/effective and observation dates; comparison formula; evidence gap or `possible excursion`; owner; qualified reviewer; applicability; uncertainty; status; decision-not-made; and stop/escalation. “Possible excursion” is not a compliance conclusion.

## Branch completeness

| Branch                               | Artifact/version/digest | Facility/train/asset/sample/period keys reconcile | Units/methods compatible | Source authority current | Unknowns retained | Owner/reviewer | Status |
| ------------------------------------ | ----------------------- | ------------------------------------------------- | ------------------------ | ------------------------ | ----------------- | -------------- | ------ |
| Drinking-water treatment and quality | unknown                 | no                                                | unknown                  | unknown                  | yes               | unassigned     | draft  |
| Wastewater collection and treatment  | unknown                 | no                                                | unknown                  | unknown                  | yes               | unassigned     | draft  |
| Asset, monitoring and reliability    | unknown                 | no                                                | unknown                  | unknown                  | yes               | unassigned     | draft  |

## Integrated findings, contradictions and human decisions

For each `PER-F-###`, cite linked `FQM/TPM/ADR/PER-M` IDs, source locations/versions, values/units/methods, existing controls, counterevidence, applicability, uncertainty, owner, qualified reviewer and status. Keep incompatible samples, historian values, work orders and permit readings as contradictions. Allow only current-source request, identity/unit reconciliation, re-baseline, specialist review, monitoring or verification of an existing authorized control. Record any later human decision in a separate field with decision maker, date and evidence version; the agent never makes it.
