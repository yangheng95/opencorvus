---
name: public-health-surveillance-method
description: Prepare source-bound surveillance-system, case-definition, data-quality, epidemiologic measure, trend, reporting-lag, and multi-indicator evidence when qualified public-health teams need review support without case classification or action authority.
---

# Public Health Surveillance Method

## Freeze the surveillance boundary

1. Record scope ID, surveillance purpose and intended uses, monitored population/place/time, health event, event/case-definition ID/version/effective interval, reporting entities and flow, authorized sources/extracts/schemas, data cutoff, privacy class, analysis protocol, owner, and qualified reviewers.
2. Separate person-level records from aggregates and minimize identifiers. Keep observed events, source-entered classifications, source revisions, derived measures, analyst questions, qualified interpretations, and public-health decisions distinct.
3. Preserve onset, specimen, collection, receipt, result, classification, report, submission, and revision dates with their original time zones and semantics. Never substitute one for another without a labeled method.
4. State `decision_not_made`: no diagnosis; person-level case classification; signal, cluster, outbreak, epidemic, or emergency declaration; alert; contact tracing; system mutation; statutory report; public communication; isolation, quarantine, testing, treatment, vaccination, resource, or other intervention.

## Trace system, definitions, and data quality

Map the source-to-ingest-to-curation-to-analysis lineage with stable record and revision IDs. Retain initial, revised, withdrawn, duplicate-candidate, conflicting, and superseded states; never merge or overwrite them. Apply only the owner-supplied duplicate rule and leave resolution to authorized roles.

For each source and stratum record eligible records and fields, missingness, invalid or conflicting values, source coverage, revision count, and date-pair lag. Where definitions are supplied and inputs are compatible, calculate:

- `field_completeness = present_eligible_fields / eligible_required_fields`
- `record_completeness = records_meeting_supplied_completeness_rule / eligible_records`
- `timeliness_interval = later_authorized_date - earlier_authorized_date`
- `source_coverage = reporting_units_observed / reporting_units_expected_from_authorized_roster`

Do not infer sensitivity, predictive value positive, representativeness, acceptability, or stability from one proxy. Record evidence and limitations under the system's purpose and population.

## Build descriptive measures and trend questions

Freeze numerator event definition, denominator source and population, classification status, case-definition version, geography, interval, stratification, extract revision, and method version. Calculate only compatible values:

- `proportion = numerator / eligible denominator`
- `rate = events / authorized population or person-time`
- `absolute_difference = observed - comparison`
- `relative_difference = (observed - comparison) / comparison`, only when the comparison basis is valid and nonzero.

Keep crude and standardized measures separate. Use standard weights, baseline windows, smoothing, thresholds, control charts, models, multiplicity adjustments, precision, and rounding only when supplied by the approved protocol. A threshold crossing, excess, residual, model score, or unusual pattern is an analytic signal question—not a validated signal, cluster, outbreak, cause, or action trigger. Preserve reporting-lag and revision sensitivity.

## Integrate laboratory, genomic, syndromic, and other indicators

Create stable IDs for each laboratory test, genomic sequence, syndromic encounter, mortality record, environmental sample, or other indicator aggregate. Retain assay/platform/pipeline/nomenclature versions, sampling frame, date semantics, source coverage, missingness, numerator, tested or submitted denominator, and lag.

Never treat sequence counts as case counts, positivity as incidence, submitted samples as a population sample, syndromic encounters as diagnoses, or deaths as infections. Link sources only through an authorized stable key and rule; otherwise compare aggregates and label non-linkage. Before comparing indicators, verify compatible population, geography, interval, unit, denominator, cutoff, revision, and sampling frame. Record concordance, divergence, lead/lag, and competing explanations as qualified-review questions.

## Join without public-health inference

Require compatible scope, population, definition, source revision, time interval, cutoff, and denominator or preserve mismatch. Cross-link every measure to exact system-quality rows; cross-link every indicator comparison to its sampling frame and lag. Retain conflicting values rather than selecting one. Classify each branch and joined claim as evidence-complete, qualified-review-required, stopped, or superseded.

Populate exactly the five files in `assets/`. Every material row includes stable artifact/row ID, artifact version, source locator/version/date, effective date or cutoff, population/place/time, quantity/unit/denominator, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, and stop/escalation reason.

## Stop, escalate, and honor provenance

Stop on unauthorized personal data, unverifiable sources, unknown population or denominator, mixed case-definition versions, unexplained revisions/duplicates, unsupported time semantics, sparse-cell disclosure risk, or requests for live access or public-health action. Do not fetch current surveillance data, lineage names, reporting rules, or legal requirements from memory.

Route system lineage to surveillance informaticians/data stewards; definitions and interpretation to epidemiologists; measures and uncertainty to biostatisticians; assay and genomic meaning to qualified laboratory/genomic specialists; privacy and disclosure to privacy/legal staff; external messages and decisions to communications leadership and the public-health authority.

Read `references/UPSTREAM.md`, `references/ADAPTATION.md`, `references/LICENSE.md`, and `references/PRIMARY-SOURCES.md`. This is a bounded modification of source/version and reporting-lag concepts from the pinned K-Dense MIT Skill plus clean-room surveillance governance. It includes no upstream networking, scripts, endpoints, pathogen or lineage defaults, live conclusions, or public-health actions.
