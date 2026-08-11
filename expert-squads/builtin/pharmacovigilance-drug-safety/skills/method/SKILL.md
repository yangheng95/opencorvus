---
name: pharmacovigilance-drug-safety-method
description: Prepare source-bound pharmacovigilance case-quality, aggregate-signal, RSI, risk-plan, and signal-lifecycle evidence when a qualified safety review needs reproducible records without medical or regulatory decisions.
---

# Pharmacovigilance Drug Safety Method

## Establish the evidence boundary

1. Record a scope ID, product and event definitions, authorized source inventory, source versions, data-lock date, jurisdictions or programs, privacy class, responsible owner, and named qualified reviewers.
2. Separate spontaneous, solicited, clinical-study, literature, registry, and other streams. Do not combine their populations, duplicate rules, or denominators without a documented, reviewer-approved rule.
3. Minimize personal data. Keep reporter language, source facts, processor-entered fields, derived values, and reviewer decisions distinguishable. Preserve stable locators to every source.
4. Freeze the Medical Dictionary for Regulatory Activities or other coding dictionary name and version when coded terms are supplied. Never code, recode, translate clinical meaning, or invent missing facts.
5. State the decision explicitly not made. This method never decides diagnosis, treatment, seriousness, causality, expectedness, reportability, signal validity, reporting clock/destination, submission, label/RSI/risk-plan change, or regulatory action.

## Build the case and duplicate-quality ledger

Create a chronological version chain for every supplied initial report and follow-up. Do not overwrite prior values. For each field record case ID, version ID, source ID, locator, received/event/follow-up dates with their supplied semantics, observed value, unit, provenance state, privacy class, and conflict or missingness.

Keep these concepts separate:

- An adverse event is an observed medical occurrence; an adverse drug reaction includes a relationship concept. Do not substitute one for the other.
- Seriousness is a regulatory outcome/criterion concept; severity describes intensity. Do not infer either from the other.
- Verbatim reporter language, dictionary coding, medical assessment, expectedness, causality, and reportability are different records with different qualified owners.
- A completeness checklist may identify present or absent supplied elements; it is not a declaration that a case is valid or reportable.

For potential duplicates, compare only authorized evidence such as product/event, dates, demographics, geography, reporter/source, study or literature identifiers, and narrative-independent attributes. Record match factors, mismatches, unknowns, and candidate group ID. Never merge, delete, or declare duplicate records. Escalate to the authorized case processor.

## Reproduce descriptive aggregate measures

Freeze product/event definitions, dictionary/version, extract/source/version, data lock, inclusion/exclusion and deduplication state, comparator, strata, and all four cells. Define the 2-by-2 table explicitly: `a` product-event, `b` product-other events, `c` comparator-event, and `d` comparator-other events, or preserve the authorized protocol's definitions if different.

Where cells and protocol allow, calculate:

- `PRR = (a / (a + b)) / (c / (c + d))`
- `ROR = (a * d) / (b * c)`

Preserve input cells, formula version, precision, rounding, any protocol-supplied continuity correction, and confidence-interval method. Do not choose a generic correction, threshold, or cutoff. A disproportionality measure is a screening statistic, not incidence, risk, causality, clinical importance, or a validated signal. Spontaneous reporting lacks a reliable exposed-population denominator and cannot establish incidence.

Document small counts, duplicates, stimulated reporting, missingness, indication and channeling confounding, co-medication, notoriety, temporal changes, multiple testing, competition bias, database coverage, and coding drift. Run sensitivity variants only when the owner authorizes their rules, and label them separately.

## Trace RSI, risk plans, signals, and actions

Build immutable chains for Reference Safety Information (RSI) versions and effective dates, risk-plan versions and commitments, signal records, evidence additions, decisions, actions, and completion evidence. Treat jurisdictions and effective periods separately.

Use detection, validation, confirmation, analysis/prioritization, assessment, recommendation, and action as a trace vocabulary only when it matches the governing procedure. Never infer stage completion from the presence of a document. Separate evidence creator, reviewer, medical decision owner, regulatory owner, action owner, due-date source, and closure approver. Record overdue-looking or inconsistent items as questions, not compliance findings.

## Join the three branches

Require all branches to use compatible scope and data lock or document why they differ. Cross-link case population definitions and counts to aggregate cells; cross-link signal evidence to the RSI and risk-plan versions effective at the relevant time; retain superseded versions and conflicting evidence. Classify each branch as complete, qualified-review-required, stopped, or superseded. Do not silently reconcile different counts, dates, term versions, populations, or decisions.

Populate the five assets in `assets/`. Every material row must include artifact or row ID, artifact version, source ID/locator/version/date, data-lock/effective date, value/count and unit/denominator, owner, qualified reviewer, jurisdiction/applicability, assumptions, uncertainty/confidence, privacy/license constraints, status, decision explicitly not made, and stop condition/reason.

## Stop and escalate

Stop on unauthorized personal data, unverifiable sources, mixed unexplained data locks, unknown dictionary versions, unresolvable case populations, missing denominators for rate requests, or an instruction to contact a patient/reporter/regulator, write to a safety system, submit an ICSR or aggregate report, or change RSI/labels/risk plans. Do not supply time-sensitive reporting requirements from memory.

Route case processing and coding to qualified processors and coders; medical assessment to a safety physician; signal statistics to an epidemiologist or biostatistician; governance and regulatory decisions to the QPPV, signal committee, and regulatory owner; privacy and disclosure to privacy/legal reviewers. The artifacts are evidence-preparation aids, not medical, legal, or regulatory advice.

## Source boundary

Read `references/UPSTREAM.md` before representing provenance. This method is a bounded modification of retained safety-reporting ideas from the pinned MIT K-Dense source. It does not copy or enable upstream scripts, templates, tools, APIs, clinical-report generation, or current-law defaults. The complete upstream license is in `references/LICENSE.md`.
