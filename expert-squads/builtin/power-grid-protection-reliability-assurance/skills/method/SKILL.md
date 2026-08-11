---
name: power-grid-protection-reliability-assurance-method
description: Prepare source-bound electric-grid topology, protection-zone, relay-setting, fault-study, disturbance, misoperation, outage, and reliability-definition evidence for qualified review. Use for bounded protection and reliability assurance without relay, SCADA, EMS, switching, dispatch, setting-approval, or regulatory authority.
---

# Power Grid Protection Reliability Assurance Method

## Freeze network and authority context

Freeze the owner/operator, interconnection and jurisdiction, network-model revision, one-line revision, system base, voltage levels, topology state, effective timestamp, study case, event interval, reliability reporting period, cutoff, data-classification boundary, evidence owner and named protection, operations and reliability reviewers. Do not mix planning, as-designed, approved, downloaded, active or observed configurations.

Assign stable identifiers to buses, lines, cables, transformers, generators, inverter-based resources, shunts, breakers, disconnects, current transformers (CT), voltage transformers (VT), relays, firmware, settings groups, protection functions, logic equations, trip coils, DC systems, teleprotection channels, disturbance records, outage events and customers/load/energy denominators. Every record must carry source_id_locator, source_version_date, units_and_denominator, applicability, assumptions_uncertainty, status, decision_not_made, outcome_unknown and stop/escalation.

Keep observed data, model result, approved setting, active setting, analyst hypothesis, protection-engineer determination, operator action and regulator determination distinct.

## Build protection-zone and device lineage

Map each protected primary element to its protection zone, primary and backup schemes, sensing paths, relay functions, active settings group, logic, trip path, breaker poles, DC source and communications path. Bind the map to exact one-lines, elementary diagrams, settings files/reports, device exports, firmware records, CT/VT data, breaker records and telecommunications configuration.

Identify zone overlap/gap evidence, stale diagrams, contradictory equipment identifiers, unknown firmware, unmatched settings groups, disabled or blocked functions and inaccessible records. Do not infer operability, dependability, security, redundancy or compliance. Never access a relay, engineering workstation, SCADA, EMS or protection network.

## Reconcile fault studies and relay coordination

For each supplied study, record software/version, model and topology snapshot, system base, source impedances, generation and inverter assumptions, fault type and location, minimum/maximum case, infeed/outfeed, grounding, CT saturation or transient assumptions, VT behavior, relay characteristic, pickup/reach, time dial or delay, directional/polarizing source, communication delay, breaker interrupting/clearing time and approved evaluation criterion.

Normalize units only with a documented owner-approved conversion. Preserve original values and bases. Compare study settings, approved settings and active settings without recommending a change. Calculate a coordination margin, sensitivity or reach comparison only when the exact approved formula, inputs, curve definitions and acceptance criterion are supplied. Never hardcode a margin, threshold, IEEE/IEC requirement or "typical" setting.

## Align disturbance and misoperation evidence

Freeze event scope, UTC interval, original time zones, clock sources, synchronization status, precision and time uncertainty. Inventory COMTRADE files and configuration revisions, waveform channels, scaling ratios, polarity, units, sequence-of-events records, relay targets/event reports, breaker auxiliary contacts, trip-coil monitors, SCADA indications, teleprotection send/receive events, operator logs and maintenance evidence.

Build a timeline without overwriting original timestamps. Correlate pickup, directional/start logic, operate, communications, trip output, breaker motion, current interruption, reclose and restoration only where evidence supports the linkage. Mark facts, hypotheses, counterevidence, owner conclusions and formal misoperation determinations separately. Do not declare root cause, fault location, misoperation, reporting obligation or corrective action.

## Assure outage and reliability definitions

Create one immutable outage/event identity linking initiating and consequential elements, affected service point/customer/load/energy populations, interruption start, restoration stages, final restoration, correction/revision history and source-defined classification. Preserve planned/unplanned, momentary/sustained, transmission/distribution/generation and major-event treatment only when the governing definition provides them.

For every reliability result, record metric name, formula/version, reporting population, eligible event set, exclusions, customer/load/energy denominator, partial restoration treatment, missing-data policy and exact source rows. Never assume IEEE 1366, NERC, regulator, ISO/RTO or utility definitions are interchangeable. Do not publish an official metric or use it to make a compliance determination.

## Join branches without hiding conflicts

Require the four declared roots and join by topology revision, effective interval, primary element, protection zone, device/configuration, study/event identity and jurisdiction. Perform these reconciliation checks:

- network and zone model against study topology;
- approved and active settings against the evaluated study case;
- CT/VT ratios and polarity against waveform channel scaling;
- relay event sequence against breaker, trip, communications and SCADA evidence;
- protection-event scope against outage and restoration records;
- outage classifications and denominators against metric definitions;
- maintenance, configuration change and event chronology against effective dates.

Expose stale studies, unequal bases, contradictory settings, missing channels, poor time synchronization, disputed causes, incomplete restoration and denominator drift. Do not collapse disagreement into a single "best" result.

## Use the assets

Populate exactly these assets:

- [zone/device configuration register](assets/power-grid-protection-zone-device-configuration-register.md)
- [fault-study and coordination ledger](assets/fault-study-relay-setting-coordination-ledger.csv)
- [trip logic, teleprotection, and breaker matrix](assets/trip-logic-teleprotection-breaker-evidence-matrix.md)
- [disturbance, misoperation, outage, and reliability map](assets/disturbance-misoperation-outage-reliability-evidence-map.md)
- [qualified review pack](assets/power-grid-protection-reliability-qualified-review-pack.md)

Read [primary sources](references/PRIMARY-SOURCES.md) only for provenance and routing. Read [rejected candidate evidence](references/REJECTED-CANDIDATE.md) to preserve the clean-room boundary. Use the actual owner-controlled standard, procedure, study and setting basis; do not copy protected standards.

## Stop and preserve authority

Stop on unknown topology or active settings group, incompatible system bases or units, missing CT/VT or breaker identity, untrusted time source, incomplete COMTRADE configuration, unapproved calculation/criterion, disputed event scope, unknown denominator, inaccessible critical-infrastructure data, cybersecurity concern, live system condition, or request to modify, switch, trip, block, reclose, energize, dispatch, report or certify.

Protection engineers own scheme, setting, coordination and misoperation determinations. System operators own dispatch, switching, clearance and energization. Asset owners own equipment and maintenance decisions. Reliability authorities own classifications and published metrics. Cybersecurity teams own access and incident response. Regulators determine compliance and reporting. This Skill prepares read-only evidence only.
