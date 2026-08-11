# Biopharmaceutical Manufacturing Quality Review Pack

Complete this explicit join only after all three independent branches produce source-addressable artifacts. It is not a regulated batch record, deviation/CAPA decision, validation approval, release authorization, submission or GMP certification.

Canonical fields: `record_id`, `object_ids`, `value_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Join provenance

- `review_pack_id`, site/area/process/product/version/batch scope, sterile applicability, cutoff/time zone and data boundary.
- Batch/genealogy artifact path/version/digest.
- Deviation/investigation/CAPA artifact path/version/digest.
- Validation/control-strategy artifact path/version/digest.
- Continued-verification artifact path/version/digest.
- Master/executed/specification/method/system sources, versions and effective/execution/observation dates.
- Accountable Manufacturing owner, Quality Unit/Qualified Person and process/validation, laboratory QA, microbiology/contamination, engineering/maintenance/utilities, statistics, data-integrity, regulatory/legal reviewers.
- Applicability, exclusions, uncertainty and status.
- Decision not made: no record/parameter/status change, result validation, root cause/impact/disposition, deviation/OOS/OOT/CAPA closure, protocol/report/change approval, equipment/area/batch release, recall/reporting, product-quality/sterility/GMP claim or submission.
- Stop/escalation: missing branch/current approved source, ID/version/audit conflict, unresolved lab status or active contamination/product-quality concern.

## Branch completeness

| Branch          | Artifact/version/digest | Product/process/batch keys reconcile | Approved sources current | Unknowns retained | Owner/reviewer | Status |
| --------------- | ----------------------- | ------------------------------------ | ------------------------ | ----------------- | -------------- | ------ |
| Batch/genealogy | unknown                 | no                                   | unknown                  | yes               | unassigned     | draft  |
| Deviation/CAPA  | unknown                 | no                                   | unknown                  | yes               | unassigned     | draft  |
| Validation/CPV  | unknown                 | no                                   | unknown                  | yes               | unassigned     | draft  |

For every finding, cite linked `BBG/DIC/PVC/CPV` IDs, exact sources/versions, values/units/methods, evidence/counterevidence, deviations/changes/controls, applicability, uncertainty, owner, reviewer and status. Preserve contradictions. Allow only current-source request, identity/unit/version reconciliation, evidence re-baseline, specialist review, monitoring or verification of an already authorized action. Record human decisions separately; the agent never makes them.
