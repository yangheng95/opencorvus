# Collection, Distribution and Asset Reliability Register

Use one `ADR-###` record per asset baseline, alarm/event, inspection, condition observation, failure, work order, downtime period, redundancy claim, energy-intensity calculation or evidence gap. This register does not establish equipment fitness, isolation, maintenance instructions, return to service, design adequacy or capital priority.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Required fields

- **record_id / hierarchy:** system, facility, area, train, parent asset, asset, instrument and work-order IDs.
- **asset class / function / service boundary:** distribution or collection pipe, pump, valve, tank, basin, process unit, electrical/instrumentation/support asset and exact duty.
- **capacity/value/unit:** nameplate or operating value with source and applicability; distinguish installed, available and in-service.
- **event chronology:** alarm, inspection, condition, failure, work request/order, outage and restoration evidence with timestamps/time zone and later corrections.
- **calculation:** availability, failure interval, backlog age or energy intensity with observation window, raw numerator/denominator, exclusions, conversion and unit.
- **criticality/level-of-service:** only owner-supplied rubric, dimension and source/version; do not create a score.
- **existing control/redundancy:** duty/standby or alternate path as documented, test/availability evidence, failure mode and unknowns.
- **source location / authority / version / effective and observation dates:** exact record/export/document locator.
- **owner / qualified reviewer:** certified operator/asset owner and competent process, maintenance, electrical, instrumentation, safety or finance/capital reviewer.
- **applicability / uncertainty / status:** asset state, service, window, data completeness and draft/verified/conflict/action-open/review/human-approved status.
- **decision_not_made:** no operation, isolation, maintenance prescription, release, reliability/safety certification, design or capital decision.
- **stop_or_escalation:** live alarm/unsafe condition, identity/state conflict, isolation request, missing authority or protected infrastructure data and recipient.

## ADR-001 — Baseline pending

- Hierarchy/asset/function/boundary: unknown
- Capacity/value/unit and state: unknown
- Event/work-order chronology/time zone: unknown
- Calculation/window/exclusions: not calculated
- Criticality/control/redundancy evidence: unknown
- Source/authority/version/effective/observation dates: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no equipment, maintenance, release, design, capital or safety decision
- Stop or escalation: certified operations and asset authorities must reconcile identity, state and current records

Absence of alarms or work orders in an extract means only that the extract contains none. Preserve planned/unplanned and failure/maintenance distinctions. Link to `FQM-###` and `TPM-###` only with compatible facility/train/asset/time keys.
