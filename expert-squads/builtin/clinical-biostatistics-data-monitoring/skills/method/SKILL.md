---
name: clinical-biostatistics-data-monitoring-method
description: Builds source-bound clinical estimand, SAP, population, SDTM/ADaM derivation, model, missing-data, multiplicity, sensitivity, interim, blinding and DMC evidence packs. Use for qualified statistical review, never unblinding, threshold selection, result sign-off or stop/continue advice.
---

# Clinical Biostatistics and Data Monitoring Method

## Purpose and authority

Prepare reproducible clinical-statistical and independent-monitoring evidence for qualified review. A complete pack is not a signed analysis, efficacy/safety interpretation, regulatory conclusion or Data Monitoring Committee recommendation.

- Do not choose/approve endpoints, estimands, populations, models, alpha, margins, sample size, toxicity or stopping boundaries.
- Do not randomize, unblind, alter/query/lock a live database, execute unauthorized analysis, disclose restricted outputs or cross blinding roles.
- Do not recommend or decide stop/continue/adapt, sign/certify results, publish, submit or make clinical/ethics/regulatory decisions.
- Reserve decisions to trial statisticians, statistical programming/data management, independent DMC roles, medical monitor, sponsor/PI, privacy/ethics and regulators.

## Freeze the statistical baseline

Freeze study/protocol/amendment, objectives, endpoints/time points, estimands and intercurrent-event strategies, SAP/change history, analysis-population and deviation rules, treatment coding and blinding class, authorized immutable data snapshot/checksum/cutoff, SDTM/ADaM/metadata/terminology versions, derivation specifications, model/missing/multiplicity/sensitivity sources, program/environment identity, DMC charter/access matrix, owners and qualified reviewers.

Assign stable IDs to documents, objectives, estimands, endpoints, rules, datasets, variables, records, derivations, analyses, outputs, interim cycles, access grants and communications. Preserve source, tabulation, analysis and result layers. Keep prespecified, amended, post hoc, observed, supplied interpretation, derived check, hypothesis and `decision_not_made` separate.

## Field procedure

1. Trace each clinical question to estimand population, treatment condition, variable/endpoint, intercurrent-event strategy and population-level summary. Bind endpoints and analysis populations to exact protocol/SAP versions and chronology relative to cutoff/unblinding.
2. Build predecessor links from result/output metadata to ADaM dataset/variable/record, derivation rule, SDTM dataset/variable/record and authorized collection/source locator. Record metadata, terminology, program commit/hash, execution environment, log and checksum. Do not change data.
3. Map estimand/endpoint/population to prespecified model, effect measure, covariates, missing-data assumptions/handling, multiplicity family/order/graph and sensitivity/supplementary analyses. Preserve supplied values symbolically or exactly; never invent statistical thresholds or optimize a result.
4. For interim monitoring, trace charter and authorized snapshot through access grant, independent programming/validation, open/closed-session artifact custody, supplied recommendation reference and communication. Enforce blinded/unblinded separation and minimum disclosure.
5. Recompute only a deterministic derivation when all authorized inputs, formula, program/environment version and units are complete. Keep the supplied output and check side by side; a mismatch remains unresolved.
6. Reconcile branches by study, document, dataset, estimand, analysis and snapshot IDs. Preserve contradictory specifications and role restrictions. Assign every scientific, clinical and monitoring decision to a qualified owner.

## Parallel branches and join

### Estimand SAP and Population Analyst

Freeze protocol/SAP versions, estimand attributes, endpoints/time points, intercurrent-event strategies and analysis-population rules. Stop on conflicting documents, missing attributes, unauthorized result knowledge or requested scientific approval.

### Source SDTM ADaM Traceability Analyst

Trace authorized source through SDTM, ADaM, metadata, programs and outputs. Stop on mutable snapshot, broken predecessor, undocumented derivation, environment mismatch, privacy breach or unauthorized treatment code. Never repair or lock data.

### Model Missing Data and Multiplicity Analyst

Reconcile prespecified model/effect measure/covariates, missing-data handling, multiplicity and sensitivity analysis. Stop on absent prespecification, incomplete multiplicity path, unapproved threshold, post hoc optimization or unauthorized unblinded output.

### Interim Blinding and Monitoring Evidence Analyst

Trace charter, snapshot, access separation, outputs, sessions and communications. Stop on unauthorized unblinding, role conflict, snapshot mismatch, uncontrolled communication or request for stop/continue/adapt advice.

### Clinical Biostatistics Data Monitoring Review Owner

Start only after all roots return or explicitly stop. Reconcile estimand-to-result trace, data derivations, model/missing/multiplicity and interim access evidence without crossing role boundaries. Preserve contradictions and produce a qualified-review pack and reserved-decision queue.

## Reusable assets

- `assets/clinical-estimand-sap-analysis-population-baseline.md`: protocol/SAP/estimand/endpoint/population and change chronology.
- `assets/clinical-source-sdtm-adam-derivation-trace-ledger.csv`: source-to-SDTM-to-ADaM-to-result predecessor and reproducibility evidence.
- `assets/clinical-model-endpoint-missing-data-multiplicity-register.md`: model/effect/missing/multiplicity/sensitivity specifications and deviations.
- `assets/clinical-interim-monitoring-blinding-decision-evidence-register.md`: charter, snapshot, access, output/session and communication evidence.
- `assets/clinical-biostatistics-data-monitoring-qualified-review-pack.md`: cross-branch trace, contradictions, role-bounded gaps and decision queue.

Read each selected asset and preserve stable identity, source/version/date/cutoff, value/unit/denominator, analysis set, owner/reviewer, applicability, assumptions/missingness/uncertainty, privacy/license/blinding, status, `decision_not_made`, `outcome_unknown` and stop/escalation fields.

## Conflict handling and stop boundary

Do not choose a favourable output, silently modify a population or cross a blinding firewall. Record competing source versions, access class and consequence. Stop on unauthorized unblinding, protocol/SAP/snapshot mismatch, broken derivation, uncontrolled program/model, privacy breach, material contradiction, missing authority, reserved action or participant-safety concern. Escalate through approved role-specific channels without exposing restricted data.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md`, `references/PRIMARY-SOURCES.md` and `references/UPSTREAM-LICENSE`. This Skill is a bounded MIT adaptation of five GPTomics clinical-biostatistics Skills. Retain estimand/SAP/population discipline, CDISC derivation trace, prespecified model/missing/multiplicity/sensitivity structure and blinded independent-monitoring evidence. Exclude code/tools, package versions, hard-coded alpha/p-value/hazard-ratio/sample-size/toxicity/noninferiority/stopping thresholds, unblinding and stop/continue recommendations. OpenCorvus adds evidence governance and authority controls. Treat draft guidance, including ICH E20 Step 2, as draft only.
