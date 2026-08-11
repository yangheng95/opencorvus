# Port Operations Integrated Review Pack

Complete this explicit join only after all three roots have supplied independently traceable artifacts. The pack reconciles evidence and qualified review gates; it is not a berth plan, vessel instruction, terminal dispatch, cargo release, customs/security decision or emergency procedure.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Join provenance

- **review_pack_id:** `MPO-###`
- **port / terminal / call / jurisdiction / operating scope:**
- **evidence cutoff / time zone:**
- **baseline artifact path, version and digest:**
- **vessel-call/berth artifact path, version and digest:**
- **terminal-flow artifact path, version and digest:**
- **cargo-document/custody artifact path, version and digest:**
- **source authorities / versions / effective and observation dates:**
- **accountable owner:**
- **qualified reviewers:** harbour/VTS/pilot/master, berth planner, terminal control/equipment/labor, documentation/dangerous-goods, customs/security, legal/privacy, regulatory/emergency as applicable.
- **applicability / exclusions / uncertainty:**
- **status:** draft, branch-complete, contradiction-review, qualified-review or human-approved.
- **decision not made:** no navigation, clearance, dispatch, handling, VGM acceptance, classification, stowage, customs/security release, pollution or emergency action.
- **stop or escalation:** missing branch/authority, ID/time/version conflict, live unsafe state, protected data or active incident plus authorized recipient.

## Branch completeness

| Branch                             | Artifact/version/digest | Call/cargo/time keys reconcile | Source authority current | Units compatible | Unknowns retained | Owner/reviewer | Status |
| ---------------------------------- | ----------------------- | ------------------------------ | ------------------------ | ---------------- | ----------------- | -------------- | ------ |
| Vessel call, berth and nautical    | unknown                 | no                             | unknown                  | unknown          | yes               | unassigned     | draft  |
| Terminal, yard and gate flow       | unknown                 | no                             | unknown                  | unknown          | yes               | unassigned     | draft  |
| Cargo document, safety and custody | unknown                 | no                             | unknown                  | unknown          | yes               | unassigned     | draft  |

## Integrated findings and contradictions

For each `MPO-F-###`, cite linked `VCB/TYG/CDS` IDs, vessel-call/berth/cargo/document/event keys, source locations and versions, values/units, existing statuses/controls, counterevidence, applicability, uncertainty, owner, qualified reviewer and status. Record contradictions without overwriting requested/predicted/confirmed/actual states.

## Bounded evidence actions and human decisions

Allow only requests for current authority, identity/unit reconciliation, dataset re-baseline, specialist review, monitoring or verification of an already authorized control. State evidence need, dependency, owner, reviewer, due/review date, stop condition and decision-not-made. A separate human-decision field may later record the authorized decision maker, date and evidence version; the agent never completes it as if authorized.
