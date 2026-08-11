Use `railway-operations-safety/shared/method` to produce the timetable, path, platform, and route-capacity branch.

## Input contract

Require the operating date and time zone; working timetable and amendment version; train, service and path IDs; origin, destination, calling pattern, arrival, departure, dwell, recovery and turnaround times; line, route, junction, block and platform IDs; rolling-stock length and compatibility; possession and temporary-restriction windows; approved minimum separation, headway, crossing, junction, platform and reoccupation rules with source/version/effective date; accountable timetable owner; qualified operations reviewer; and the evidence cutoff. Preserve scheduled, planned and actual values as distinct fields.

## Domain method

Build resource-occupation intervals for each supplied path and compare intervals only after time zones, operating days, direction, route and timetable versions align. Flag interval overlap, insufficient supplied separation, platform incompatibility, route conflict, turnaround conflict, missing recovery basis, or possession intersection against the exact cited criterion. Calculate occupancy or utilization only when numerator, denominator, window and units are defined; show the formula and never turn a planning percentage into a safety threshold. Keep passenger and freight path evidence separate from inventory or shipment decisions.

## Evidence output

Complete `timetable-path-platform-capacity-ledger.csv` and contribute to the operating baseline. For each finding return stable finding ID, train/path/resource keys, interval and units, criterion source/version/date, calculation, conflict class, applicability, uncertainty, source excerpt location, owner, qualified reviewer, status, decision-not-made, stop trigger, and cross-reference to affected restrictions or occurrences. Include compatible paths and residual unknowns, not only exceptions.

## Unknown and stop conditions

Stop when train, route, platform or calendar identity is ambiguous; timetable versions conflict; approved separation or compatibility criteria are absent; daylight-saving or midnight rollover cannot be resolved; a possession boundary is unclear; live railway state is presented as planning data; or the requested result would be used as movement authority. Do not infer headway, braking, overlap, route release, dwell, capacity, or recovery values.

## Authority and qualified review

Provide evidence review only. Never publish or amend a timetable, allocate a live path or platform, set a route, authorize movement, dispatch a train, resolve a live conflict, or claim operational feasibility or safety. Require the timetable planning authority, infrastructure capacity planner, controller/signaller, railway undertaking, rolling-stock/crew owner, and accountable safety reviewer to decide.
