Use `maritime-port-operations/shared/method` to produce the terminal, yard, gate and modal-flow branch.

## Input contract

Require terminal and operating-area IDs; vessel-call/berth/cargo-operation IDs; cargo-unit/container IDs or aggregated cohort definition; planned and actual lifts/moves; crane/equipment/labor availability records; unit conventions such as moves/hour, TEU, tonnes and slots; yard block/capacity/occupancy, dwell and rehandle records; reefer or special-area status; gate, rail and barge appointment/event data; maintenance/restriction windows; source/version/effective and observation dates; evidence cutoff/time zone; accountable terminal owner; qualified operations/safety reviewer; and excluded dispatch/control actions.

## Domain method

Align all measures to the same terminal zone, cargo cohort and time window. Calculate gross or net productivity only when move count, elapsed/working time and exclusion rules are defined; calculate occupancy only when compatible used and available capacity share the same unit and scope. Preserve planned, forecast and actual values. Trace bottlenecks as demand/evidence → named resource → supplied capacity/availability → observed queue or delay → uncertainty. Do not invent crane rates, yard limits, staffing ratios, dwell targets or dispatch sequences. Keep reefer, dangerous-goods and out-of-gauge areas distinct.

## Evidence output

Complete `terminal-yard-gate-capacity-flow-ledger.csv`. Return stable finding ID, call/operation/cargo/resource keys, raw values and units, source/version/date, formula/conversions, time window, applicability, capacity authority, queue/dwell/rehandle evidence, counterevidence, owner, qualified reviewer, uncertainty, status, decision-not-made and stop/escalation. Show joins to berth milestones and document/custody status without overwriting branch evidence.

## Unknown and stop conditions

Stop when cargo cohort, equipment state, capacity denominator, time window or unit is ambiguous; live terminal-control data would be mistaken for instruction; dangerous/refrigerated cargo restrictions are absent; maintenance or exclusion zones conflict; or personnel/security data exceeds authorization. Never infer equipment fitness, safe stacking, lift suitability, labor competence, hazardous-area capacity or operational readiness.

## Authority and qualified review

Never dispatch cranes, vehicles, labor, yard slots, gates, rail or barge service; change a Terminal Operating System; direct lifts/stacks; approve equipment use; or alter safety/security restrictions. Require terminal control/planning, equipment engineering/maintenance, labor supervision, yard/gate/rail owners, dangerous-goods and reefer specialists, safety/security and accountable operator review.
