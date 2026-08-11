# Port Operating Baseline and Authority Register

Freeze the shared scope for all three branches in this register. One row represents one versioned port, terminal, vessel-call, operating criterion, data source or decision authority. Never blend limits or statuses from different ports, terminals, berths, calls, cargo cohorts, jurisdictions or effective periods.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Mandatory provenance envelope

| Field                         | Required content                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| record_id                     | Stable `POB-###`.                                                                                            |
| object_ids                    | Port/UNLOCODE, terminal, berth, anchorage, vessel IMO/MMSI, call, voyage, cargo-operation and authority IDs. |
| scope                         | Geography, operating area, call, cargo class, process, time window and exclusions.                           |
| unit_and_time_zone            | metres, nautical miles, knots, tonnes, TEU, moves, slots, timestamps and named time zone as applicable.      |
| source_location               | URI, controlled document/section, system export, message or event locator.                                   |
| source_authority              | Port, terminal, vessel, carrier, customs, security, regulator or other named issuer.                         |
| source_version_effective_date | Revision/schema plus valid-from/valid-to.                                                                    |
| observation_or_retrieval_date | When evidence was recorded or retrieved.                                                                     |
| owner                         | Accountable port operating owner.                                                                            |
| qualified_reviewer            | Named competent harbour, nautical, terminal, cargo, dangerous-goods, customs/security or safety role.        |
| applicability                 | Vessel/call/berth/cargo/equipment/weather/tide/operating-state boundaries.                                   |
| uncertainty                   | Identity, unit, timing, source, coverage, prediction or interpretation limits.                               |
| status                        | Draft, source-verified, conflict, superseded, review-required or human-approved.                             |
| decision_not_made             | No navigation, clearance, dispatch, handling, classification, release or emergency decision.                 |
| stop_or_escalation            | Trigger and authorized recipient.                                                                            |

## Baseline rows

| record_id | object_ids | scope                      | unit_and_time_zone | source_location | source_authority | source_version_effective_date | observation_or_retrieval_date | owner   | qualified_reviewer | applicability | uncertainty | status | decision_not_made                           | stop_or_escalation                       |
| --------- | ---------- | -------------------------- | ------------------ | --------------- | ---------------- | ----------------------------- | ----------------------------- | ------- | ------------------ | ------------- | ----------- | ------ | ------------------------------------------- | ---------------------------------------- |
| POB-001   | unknown    | Port-call baseline pending | unknown            | unknown         | unknown          | unknown                       | unknown                       | unknown | unknown            | unknown       | unknown     | draft  | No operational or public-authority decision | Stop until scope and authority reconcile |

## Authority map

Record separate authorities for harbour/VTS, pilotage, tug/mooring, berth planning, terminal control, equipment/maintenance, labor, cargo documentation, VGM responsibility, dangerous-goods declaration/classification, customs/border, security, carrier/master, pollution response and emergency command. A system status or contact record does not prove authority.

List conflicting names, duplicate call or cargo IDs, stale berth data, unit ambiguity, time-zone differences and superseded documents. Assign owner and review date. Do not select the most convenient source; require the issuing authority to confirm applicability.
