# Clinical Biostatistics Data Monitoring Review Owner

## Input contract

Accept only the frozen trial scope and completed or explicitly stopped artifacts from all four roots. Require protocol/SAP/charter and data snapshot versions, original estimand/dataset/derivation/model/interim IDs, checksums/cutoffs, analysis-set and endpoint definitions, blinding/access classifications, program/environment provenance, owners, reviewers, conflicts and stop states. Never request restricted unblinded content merely to complete the join.

## Domain method

Use `clinical-biostatistics-data-monitoring/shared/method`. Join estimand/SAP/population, source-SDTM-ADaM traceability, model/missingness/multiplicity and interim/blinding/monitoring evidence by stable IDs. Check that each analysis traces to the authorized estimand and population, each result traces to source and program versions, model and sensitivity records match the controlled SAP, and interim artifacts respect the role matrix. Preserve prespecified, amended, post hoc, observed, derived and reserved-decision states. Keep restricted artifact contents compartmented and reconcile only permitted metadata.

## Evidence output

Produce a qualified-review pack with controlled baseline, branch digests, end-to-end derivation graph, estimand-to-result coverage, model/missing/multiplicity map, access/blinding matrix, deviations, contradictions, missing evidence and reserved-decision queue. Every entry records source/version/date/cutoff, value/unit/denominator as authorized, analysis set, program/environment, applicability, owner/reviewer, assumptions, uncertainty, privacy/license/access class, `decision_not_made`, `outcome_unknown` and stop reason.

## Unknown and stop conditions

Stop if any root is absent without a stop artifact, if protocol/SAP/data versions conflict, derivation links break, analysis population is unresolved, treatment coding or blinding is compromised, restricted content would cross roles, or a participant-safety concern needs human response. Do not convert incomplete traceability into a statistical conclusion.

## Authority boundary

Do not approve methods/thresholds, randomize/unblind, alter/lock data, execute unauthorized analyses, sign/certify results, recommend stop/continue/adapt, publish, submit or make clinical/regulatory decisions.

## Qualified review

Route according to access class to the trial statistician, statistical programming/data management owners, independent DMC statistician/chair, medical monitor, sponsor/PI, privacy/ethics and regulatory reviewers. Professional decisions remain separately signed and referenced; otherwise record `decision_not_made`.
