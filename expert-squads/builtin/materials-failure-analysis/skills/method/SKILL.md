---
name: materials-failure-analysis-method
description: Prepare traceable physical-component failure evidence across identity, as-received condition, custody, service and manufacturing history, fractography, metallography, material/property testing, load, environment, mechanics, competing hypotheses and qualified review. Use for bounded records analysis; never use to handle or destructively test evidence, declare root cause or liability, perform fitness-for-service, or decide rework, recall, scrap or return to service.
---

# Materials Failure Analysis Method

## Freeze evidence, component and authority

1. Record incident/scope, system/assembly/component, evidence cutoff, preservation/legal-hold boundary, owner, evidence custodian, qualified reviewers and decisions excluded.
2. Assign stable IDs to component, assembly/mating part, material/heat/lot, feature, fracture face, fragment, deposit, specimen, photograph/image, data file, custody event, source, instrument, test, observation, calculation and hypothesis.
3. Preserve original spatial relationships: component coordinate system, face, location, orientation, scale, mating relationship and as-received condition.
4. Record source locator/authority/version/effective and observation date, quantity/unit/denominator, owner, qualified reviewer, applicability, assumptions, uncertainty, custody/privacy/license boundary, status, `decision_not_made` and `stop_or_escalation` on every material row.

Use [the failed-component and custody register](assets/failed-component-identity-service-history-custody-register.md) as the common evidence spine.

## Preserve as-received condition and chronology

1. Link assembly → component → feature → face → fragment/specimen. Hash images and files; record labels, seals, packaging and custody.
2. Describe as-found/as-received state before any documented cleaning, disassembly, cutting, coating, etching or test. Treat each alteration as a versioned event.
3. Build design/specification → material/procurement → manufacturing/process/heat treatment → inspection → installation → service/load/environment → maintenance/repair/change → event → recovery/examination chronology.
4. Keep supplied observations separate from witness claims, interpretations and hypotheses. Record contradictions in serial, heat/lot, design revision, orientation and event time.
5. Never recommend physical handling. Evidence custodian and qualified examination authorities own preservation and destructive-test decisions.

## Map fracture-surface evidence

1. Record face/feature ID, exact location/orientation, scale and imaging method before describing a possible fracture origin or direction.
2. Preserve raw image/data, observation, interpretation and hypothesis as separate fields.
3. Treat overload, fatigue, creep, stress-corrosion cracking (SCC), hydrogen effects, corrosion, wear and processing anomalies as competing explanations. Morphology alone never proves a mechanism or cause.
4. For each observation, record supporting feature, counterevidence, imaging artifact/contamination risk, representativeness and qualified reviewer.
5. Complete [the fracture-surface evidence map](assets/fracture-surface-origin-morphology-evidence-map.md).

## Reconcile material and characterization evidence

1. Link material grade/specification, heat/lot, manufacturing process, heat treatment, joining/coating and surface condition to the exact component and specimen.
2. Record metallography preparation and etch history, location/orientation, instrument/method/version, calibration, magnification/scale and image/data hash.
3. Record microstructure, composition/EDS, hardness, tensile, impact, toughness or other supplied results with specimen geometry/orientation, condition, value/unit and measurement uncertainty.
4. Compare to a requirement only when grade, process/heat treatment, specimen state, method/version and units match. Keep typical handbook values separate from certified heat/test data.
5. Use [the material/property ledger](assets/material-process-microstructure-property-test-ledger.csv).

## Reconcile loads, environment and mechanics

1. Trace geometry/drawing revision, dimensions, installation/preload/constraint, service/event loads, spectrum/cycles, temperature, pressure, vibration, impact and chemical/corrosive/hydrogen environment.
2. For nominal stress or another supplied calculation, show formula, operands, dimensions, units, boundary conditions and uncertainty.
3. Use stress concentration, stress intensity, fracture toughness, crack-growth, fatigue, creep or corrosion models only when a qualified plan supplies the model and its validity domain. Verify geometry, loading mode, material condition and dimensional consistency.
4. Never extrapolate remaining life or fitness from an invalid or underdetermined model.
5. Build [the load/environment/hypothesis matrix](assets/load-stress-environment-failure-hypothesis-matrix.md).

## Test competing hypotheses

1. Define each candidate mechanism/cause level explicitly. Separate failure mode, physical mechanism, contributing condition and organizational cause.
2. For every hypothesis record predicted evidence, observed support, counterevidence, alternative explanations, untested discriminator and uncertainty.
3. Require convergence across custody/history, fractography/characterization and load/environment/mechanics. One branch cannot close cause.
4. Preserve contradictory evidence and inconclusive outcomes. Do not force a 5-Whys chain or a single root cause.
5. Limit proposals to obtaining authorized existing records, reconciling identity/units/versions, qualified review or a separately authorized examination-plan decision. Never write test instructions.

## Join for qualified review

1. Require exact hashes/versions and common component/evidence/face/specimen/location/orientation/time/unit/source keys.
2. Identify any alteration that may affect an observation and any specimen that may not represent the failed region.
3. Label every final statement as source fact, observation, calculation, interpretation, hypothesis, assumption, uncertainty or unknown.
4. Preserve current method/standard metadata without reproducing protected standards. Application-specific requirements remain controlled inputs.
5. Complete [the qualified review pack](assets/materials-failure-analysis-qualified-review-pack.md). Leave cause, defect, liability, fitness, disposition and return-to-service decisions blank.

## Stop and retain professional authority

Stop for ambiguous identity, custody gap, lost orientation, undocumented alteration, active hazardous residue/energy, missing raw image/data or scale/calibration, untraceable specimen, mixed material/process state, incompatible geometry/load/unit/model, stale method, legal hold, or any request for physical action or professional conclusion.

Never touch, clean, cut, etch, dismantle, mount, coat, image or test evidence; declare mechanism/root cause/defect/culpability; certify material or calculation; decide admissibility, fitness, repair, rework, recall, scrap or return to service. Require evidence/legal, materials/metallurgy/fractography, mechanical/fracture/fatigue, corrosion, NDE, laboratory, design/application, safety and regulatory review.

## Sources and clean-room boundary

Read [the source and provenance record](references/sources.md). The method and five assets are clean-room authored from primary-source evidence and measurement structures. The generic software root-cause Skill is rejected in full; no upstream prose, 5-Whys example, template, prevention logic or code is retained.
