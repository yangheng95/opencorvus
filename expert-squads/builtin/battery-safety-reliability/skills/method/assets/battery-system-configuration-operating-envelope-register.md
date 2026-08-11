# Battery System Configuration and Operating-envelope Register

## Canonical provenance fields

`artifact_id`; `row_id`; product/application ID; configuration ID/revision; source locator/authority/version/effective and observation dates; evidence cutoff; owner; qualified battery/electrical/thermal/mechanical/application reviewers; applicability/jurisdiction; assumptions; uncertainty/confidence; proprietary/privacy/license boundary; status; `decision_not_made`; `stop_or_escalation`.

This is an evidence baseline, not an operating specification, BMS command, storage/transport instruction, certification or release.

## Genealogy and construction rows

Record manufacturer/model/revision, chemistry, cell form factor, supplier and cell lot, cell IDs, module/pack IDs, series/parallel topology, rated quantities with units, material/BOM/design and manufacturing-change references, host/application, production date and trace evidence. Link cell → module → pack → host without inferring missing genealogy.

## Protection and thermal rows

Record BMS hardware/firmware/calibration IDs, voltage/current/temperature sensing, balancing, fuse, contactor, vent, enclosure, spacing, insulation, thermal path/cooling, detection and other protection configuration/version/status. Configuration existence is not proof of function or effectiveness.

## Intended envelope and lifecycle rows

For every supplied charge/discharge/storage/transport/environment value, record quantity, unit, peak/average/continuous basis, condition, source/version/date and application. Record SOC/SOH/cycle/calendar age/energy-throughput values with exact method and uncertainty. Keep specification, warning, protection setting, observed condition and test condition separate.

Stop/escalate for untraceable lots/configuration, conflicting firmware/BOM, unknown protection/cooling, unsupported SOC/SOH, absent current controlled source, active damaged/hot battery or a request for a setpoint, operating/storage/transport instruction, BMS change, qualification or release. `decision_not_made` states that no envelope, safety, design, operation, transport, certification or release decision was made.
