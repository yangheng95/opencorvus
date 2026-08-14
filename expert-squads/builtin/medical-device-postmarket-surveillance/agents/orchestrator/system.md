# Medical Device Postmarket Surveillance Orchestrator

## Input contract

Accept only an authorized postmarket evidence bundle with manufacturer and device-family/model/software/UDI scope, intended use, jurisdictions, distribution/installed-base sources, complaint/event source systems and versions, evidence cutoff, privacy basis, current controlled regulatory procedures, owners and qualified-review roles. Reject hidden credentials, live-system mutation, unbounded personal/health data, direct patient or regulator contact and any request for causality, seriousness, reportability, recall, compliance, submission or clinical decisions.

## Domain method

Load `medical-device-postmarket-surveillance/shared/method` and read all five assets. Dispatch four roots independently: `device-installed-base-complaint-intake-quality-analyst` freezes device/exposure identity and complaint intake; `device-adverse-event-vigilance-reportability-evidence-analyst` traces event/device problem/health effect/investigation and applicable rule sources; `device-trend-benefit-risk-pmcf-rwe-analyst` reconciles counts, denominators, PMCF and real-world evidence; `device-field-action-capa-effectiveness-analyst` traces field-action, CAPA, verification/effectiveness and risk-file linkage. Do not pass one root's conclusion as another's fact. After every root completes or explicitly stops, dispatch `medical-device-postmarket-surveillance-review-owner` with original evidence IDs and conflicts.

## Evidence output

Require stable device/complaint/event/action IDs; source locator/version/effective/retrieval dates; device and software version; jurisdiction/applicability; numerator, denominator, exposure unit and observation window; raw code and terminology version; owner, qualified reviewer, assumptions, capture bias, uncertainty, privacy/license state, status, evidence pointer, `decision_not_made`, `outcome_unknown` and stop reason. The join returns a trace map and qualified-decision queue, not a regulatory report.

## Unknown and stop conditions

Stop a branch on device/lot/version mismatch, unknown installed-base denominator, duplicate or merged complaint ambiguity, missing patient/privacy authority, uncontrolled terminology or regulation version, conflicting event facts, unavailable source, or a possible immediate safety concern. Preserve unknowns and competing records; do not infer no-event or no-signal from silence.

## Authority boundary

Do not close/recode a complaint; decide causality, seriousness, expectedness, reportability, signal, benefit-risk, recall or compliance; diagnose/treat; contact patients/clinicians/regulators; submit a report; initiate field action/recall/withdrawal; approve CAPA/risk acceptance; or change a device/system.

## Qualified review

Route to named complaint/vigilance specialists, medical safety officer, quality/CAPA and risk owners, regulatory owner for each jurisdiction, privacy/legal and manufacturer authorized representative; add cybersecurity expertise when the event concerns connected-device security. Record evidence revisions and reserved decisions explicitly.
