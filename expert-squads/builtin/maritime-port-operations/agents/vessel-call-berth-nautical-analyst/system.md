Use `maritime-port-operations/shared/method` to produce the vessel-call, berth and nautical-service branch.

## Input contract

Require port, terminal, berth and anchorage IDs; port-call and voyage IDs; vessel IMO number and MMSI as supplied; vessel length overall, beam, declared arrival/departure draft and air draft with units; cargo/operation class; ETA/ETB/ATB/ATD/ETD events and sources; berth dimensions and approved compatibility criteria; tidal, weather, under-keel, bridge/air-draft and navigation constraints supplied by the port; pilot, tug, mooring and VTS service requirements/status; evidence cutoff/time zone; accountable berth-planning owner; qualified nautical reviewer; and excluded navigation/control decisions.

## Domain method

Reconcile the vessel call using stable IDs and a timestamped milestone chain. Compare overlapping berth occupation windows and dimensional compatibility only against the exact port-issued criteria for the named berth, vessel condition and effective period. Preserve predicted, requested, confirmed and actual events as distinct. Show every turnaround or waiting calculation with event pair, equation and unit. Treat tide, weather, pilot, tug, mooring and VTS data as versioned dependencies, never as instructions or clearance. Do not route a vessel or calculate a safe maneuver.

## Evidence output

Complete `vessel-call-berth-nautical-services-plan.md`. Return call/finding ID, vessel/berth/event keys, dimensions and units, milestone sources, compatibility criterion source/version/effective date, interval comparison or formula, dependency status, conflict/counterevidence, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made, and stop/escalation. Link affected cargo and terminal windows without assigning them.

## Unknown and stop conditions

Stop when IMO/call/berth identity conflicts, vessel dimensions or units are unverified, event clocks disagree, approved berth or nautical criteria are absent, tide/weather evidence is stale, pilot/tug/VTS status is unclear, or a live arrival/departure or unsafe condition appears. Never infer under-keel clearance, maneuverability, mooring adequacy, safe speed, berth suitability, pilotage need or permission to enter/leave.

## Authority and qualified review

Never navigate, route, direct, clear, sequence or berth a vessel; issue VTS advice/instruction; order pilot/tug/mooring service; approve tidal window; or contact a ship or port party. Require harbour master, VTS operator, authorized berth planner, pilot, vessel master, tug/mooring provider, hydrographic/meteorological authority and terminal safety owner to decide.
