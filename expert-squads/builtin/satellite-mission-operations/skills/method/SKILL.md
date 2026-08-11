---
name: satellite-mission-operations-method
description: Prepare source-bound satellite telemetry, mission-planning, ground-contact, telecommand-procedure, and anomaly-readiness evidence when qualified flight and ground teams need a reproducible review without live operational authority.
---

# Satellite Mission Operations Method

## Freeze mission identity and authority

1. Record scope ID, spacecraft and mission-phase identity, configuration baseline, Operations Database version, command dictionary and procedure-set versions, mission-plan horizon, authorized source inventory, data cutoff, security classification, evidence owner, and qualified reviewers.
2. Record every time system and mapping version. Keep Coordinated Universal Time (UTC), International Atomic Time (TAI), Global Positioning System (GPS) time, ground receipt time, and spacecraft clock distinct until an authorized correlation converts them. Preserve original timestamps and mapping uncertainty.
3. Classify values as observed, converted, derived, predicted, conflicting, or missing. Never turn predicted visibility into an allocation, a display limit into an operating limit, or a procedure draft into an approved command product.
4. State `decision_not_made`: no live spacecraft or ground connection; command creation, approval, scheduling, uplink, retry, abort, or verification; contact booking; mode/configuration/orbit/attitude/payload change; alert; maneuver, conjunction, spectrum, flight-safety, or emergency decision.

## Reconstruct telemetry, health, mode, and event evidence

Trace each recorded parameter from packet/channel identity to raw representation, conversion/calibration version, engineering value, unit, quality flag, applicable mode, and limit-set version. Do not invent conversion constants or silently mix databases. When a supplied equation is authorized, retain its inputs, precision, rounding, output, and version.

Build an event timeline only after recording the time scale and correlation. Preserve gaps, rollover handling, latency, duplicate frames, stale values, and reprocessing. Keep mode declarations, transition indicators, subsystem states, limit excursions, and analyst interpretations as different fields. A missing or out-of-limit value is a review question, not a diagnosis or alert. Link configuration changes and limit-set changes to their authority evidence.

## Analyze contacts, plans, buffers, and constrained resources

For each authorized candidate contact retain station/service identity, prediction source/version, acquisition of signal (AOS), loss of signal (LOS), time scale, minimum-elevation rule source, data-rate profile, authorized efficiency, setup/teardown, and allocation state. Calculate only with compatible inputs:

- `duration_s = LOS - AOS`
- `capacity_bits = duration_s * rate_bps * authorized_efficiency`
- `buffer_t = buffer_t-1 + generated_data - downlinked_data`

Record generated, stored, and downlinked data with bit/byte units and horizon denominator. Separate requested, predicted, allocated, booked, and achieved contacts. Check overlaps and supplied power, thermal, attitude, payload, station, network, spectrum, staffing, and priority constraints without choosing a resolution. Sensitivity variants must name their changed source-bound assumption.

## Trace telecommand procedure and anomaly-readiness evidence

Create a non-executable chain: request source; controlled procedure ID/version/effective date; spacecraft/configuration and command-dictionary version; supplied parameter record with unit and authorized validation-range source; preconditions; inhibits/interlocks; independent check or two-person rule; rehearsal/simulation evidence; authorization record; declared window and route; expected observable; recorded post-action verification.

Never generate command mnemonics, sequence syntax, parameter recommendations, credentials, endpoints, bypasses, or recovery steps. A missing record means review-required or stopped, not permission to proceed. For anomaly evidence, reconstruct detection source, timeline, observations, competing hypotheses, falsifying evidence, decision points, accountable owners, and authorized procedure references. Do not diagnose, classify an emergency, or propose action.

## Join branches without hiding conflict

Require compatible scope, spacecraft, mission phase, configuration, time mapping, and data cutoff or record an explicit mismatch. Cross-link events to activities and contacts through stable IDs. Cross-link a procedure's expected verification to the recorded telemetry channel and database version. Cross-link plan assumptions to data-generation evidence. Retain conflicting values and their provenance instead of selecting one.

Classify each branch and joined claim as evidence-complete, qualified-review-required, stopped, or superseded. Do not issue an approval score. Populate exactly the five assets in `assets/`; every material row includes stable ID, source locator/version/date, cutoff/effective date, value and unit/denominator, owner, qualified reviewer, applicability, assumptions, uncertainty, security/license boundary, status, decision_not_made, and stop/escalation reason.

## Stop and escalate

Stop on unauthorized or live sources, credentials, unknown spacecraft/configuration, unverifiable database/procedure versions, unresolved time correlation, missing units, mismatched mission phases, or requests to operate or advise live systems. Do not reproduce protected ECSS or CCSDS standard text; use operator-authorized copies and record their edition as a locator only.

Route operational authority to the flight director and spacecraft operators; subsystem interpretation to qualified engineers; orbit/attitude and maneuver matters to flight dynamics; contacts to ground/network operations; payload trades to mission/science planning; conjunction and flight safety to space-safety roles; spectrum decisions to regulatory owners. Read `references/SOURCES.md` and `references/REJECTED-CANDIDATES.md` before describing provenance. This is clean-room operational evidence methodology, not copied Agent Skill or protected-standard content.
