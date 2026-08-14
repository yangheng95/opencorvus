---
name: medical-device-postmarket-surveillance-method
description: Builds source-bound medical-device installed-base, complaint, adverse-event, vigilance, trend, PMCF, RWE, field-action, CAPA and risk-file evidence packs. Use for postmarket review preparation, never causality, reportability, recall, compliance, filing or clinical action.
---

# Medical Device Postmarket Surveillance Method

## Purpose and authority

Prepare reproducible postmarket evidence for named qualified reviewers. A completed evidence pack is not a complaint closure, safety signal, benefit-risk conclusion, vigilance report, recall decision, CAPA approval or compliance statement.

- Do not diagnose/treat, contact patients/clinicians/regulators, operate or modify a device, or disclose unauthorized health data.
- Do not decide causality, seriousness, expectedness, reportability, signal, benefit-risk, recall/field action, compliance or submission.
- Do not create/close/recode complaints, submit reports, initiate recall/FSCA/correction/removal/withdrawal or approve CAPA/risk acceptance.
- Reserve decisions to complaint/vigilance, medical safety, quality/CAPA, risk, epidemiology/biostatistics, regulatory, privacy/legal and manufacturer authorities.

## Freeze the postmarket baseline

Freeze manufacturer and economic-operator roles; device family/model/software/accessory/UDI and intended-use scope; jurisdictions and current controlled regulatory procedures; production lot/serial or de-identified unit scope; distribution, installed-base and utilization sources; complaint/event systems and terminology versions; PMCF/RWE protocol/data sources; risk-file/CAPA/action versions; evidence cutoff; privacy/data-use/license boundaries; owners and qualified-review roles.

Assign stable IDs to device configurations, units, complaints, events, device problems, health effects, investigations, cohorts, analyses, PMCF evidence, risk records, CAPAs and actions. Record exact locator/version/effective/observation/retrieval dates. Keep raw narrative, normalized terminology, supplied interpretation, derived rate, hypothesis and reserved decision separate. A missing complaint, report or denominator is unknown—not evidence of absence.

## Field procedure

1. Build a controlled device and market baseline. Distinguish family, model, version, accessory and combination configuration. Bind distribution/installed-base/utilization denominators to jurisdiction, period and exact basis such as units shipped, active devices, procedures or patient exposures.
2. Trace complaint intake from channel and receipt timestamp to device identity, event date, raw narrative, reporter role, duplicate-link evidence, initial code source and follow-up as recorded. Preserve raw and normalized fields; never merge, close or recode a complaint.
3. Construct event chronology across device problem, person health effect, use/environment context, investigation and returned-product evidence. Apply only the cited terminology version. Record jurisdictional rule sources and unresolved applicability; never calculate a deadline or reportability outcome from memory.
4. Define trend numerator, denominator, exposure window, cohort, stratification, duplicate rule and capture process before any descriptive calculation. Preserve formula/version and uncertainty. Compare periods only when definitions and capture are compatible. Link PMCF and RWE to protocol, population, deviations and data-quality limits.
5. Trace field-action/CAPA evidence from problem statement and investigation through supplied cause, proposed/authorized/executed action, affected population, risk-file linkage, verification and effectiveness. Preserve state transitions. Do not label an action a recall or authorize/execute it.
6. Reconcile complaint-to-event-to-trend-to-action by stable IDs. Retain conflicting device identity, event facts, denominators, terminology and action state. Assign every regulatory, medical or risk decision to a qualified owner.

## Parallel branches and join

### Installed Base and Complaint Intake Analyst

Freeze device/version/market identity, complaint sources, intake chronology and exposure denominators. Stop on device mismatch, duplicate ambiguity, undefined denominator, privacy failure, jurisdiction uncertainty or live-system request.

### Adverse Event and Vigilance Evidence Analyst

Trace event facts, device problems, health effects, investigation and jurisdictional rule sources while preserving raw terms. Stop on identity conflict, missing chronology, outdated rule source, unauthorized medical data or requested reportability/causality decision.

### Trend Benefit-Risk PMCF and RWE Analyst

Reconcile cohort, numerator, denominator, exposure window, capture/duplicate rules, PMCF and RWE evidence. Stop on noncomparable cohorts, unknown denominator, uncontrolled terminology, missing protocol or data-use restriction. Never declare a signal or benefit-risk.

### Field Action CAPA and Effectiveness Analyst

Trace issue, investigation, supplied cause, action/CAPA, affected population, risk-file update, verification and effectiveness. Stop on missing authority, unclear action state, unsupported cause, absent verification or requested execution.

### Medical Device Postmarket Review Owner

Start only after every root returns or explicitly stops. Reconcile stable device/complaint/event/cohort/action IDs, denominator definitions, terminology versions and jurisdictional sources. Preserve contradictions and output a qualified-review pack plus reserved-decision queue.

## Reusable assets

- `assets/medical-device-postmarket-scope-authority-installed-base-baseline.md`: device/market/authority identity and denominator sources.
- `assets/medical-device-complaint-adverse-event-vigilance-ledger.csv`: complaint/event chronology, terminology, investigation and rule-source questions.
- `assets/medical-device-trend-pmcf-real-world-performance-register.md`: cohort/rate definitions, PMCF/RWE provenance, comparability and uncertainty.
- `assets/medical-device-field-action-capa-risk-file-trace-register.md`: action/CAPA/risk-file linkage and verification/effectiveness evidence.
- `assets/medical-device-postmarket-qualified-review-pack.md`: cross-branch trace, conflicts, missing evidence and decision queue.

Read selected assets before output and preserve stable identity, source/version/date, cutoff/effective date, value/unit/denominator/window, owner/reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license, status, `decision_not_made`, `outcome_unknown` and stop/escalation fields.

## Conflict handling and stop boundary

Never select the most favourable event interpretation or denominator. Record competing sources and consequences. Stop on identity mismatch, unauthorized personal data, uncontrolled rule/terminology version, undefined denominator, material contradiction, missing authority, requested external action or immediate safety concern. Escalate through an approved human channel without drafting operational instructions or filings.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md`, `references/PRIMARY-SOURCES.md` and `references/UPSTREAM-LICENSE`. This Skill is a bounded MIT adaptation of the upstream MDR evidence structure. Retain only complaint-to-event-to-trend-to-CAPA/risk-file/PMS/PSUR/PMCF trace concepts. Exclude classification, compliance, fixed deadlines or thresholds, scripts/APIs, causality/reportability, recall/submission and clinical action. OpenCorvus adds clean-room stable-ID governance, independent roots, explicit join, conflict preservation and high-risk boundaries. Recheck current jurisdictional sources for every task.
