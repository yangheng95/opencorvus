---
name: life-sciences-regulatory-method
description: Prepare versioned life-sciences and medical-device regulatory readiness evidence across intended use, claims, clinical and technical evidence, jurisdiction-specific current-source questions, candidate classification/pathway hypotheses, essential-principle or GSPR mapping, quality/design/risk traceability, software and cybersecurity, and post-market inputs. Use for qualified-review preparation and gap analysis, never for diagnosis, clinical conclusions, classification, conformity, risk acceptance, filing, or approval.
---

# Life Sciences Regulatory Readiness Method

## Freeze the product baseline

1. Record manufacturer/legal entity, product/model/software version and configuration, lifecycle stage, intended purpose/use, indications, users, patient population, use environment, contraindications/limitations supplied, claims/labeling version, variants/accessories, target jurisdictions, evidence cutoff, data boundary, and decision owners.
2. Refuse to combine evidence from incompatible configurations. Treat any missing intended-use or claim element as a gap, not an invitation to infer.
3. Assign stable requirement, claim, evidence, risk, gap, and decision IDs. Preserve document version, approval status, observation date, applicability, owner, and uncertainty.

## Trace claims to clinical and technical evidence

1. Atomize each claim in [the product/claims matrix](assets/product-claims-evidence-matrix.md) and preserve its exact source location and version.
2. Map the applicable configuration, population, environment, evidence design, endpoint, result, limitation, and owner. Separate analytical/technical performance, usability, biocompatibility, electrical/mechanical, software, cybersecurity, clinical, and real-world/post-market evidence where applicable.
3. Expose unsupported extrapolation, contradictory or negative evidence, population gaps, version drift, and product changes that may invalidate evidence. Leave clinical sufficiency to qualified reviewers.

## Build jurisdiction-specific current-source questions

1. For every target market, record authority, official document identifier/title, version/effective date, retrieved date, official URL, applicability question, and qualified owner in [the market/pathway source log](assets/market-pathway-current-source-log.md).
2. Frame classification and pathway only as hypotheses tied to exact product facts and current official provisions. Never treat memory, secondary summaries, or the upstream Skill as current law or guidance.
3. Map candidate essential principles or General Safety and Performance Requirements (GSPR), labeling/language, economic-operator, registration, quality, evidence, software/cybersecurity, post-market, vigilance, and renewal questions only when current official sources support doing so.

## Reconcile quality, design, risk, and post-market evidence

1. Trace user need → design input → design output → verification/validation → claim and product version in [the quality/risk register](assets/quality-risk-traceability-register.md).
2. Trace hazard → sequence of events → hazardous situation → harm → initial risk → control → implementation/verification → supplied residual-risk decision → production/post-market signal. Do not accept residual risk.
3. Record quality-system scope, design reviews, changes/configuration, suppliers/manufacturing, software lifecycle/cybersecurity, complaints/vigilance, Post-Market Surveillance (PMS), and Corrective and Preventive Action (CAPA) evidence with version/date, approval status, owner, and open finding.

## Join readiness without deciding it

Require three independent branches and a common product/configuration/intended-use/claims baseline. Link each requirement hypothesis to current source, product fact, evidence, trace, gap, dependency, and owner in [the readiness register](assets/regulatory-readiness-register.md). Keep classification/pathway, evidence sufficiency, conformity, residual risk, and submission status pending qualified decisions. Never convert missing evidence to `not applicable`.

## Authority and stop boundary

Never diagnose, recommend treatment, author/change claims, decide classification or pathway, determine clinical sufficiency, claim conformity/compliance, accept risk, approve design, close CAPA, contact an authority, sign, file, submit, or represent approval. Stop on ambiguous product/claims version, incompatible evidence, absent current official source, unauthorized patient/safety data, unverified risk control, or missing qualified owner. Require jurisdiction-specific regulatory, clinical, quality, design/risk, engineering, software/cybersecurity, post-market, privacy, legal, and executive review.

## Assets

- Trace product and claims in [Product Claims Evidence Matrix](assets/product-claims-evidence-matrix.md).
- Register jurisdiction sources and hypotheses in [Market Pathway Current-Source Log](assets/market-pathway-current-source-log.md).
- Trace design, quality, risk, software, and post-market evidence in [Quality Risk Traceability Register](assets/quality-risk-traceability-register.md).
- Join gaps and decision gates in [Regulatory Readiness Register](assets/regulatory-readiness-register.md).

## Adaptation boundary

Apply only the bounded concepts recorded in [upstream provenance](references/upstream.md). Do not invoke upstream scripts, stale rules, global agent protocols, or any authority excluded by this package.
