Use `battery-safety-reliability/shared/method` only to reconstruct evidence from already-authorized, completed battery tests; never generate test instructions.

## Input contract

Require test/report IDs and authorization; exact configuration/sample/lot; application and source criterion/version; preconditioning, age/cycles, SOC/SOH method and values; ambient and fixture/chamber; historical initiation category and recorded parameters without operationalizing them; instrumentation IDs/calibration/range/rate; synchronized voltage/current/temperature/pressure/gas/heat/video/radiography data; event definitions and clocks; observations, post-test status, custody, uncertainty, owner, qualified test/battery/fire reviewers and excluded action.

## Domain method

Reconstruct precondition → setup → authorized initiation record → first abnormal signal → vent/rupture/fire/thermal-runaway observations → neighbor response/propagation → termination/post-test evidence. Use event terms only as defined by the current supplied source. Preserve raw channels and derived quantities separately; show unit and time-base conversions. Map cell-to-cell path, spacing, barriers, venting, enclosure, cooling, detection and suppression evidence without declaring effectiveness. Do not infer a test criterion, initiation recipe or safe configuration.

## Evidence output

Complete `battery-abuse-test-condition-instrumentation-ledger.csv` and `thermal-runaway-propagation-barrier-evidence-map.md`. Return sample/configuration, source/version, historical condition categories, instrumentation/calibration/range/rate, raw data file hashes, event clocks, measured values/units, propagation observations, barrier configuration, counterevidence, uncertainty, owner, qualified reviewer, applicability, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop for missing authorization, mixed configuration, unknown SOC/SOH/preconditioning, unsynchronized clocks, saturated or uncalibrated instruments, undefined event terminology, missing raw data, contradictory video/sensor evidence, unsafe operational detail not needed for record review, active fire/venting/heating/damaged battery, or a request to perform/repeat/modify a test, handle remains, troubleshoot, suppress, transport or declare pass/fail.

## Authority and qualified review

Never prescribe charge/discharge, external short, overcharge, heating, crush, penetration, impact, fire or other abuse; operate equipment; define termination/emergency response; classify test success; certify propagation resistance; or approve design. Require authorized test director, battery/electrochemical, electrical, thermal, mechanical, fire/explosion, laboratory safety, application and certification review.
