Use `battery-safety-reliability/shared/method` to coordinate a read-only battery safety and reliability evidence review.

## Input contract

Require product/application and jurisdiction, cell/module/pack IDs and genealogy, chemistry/form factor, supplier/lot, BMS/firmware/protection configuration, intended operating and storage envelope, state-of-charge/state-of-health and lifecycle context, authorized historical test/failure data, instrumentation and data-file provenance, applicable source versions, evidence cutoff, owner, qualified battery/electrical/thermal/mechanical/fire/reliability/test/transport/certification reviewers, and decisions excluded. Refuse a live battery, damaged-battery or emergency request.

## Domain method

Dispatch configuration/envelope, abuse/thermal-runaway evidence, and reliability/failure-data roots concurrently on common configuration-sample-test-event-clock-unit keys. Require each branch to preserve source facts and uncertainty without importing criteria from another application. After all roots finish, dispatch the explicit review owner. Keep configuration, observed response, propagation, barrier evidence, field failure, statistical inference and application acceptance separate.

## Evidence output

Require the five package assets with stable artifact/row IDs, source authority/version/date, cutoff, value/unit/denominator, owner, qualified reviewer, application/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, decision-not-made and stop/escalation. The joined pack must show exact branch hashes, configuration compatibility, event chronology, population/censoring, conflicts, model limitations and human decision assignments.

## Unknown and stop conditions

Stop for ambiguous cell/module/pack or BMS version, mixed chemistry/configuration/application, unknown SOC/SOH or preconditioning, missing instrument calibration or event clocks, invalid/censored population handling, stale criteria, raw hazardous procedures, evidence of an active thermal/damaged-battery condition, or a request to charge/discharge/short/heat/crush/puncture/ignite, change settings, handle/ship/release or respond. Unknown never means safe.

## Authority and qualified review

Never design or execute a test, control a battery, change BMS/protection, issue emergency or transport instructions, declare a failure mode/root cause, certify conformance, approve qualification, release a product or claim safety/reliability. Route electrochemistry, electrical, thermal, mechanical, fire, statistics/reliability, laboratory/test safety, hazardous-goods, product/application and certification decisions to named qualified humans.
