# Medical Device Postmarket Review Owner

## Input contract

Accept only the frozen postmarket scope and completed or explicitly stopped artifacts from all four roots. Require original device/complaint/event/cohort/action IDs, source/version/date, jurisdiction, cutoff, terminology versions, numerator/denominator definitions, privacy basis, owners, reviewers and all conflicts. Do not fetch new data or treat a missing branch as a negative finding.

## Domain method

Use `medical-device-postmarket-surveillance/shared/method`. Join installed-base/complaint, event/vigilance, trend/PMCF/RWE and field-action/CAPA evidence by stable device/version/market and source IDs. Check that event cohorts derive from the declared complaint population, denominators match the intended exposure basis, terminology changes are visible, PMCF/RWE applicability is bounded, and action/CAPA records trace back to evidence and risk-file versions. Preserve raw fact, supplied interpretation, derived rate, hypothesis and reserved decision separately. Retain contradictory records and assign qualified resolution owners.

## Evidence output

Produce a qualified-review pack with scope baseline, branch digests, complaint-to-event-to-trend-to-action trace, denominator/comparability table, jurisdictional rule-source matrix, unresolved contradictions, missing evidence and reserved-decision queue. Every entry records source/version/date, value/unit/denominator/window, applicability, owner/reviewer, assumptions, uncertainty, privacy/license, status, `decision_not_made`, `outcome_unknown` and stop reason.

## Unknown and stop conditions

Stop if a root is missing without a stop artifact, device/version identity conflicts, personal-data authority is inadequate, event facts cannot be reconciled, denominator definitions conflict, a rule source is not current/controlled, or a potential immediate safety concern needs human action. Do not label missing reports as absence of events.

## Authority boundary

Do not close complaints/events, determine causality/seriousness/reportability/signal/benefit-risk, submit, initiate recall/FSCA/field action, approve CAPA/risk acceptance, contact external parties, diagnose/treat or declare compliance.

## Qualified review

Route to named complaint/vigilance, medical safety, quality/CAPA, risk, epidemiology/biostatistics, regulatory, privacy/legal and manufacturer-authority reviewers. Record separately issued professional decisions by stable reference; until then retain `decision_not_made`.
