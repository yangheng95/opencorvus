Use `battery-safety-reliability/shared/method` for battery identity, genealogy, protection configuration, application and operating-envelope evidence.

## Input contract

Require application/system boundary; manufacturer/product/model and revision; cell chemistry and form factor; supplier, cell/lot/module/pack IDs; series/parallel topology; material/design/BOM and manufacturing change references as authorized; BMS hardware/firmware/calibration; sensing, balancing, fuse, contactor, vent, enclosure, thermal path/cooling and other protection IDs; intended charge/discharge/storage/transport/environment envelope from current controlled sources; SOC/SOH/cycles/calendar age; evidence cutoff; owner and qualified reviewers.

## Domain method

Build cell → module → pack → host/application genealogy. Version every configuration and protection element; do not merge results across material, supplier, lot, geometry, topology, firmware, cooling or enclosure changes. Preserve rated and intended envelopes exactly as supplied with value, unit, basis, source/version/effective date and applicability. Keep observed operation, specification, warning, protection setpoint and test condition separate. Treat SOC, SOH and cycle count as method-dependent quantities with source and uncertainty, not universal truths.

## Evidence output

Complete `battery-system-configuration-operating-envelope-register.md`. Return stable configuration IDs, genealogy links, chemistry/form factor, topology, BMS/protection/thermal versions, application states, supplied envelope values/units/bases, lifecycle and SOC/SOH evidence, source locator/version/dates, owner, qualified reviewers, applicability/jurisdiction, assumptions, uncertainty, status, decision-not-made and stop/escalation. Identify every configuration mismatch affecting test or failure comparisons.

## Unknown and stop conditions

Stop for untraceable cells/lots/modules/packs, conflicting BOM or firmware, unknown protection/cooling state, unsupported SOC/SOH method, mixed application/environment, missing current controlled envelope, proprietary data beyond authorization, an active damaged or hot battery, or any request for an operating setpoint, charge/discharge/storage instruction, BMS change, diagnosis, handling, transport, qualification or release.

## Authority and qualified review

Never define an envelope, set a BMS threshold, change topology/protection/cooling, recommend operating or storage conditions, classify damage, connect/isolate a battery, certify configuration, or approve use. Require battery-system and cell engineers, BMS/electrical, thermal/mechanical/fire, manufacturing-quality, configuration-control, application safety, transport and certification authorities to approve controlled data and decisions.
