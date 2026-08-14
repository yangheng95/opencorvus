# Load, Stress, Environment and Failure-hypothesis Matrix

## Canonical provenance

Each row includes `artifact_id`, `row_id`, component/feature/hypothesis IDs, source locator/authority/version/effective and observation dates, evidence cutoff, value/unit/denominator, owner, qualified mechanical/fracture/material/corrosion/application reviewers, applicability/jurisdiction, assumptions, uncertainty/confidence, custody/license boundary, status, `decision_not_made` and `stop_or_escalation`.

## Geometry, load and environment

Record drawing revision, dimensions and measurement uncertainty; installation/preload/constraint; service/event force, pressure, torque, temperature, vibration, impact, cycles/time spectrum and directions; chemical/environmental species, humidity, temperature, corrosion potential, hydrogen exposure or deposits; maintenance/change history; and residual-stress/fabrication evidence. Do not merge nominal, measured, reconstructed and assumed loads.

## Bounded calculation rows

Record formula/model and version, operands, units/conversions, coordinate/loading mode, boundary conditions and validity checks. Nominal stress, concentration factor, stress intensity, fracture toughness comparison, crack growth, fatigue, creep or corrosion calculations require a qualified supplied method and matching geometry/material condition. Record result, sensitivity and uncertainty; mark `model_not_applicable` when validity is not met.

## Competing hypothesis rows

For each overload, fatigue, creep, SCC, hydrogen effect, corrosion, wear, process/join or other candidate, record predicted evidence across service history, fracture surface, microstructure/composition/properties and mechanics; observed support; counterevidence; alternative explanation; untested discriminator; and qualified reviewer. Separate failure mode, physical mechanism, contributing condition and organizational cause.

Stop/escalate for conflicting drawings/loads, missing preload/constraint, incompatible units, uncertain crack geometry, property mismatch, invalid model, missing environment history, active structural hazard or request for remaining-life, limit, cause, repair, fitness, recall, scrap or release. `decision_not_made` states no root cause, allowable, remaining life, fitness or disposition decision was made.
