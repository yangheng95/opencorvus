# Vessel Call, Berth and Nautical Services Evidence Plan

Use one `VCB-###` record per vessel-call milestone comparison, berth-window conflict, dimensional check or nautical-service dependency. This is planning evidence only. It does not clear, sequence, route, navigate, berth or sail a vessel and cannot substitute for harbour, Vessel Traffic Services, pilot or master authority.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Record contract

- **record_id / call_id / voyage_id / vessel IMO and MMSI:** preserve native identifiers and note conflicts.
- **port / terminal / berth / anchorage IDs:** include operating area and source namespace.
- **event chain:** requested, predicted, confirmed and actual ETA/ETB/ATB/ATD/ETD with semantic event, source, timestamp and named time zone.
- **occupation interval:** start/end events, formula and assumptions; never substitute a missing event.
- **dimensions and units:** length overall, beam, declared arrival/departure draft and air draft exactly as sourced.
- **criterion:** berth dimension, tidal/weather, under-keel, bridge/air-draft or service requirement with authority, source location, version and effective period.
- **nautical dependencies:** pilot, tug, mooring, VTS, tide, weather, hydrographic and security status as supplied; status is not clearance.
- **source and observation:** source URI/document/system locator, issuing authority, version/effective date and observation/retrieval date.
- **owner / qualified reviewer:** berth-planning owner plus harbour/VTS/pilot/master or other competent reviewer.
- **applicability / uncertainty / counterevidence:** vessel condition, cargo operation, tide/weather basis, prediction age, identity/unit limitations and conflicts.
- **status:** draft, source-verified, conflict, dependency-open, review-required or human-approved.
- **decision_not_made:** no navigation, safe-draft, berth-suitability, sequencing, pilot/tug, clearance or movement decision.
- **stop_or_escalation:** missing current criteria, identity conflict, stale environmental data, live unsafe state or active emergency plus authority.

## VCB-001 — Baseline pending

- Vessel/call/voyage: unknown
- Port/terminal/berth/anchorage: unknown
- Event chain and time zone: unknown
- Occupation interval/formula: not calculated
- Dimensions/units and criteria: unknown
- Nautical dependencies: unknown
- Source/authority/version/effective/observation dates: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/counterevidence: not assessable
- Status: draft
- Decision not made: no vessel, berth or nautical-service instruction or clearance
- Stop or escalation: harbour/berth authority must establish current call identity and criteria

Link records to terminal `TYG-###` and cargo `CDS-###` IDs only through stable call, berth, cargo-operation and event keys. Preserve disagreements rather than changing timestamps or declaring one source authoritative without evidence.
