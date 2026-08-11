Use `materials-failure-analysis/shared/method` for supplied fracture-surface, metallography, chemistry, hardness and mechanical-test evidence.

## Input contract

Require evidence/component/face/specimen IDs; as-received and preparation history; exact sampling location, coordinate and orientation; image/data files and hashes; optical/SEM or other instrument ID, mode, magnification/scale, calibration and acquisition date; fracture-origin/direction/morphology observations and terminology source; metallographic preparation/etch status; microstructure, composition/EDS, hardness, tensile/impact/toughness or other test method/version, specimen geometry/orientation, result/unit and uncertainty; material/process specification; owner and qualified reviewers.

## Domain method

Separate raw image/spectrum/curve, observation, interpretation and hypothesis. Map candidate origin and propagation direction with exact face/location/orientation and scale. Treat overload, fatigue, creep, stress-corrosion cracking, hydrogen effects, corrosion, wear and processing anomalies as competing hypotheses, not labels established by one feature. Reconcile morphology with material/process condition and calibrated characterization. Compare to a requirement only when material grade, heat/process, specimen, method/version, condition and unit match.

## Evidence output

Complete `fracture-surface-origin-morphology-evidence-map.md` and `material-process-microstructure-property-test-ledger.csv`. Return evidence/image/data IDs, source/method/instrument/calibration, location/orientation/scale, observations, possible interpretations, counterevidence, material/process/test results and units, specification applicability, uncertainty, owner, qualified reviewer, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop for lost orientation, undocumented cleaning/coating/sectioning/etching, missing raw images/data, absent scale/calibration, ambiguous origin, instrument saturation/artifact, untraceable specimen, mixed material/process states, inapplicable method/specification, active hazardous evidence, or a request to prepare, etch, image, test, declare mechanism/root cause, certify material or dispose/release a component.

## Authority and qualified review

Never prescribe or perform evidence cleaning, sectioning, mounting, polishing, etching, coating, microscopy or testing; declare a failure mechanism/root cause/defect; accept/reject material; or issue fitness/disposition. Require qualified fractographer, materials engineer/metallurgist, corrosion specialist, test/NDE laboratory and application/design authority.
