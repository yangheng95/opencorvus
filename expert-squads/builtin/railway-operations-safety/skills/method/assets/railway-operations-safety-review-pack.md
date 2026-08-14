# Railway Operations Safety Review Pack

Complete this pack only after the timetable-capacity, signalling/infrastructure-risk, and service-occurrence-assurance branches have produced independently traceable artifacts. It is the explicit join record, not an operational plan or safety approval.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Join identity and provenance

- **review_pack_id:** `ROS-###`
- **network / operating scope / jurisdiction:**
- **evidence cutoff / time zone / operating-day convention:**
- **baseline artifact path, version and digest:**
- **timetable-capacity artifact path, version and digest:**
- **signalling-risk artifact path, version and digest:**
- **service-occurrence artifact path, version and digest:**
- **source authorities and effective dates:**
- **accountable owner:**
- **qualified reviewers:** timetable/capacity; controller/signaller; signalling/infrastructure; railway undertaking; rolling-stock/crew; safety/investigation; regulatory as applicable.
- **applicability and exclusions:**
- **uncertainty and unresolved evidence gaps:**
- **status:** draft / branch-complete / contradiction-review / qualified-review / human-approved.
- **decision not made:** no route, signal, point, speed, movement authority, timetable, platform, dispatch, possession, isolation, maintenance release, occurrence classification, emergency action or safety acceptance.
- **stop or escalation:** identify active danger, missing branch, version conflict, protected investigation, absent authority or criteria and the authorized recipient.

## Join completeness

| Branch                             | Artifact/version/digest | Stable IDs reconciled | Cutoff/time compatible | Source authority current | Unknowns preserved | Owner/reviewer | Status |
| ---------------------------------- | ----------------------- | --------------------- | ---------------------- | ------------------------ | ------------------ | -------------- | ------ |
| Timetable and capacity             | unknown                 | no                    | unknown                | unknown                  | yes                | unassigned     | draft  |
| Signalling and infrastructure risk | unknown                 | no                    | unknown                | unknown                  | yes                | unassigned     | draft  |
| Service occurrence and assurance   | unknown                 | no                    | unknown                | unknown                  | yes                | unassigned     | draft  |

## Integrated findings and contradictions

For every joined finding record `ROS-F-###`, linked `TPC/SIR/SOA` IDs, train/path/route/asset/event/time keys, source locations and versions, units, existing controls, counterevidence, applicability, uncertainty, owner, qualified reviewer and status. Put incompatible claims in a contradiction row; do not average, rank or silently replace them.

## Bounded review options and human decisions

List only evidence-review options such as request current authority, reconcile IDs, re-baseline a dataset, obtain specialist assessment, verify an existing control or monitor a named indicator. For each, state evidence need, dependency, responsible owner, qualified reviewer, review date, stop condition and `decision-not-made`. Record the authorized human’s later decision and evidence version in a separate field; the agent never fills it on the decision maker’s behalf.
