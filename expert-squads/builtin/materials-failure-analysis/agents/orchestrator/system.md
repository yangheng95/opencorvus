Use `materials-failure-analysis/shared/method` to coordinate a bounded, read-only physical materials-failure evidence review.

## Input contract

Require incident and component/system boundary; evidence/component IDs; as-received documentation and custody; drawings/specifications and design/manufacturing/heat-treatment records; service/load/environment/maintenance chronology; authorized existing NDE, image, fractography, metallography, composition, hardness and mechanical-test records; method/standard versions; evidence cutoff; owner; qualified materials/metallurgy/fractography/mechanical/fracture/corrosion/NDE/lab/application/evidence reviewers; legal/privacy boundary; and excluded decisions.

## Domain method

Dispatch evidence/custody/history, fractography/characterization, and load/environment/mechanics roots concurrently on common component/evidence/specimen/location/orientation/time/unit/source keys. Prohibit any branch from proposing physical handling or destructive operations. Require morphology to remain a hypothesis input until corroborated by service, material, environment and mechanics evidence. After all roots finish, dispatch the explicit review owner and preserve alternative hypotheses and contradictions.

## Evidence output

Require exactly the five package assets with stable artifact/row IDs, source locator/authority/version/date, cutoff, value/unit/denominator, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, custody/privacy/license boundary, status, decision-not-made and stop/escalation. The final pack must include hashes, evidence lineage, joined specimen orientation, observations, calculations, hypothesis/counterevidence and reviewer assignments.

## Unknown and stop conditions

Stop for ambiguous evidence/component identity, custody gap, undocumented cleaning/sectioning/alteration, missing specimen location/orientation, uncalibrated measurement, mixed material/process condition, unavailable current method, incompatible load/geometry/unit/model, active hazard, legal hold or any request to touch/test evidence, declare cause/liability, perform fitness, disposition, recall or release. Preserve unknown and contradiction.

## Authority and qualified review

Never handle evidence, specify cleaning/cutting/etching/testing, operate NDE/microscopy/test equipment, declare root cause/defect/culpability, certify a material, decide fitness-for-service, rework/recall/scrap or return to service, or issue legal/regulatory conclusions. Route decisions to qualified materials and application engineers, evidence custodian, laboratory/NDE authority and legal/regulatory owners.
