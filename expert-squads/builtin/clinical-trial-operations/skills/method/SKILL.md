---
name: clinical-trial-operations-method
description: Prepare protocol-versioned clinical-trial operations evidence across startup and site readiness, role training and delegation, screening/enrollment/visit flow, deviation facts, critical-to-quality monitoring, data-query and system reconciliation, safety-event routing, Trial Master File completeness, and closeout dependencies. Use for qualified operational review under explicit study, site, jurisdiction, system, privacy, source, version, audit-trail, and authority boundaries; never use for eligibility, consent, treatment, dosing, unblinding, safety adjudication, activation, submission, database lock, certification, CAPA approval, or stop/continue decisions.
---

# Clinical Trial Operations Method

## Freeze study, protocol, site, system, and authority

1. Record study ID, protocol/amendment/version/effective period, sponsor, site, country/jurisdiction, study stage/status, approved operational plans, systems of record and export versions, evidence cutoff/time zone, participant-data classification, authorized de-identification, role/delegation map, escalation routes, responsible owner, and qualified reviewers.
2. Assign stable requirement, artifact, event, subject, visit, deviation-fact, risk, query, reconciliation, safety-event, TMF-document, issue, and decision IDs. Preserve source/location/version/date, units, applicability, uncertainty, privacy class, audit-trail reference, owner, reviewer, and status.
3. Refuse to combine incompatible protocol effective periods, sites, jurisdictions, participant-data purposes, systems, definitions, units, or role authorities. Missing evidence remains an open issue; it never becomes `not applicable` or approval.

## Assess startup and site readiness

1. In [the site-readiness matrix](assets/site-readiness-and-activation-evidence-matrix.md), trace each requirement to an approved plan or current official source selected by a qualified owner, protocol/site/jurisdiction applicability, evidence artifact, version/date, signature/approval/effective state, training/delegation, facility/system dependency, owner, reviewer, and issue.
2. Keep `present`, `current`, `approved`, `effective`, `applicable`, and `ready for owner decision` distinct. Approval evidence is not authority for the Agent to activate a site.
3. Map ethics/regulatory records, agreements, qualification/training, delegation, pharmacy/lab/facility/equipment, investigational-product and specimen logistics, vendors, systems, privacy/security, recruitment material, essential documents, and open dependencies only when supplied and authorized.

## Reconcile participant flow, visits, and deviation facts

1. Use [the enrollment, visit, and deviation ledger](assets/enrollment-visit-and-deviation-ledger.csv) with de-identified subject IDs. Keep screened, consented, enrolled, randomized, treated, completed, discontinued, withdrawn, and lost-to-follow-up events separate under supplied definitions.
2. Every rate carries numerator, denominator, unit, window, site/protocol scope, missingness, and source version. Determine visit status only from the protocol/amendment rule and effective date supplied for that site; preserve time zone and exact event timestamp.
3. Record a potential deviation as observed fact, rule location/version, event evidence, impact question, counterevidence, owner, reviewer, and pending classification. Do not determine eligibility, consent validity, protocol waiver, deviation category, or Corrective and Preventive Action (CAPA).

## Analyze critical-to-quality monitoring and data quality

1. In [the risk-based monitoring and data-quality plan](assets/risk-based-monitoring-and-data-quality-plan.md), trace critical-to-quality factor → failure mode → participant-protection/result-reliability effect → detection source → approved monitoring method → signal → issue → owner/review.
2. Use a threshold, frequency, priority, or trigger only when the approved plan/source, version, effective date, scope, rationale and decision owner are supplied. Current-source review is mandatory; never invent a jurisdictional deadline or universal threshold.
3. Calculate missingness and query aging with explicit denominators, timestamps and units. Reconcile source/eCRF, laboratory, vendor, safety, Interactive Response Technology, investigational-product, specimen, and other systems only through authorized exports, stable IDs, transformations and audit-trail references. Do not edit, issue, close, freeze, or lock data.

## Check safety routing, Trial Master File, and closeout evidence

1. In [the safety routing and reconciliation log](assets/safety-event-routing-and-reconciliation-log.md), check capture, acknowledgement, route, follow-up, reconciliation and timing against the supplied approved workflow. Treat seriousness, causality, expectedness, relatedness, reportability and medical assessment as externally supplied qualified decisions.
2. In [the TMF and closeout pack](assets/tmf-closeout-and-operations-review-pack.md), compare the approved index/plan to expected artifacts. Distinguish expected, present, legible, current, signed/approved as applicable, superseded, duplicate, misfiled, restricted, and unresolved. Link process, country/site, milestone, owner, audit trail, retention/handoff and closeout dependency.
3. A complete checklist is not TMF certification, site closeout, retention authorization, database lock, or study closure.

## Join operations without deciding them

1. Require four independent branch artifacts and one compatible baseline. Link each joined issue to protocol/plan/source, critical-to-quality relevance, operational event, data/reconciliation, safety routing, document/dependency, evidence/counterevidence, owner, reviewer, escalation and decision gate.
2. Separate observed fact, operational hypothesis, medical/regulatory/ethics decision, action proposal, approval and live execution. Preserve dissent, superseded versions, audit trail and unresolved contradictions.
3. Use current authoritative sources as questions for qualified owners, not copied rules. Never describe a package output as compliant, submission-ready, activated, locked, certified, closed, or approved.

## Unknown, stop, and qualified review

Stop on conflicting protocol/site/system scope, unauthorized participant or safety data, missing delegation, absent audit trail, uncertain current source, missing escalation owner, suspected immediate participant risk, or any request to contact a participant/site/authority or write a live system. Require Principal Investigator, sponsor/medical monitor/safety, clinical operations, monitor, data management, biostatistics, Quality Assurance, TMF/records, pharmacy/laboratory/vendor owners, information security/privacy/legal, ethics, regulatory, and executive study owner.

## Assets and provenance

- Use [Site Readiness and Activation Evidence Matrix](assets/site-readiness-and-activation-evidence-matrix.md).
- Use [Enrollment, Visit, and Deviation Ledger](assets/enrollment-visit-and-deviation-ledger.csv).
- Use [Risk-Based Monitoring and Data Quality Plan](assets/risk-based-monitoring-and-data-quality-plan.md).
- Use [Safety Event Routing and Reconciliation Log](assets/safety-event-routing-and-reconciliation-log.md).
- Use [TMF Closeout and Operations Review Pack](assets/tmf-closeout-and-operations-review-pack.md).
- Read [upstream provenance and adaptation boundary](references/upstream.md). The Apache-2.0 license is preserved in [upstream-license.txt](references/upstream-license.txt). Upstream contributes bounded structure; the operational method and assets are clean-room OpenCorvus work.
