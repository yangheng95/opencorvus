---
name: railway-operations-safety-method
description: Prepare source-grounded railway timetable, route-capacity, signalling, infrastructure-restriction, service-disruption, occurrence, and safety-assurance evidence. Use for bounded railway operating reviews that require parallel professional analysis and qualified human decisions; never use for live train control, movement authority, dispatch, maintenance release, occurrence classification, emergency action, or safety certification.
---

# Railway Operations Safety Method

## Freeze the operating baseline

1. Record the network, operating area, jurisdiction, infrastructure manager, railway undertaking, timetable owner, accountable safety owner, evidence cutoff, time zone, authorized data boundary, and excluded actions.
2. Establish stable IDs for line, station, platform, route, block, signal, point, crossing, train, service, path, rolling-stock class, restriction, possession, occurrence, control and action. Refuse to merge ambiguous IDs.
3. Preserve source URI or document location, source authority, title, version, effective date, observation date, unit, owner, qualified reviewer, applicability, uncertainty and status for every claim. Missing evidence remains unknown.
4. Accept headway, separation, speed, compatibility, signalling, possession, reporting and safety criteria only from current approved sources supplied for the named operation. Never invent a universal threshold.

Use [the operating baseline and authority register](assets/railway-operating-baseline-and-authority-register.md) before opening any analytical branch.

## Reconcile timetable, path and resource capacity

1. Load the approved timetable and amendments. Distinguish scheduled, planned, forecast and actual timestamps and normalize them to the declared operating day and time zone without destroying originals.
2. Model each train path as ordered resource-occupation intervals over routes, junctions, blocks and platforms. Retain direction, calling pattern, arrival, departure, dwell, recovery, turnaround, rolling-stock length and compatibility.
3. Compare interval overlaps only after route, calendar and version compatibility is proven. Test each possible conflict against the exact supplied separation, crossing, junction, platform, reoccupation, possession or restriction rule.
4. Calculate occupancy as `occupied compatible resource-time / available compatible resource-time` only when both terms, exclusions, units and window are explicit. Treat utilization as planning evidence, not a safety limit.
5. Record formula, input IDs, unit conversions, applicable rule, counterevidence and uncertainty in [the timetable path ledger](assets/timetable-path-platform-capacity-ledger.csv). Do not assign or publish a path or platform.

## Trace signalling and infrastructure risk

1. Keep infrastructure configuration, operational rules, asset condition, maintenance status and release authority separate. A diagram does not prove current condition; absence of an alarm does not prove normal operation.
2. Represent each supplied change, degraded condition, possession or restriction as `source/event → affected asset and boundary → hazard scenario → approved control → control evidence → control failure mode → residual unknown → accountable owner`.
3. Reconcile location, effective period and affected route/service. Flag conflicting diagrams, notices, work records, topology versions or restriction boundaries without selecting a winner.
4. Do not simulate or reverse-engineer interlocking, train protection, braking, overlap, flank protection, route release or fail-safe behavior. Do not infer signal aspect, safe speed, equipment fitness, route availability or restoration readiness.
5. Store the trace in [the signalling and restriction risk register](assets/signalling-infrastructure-restriction-risk-register.md).

## Reconstruct service and occurrence evidence

1. Build an immutable event chain from planned and actual service events, delays, cancellations, turnbacks, missed stops, defects, alarms, reports and later corrections. Retain original codes and timestamps.
2. Calculate a duration only from defined compatible event pairs. State equation, unit and clock treatment. Never use an unmatched timestamp as zero.
3. Classify causation claims as verified attribution by the named authority, supplied preliminary attribution, candidate contributor, counterevidence or unknown. Never manufacture a single root cause or assign blame.
4. Trace `occurrence → affected operation → hazard/control evidence → recorded containment by authorized personnel → assurance action → verification evidence`. Separate statutory reporting, investigation, discipline and liability.
5. Preserve findings in [the service disruption and occurrence log](assets/service-disruption-occurrence-assurance-log.md). Protect investigation and personal-data boundaries.

## Join the three roots

1. Require all three independently prepared artifacts plus the common baseline. Verify artifact version/hash, evidence cutoff, time zone and ID compatibility.
2. Join timetable findings to restrictions and occurrences only through stable path, route, asset, event and time keys. Create contradiction rows rather than smoothing incompatible evidence.
3. Use only an operator-supplied risk or urgency rubric. Link each bounded review option or assurance action to need, source evidence, existing control, dependency, owner, reviewer, date, applicability, uncertainty, status and stop condition.
4. State `decision-not-made` for movement authority, route setting, speed, timetable publication, possession, isolation, maintenance release, statutory classification, emergency response and safety acceptance.
5. Complete [the integrated review pack](assets/railway-operations-safety-review-pack.md) and route every decision to its authorized human owner.

## Stop and escalate

Stop when identifiers or versions conflict; approved operational criteria are absent; topology, timetable, time zone, restriction or possession boundaries cannot be reconciled; active danger, live alarms or emergency conditions appear; evidence exceeds authorization; protected investigation or personal data would be exposed; or the output could be treated as a control instruction, release, classification, certification or compliance claim.

Require controller/signaller, timetable/capacity authority, infrastructure manager, signalling/track/electrical specialist, railway undertaking, rolling-stock and crew owner, safety manager, independent assessor, investigator, privacy/legal counsel, emergency authority and regulator as applicable. Preserve the question, evidence and stop reason; do not provide an operational workaround.

## Sources and clean-room boundary

Read [sources and clean-room boundary](references/sources.md) when checking current authority. This method is clean-room authored. The similarly named Railway platform Skill was reviewed at a fixed commit and rejected because it controls software deployments rather than rail transport. No rejected Skill text, hard-coded threshold or operational command was copied.
