---
name: internal-audit-control-assurance-method
description: Evidence-first internal-audit method for charter-bound audit universes, risk prioritization, control design and walkthroughs, population and sample testing, operating effectiveness, exceptions, findings, root cause, remediation and closure verification. Use for internal-audit control-assurance work that must preserve criteria, evidence, uncertainty and qualified-review authority.
---

# Internal Audit Control Assurance Method

## Establish engagement authority and independence

Record the engagement ID, mandate or charter source, commissioning body, audit owner, objectives, entity/process/system perimeter, period, cutoff, confidentiality, applicable criteria and intended qualified reviewers. Record actual or perceived conflicts, prior management responsibility and reliance restrictions. Stop when the mandate, access authority, independence safeguard, criteria or reviewer is absent. Internal audit must not assume management's control ownership or an external auditor's opinion responsibility.

State `decision_not_made`: no audit opinion; no effective/ineffective overall conclusion; no fraud, illegality, material weakness or significant deficiency determination; no risk acceptance; no control, transaction, access or production-system change; no finding severity or closure approval.

## Build a source-bound audit universe and risk view

Assign stable IDs to entities, processes, systems, products, third parties, obligations, risks, controls, evidence and prior findings. Define the universe population and reconcile it to authorized organization, process, system and third-party inventories. Preserve omitted, duplicated, inactive, acquired, divested and newly changed items rather than silently normalizing them.

For each auditable unit record objectives, responsible owner, financial/operational/compliance/technology dependencies, change events, prior coverage, open issues and source dates. Risk prioritization must show factor definition, source, direction, unit or ordinal scale, weight if owner-supplied, uncertainty and conflicts. Never invent a score, weight, threshold, audit cycle or mandatory frequency. A priority is planning evidence, not a statement that an area is safe or unsafe.

## Map objectives, risks and control design

Create a risk-control-objective chain: business objective -> unwanted event or condition -> owner-supplied risk statement -> control objective -> control activity -> evidence -> accountable owner. Distinguish preventive, detective and corrective controls; entity-level and process controls; manual, automated and information-technology-dependent manual controls; key and supporting controls only when the approved methodology defines those terms.

Evaluate design by asking whether the stated control, if performed by an authorized and competent owner at the documented precision and frequency, could address the stated risk. Evaluate implementation separately by tracing one or more actual instances through initiation, authorization, processing, exception handling, recording and retention. A walkthrough establishes understanding and implementation evidence; it does not by itself prove sustained operating effectiveness.

For information produced by the entity, record report/query name, system, parameters, period, extraction time, logic/version, access role, completeness and accuracy control, transformation and reconciliation. Stop when control identity, owner, frequency, population, evidence expectation or report lineage cannot be established.

## Test operating effectiveness

Freeze the test objective, control version, period, population definition, expected count, obtained count, completeness reconciliation, sampling unit, selection method, sample size authority and planned procedures before recording results. Keep full-population analytics distinct from sample tests. Never substitute convenience selection for the approved sampling approach or replace an unavailable item without retaining the original selection and reason.

Use an evidence mix appropriate to the test objective: inquiry for context; observation for performance at a point in time; inspection for retained evidence; and reperformance for independently executing the defined procedure with authorized copies. Inquiry alone is insufficient. For every sample retain source record, date, performer, reviewer, required attributes, observed evidence, procedure, result, exception and uncertainty. Do not extrapolate beyond the documented population and method.

Classify a test result only against operator-supplied criteria as passed, exception, not applicable, not tested or inconclusive. Missing evidence is not automatically a control failure; it is an evidence limitation requiring owner resolution. Conversely, later-created evidence must not be represented as contemporaneous performance.

## Develop findings and remediation evidence

Keep observation, exception and audit finding distinct. A proposed finding must trace condition, applicable criterion, affected population or examples, cause hypothesis, consequence mechanism, counterevidence, scope limitation and responsible reviewer. Separate direct evidence from inference. Do not infer intent, misconduct, fraud or legal breach.

Root-cause work should test competing explanations across people, process, technology, governance, information and external dependencies. Record why evidence supports or contradicts each explanation. A management response is attributed evidence, not agreement. Remediation records must identify the approved action, owner, due date source, intended risk/control effect, dependencies, implementation evidence and residual unknowns.

Closure verification requires the authorized closure criterion, implemented control/version, affected population, stabilization period where supplied, fresh operating evidence, retest method and exceptions. A completed ticket, policy publication or management assertion is not proof of sustained operation. Only the authorized Internal Audit owner may accept scope limits, classify severity or close a finding.

## Reconcile branches and conflicting evidence

Join the exact universe, design, testing and remediation artifacts by stable IDs. Reconcile scope totals, control versions, periods, population counts, owner identities and criteria versions. Preserve conflicts such as a walkthrough describing one procedure while test evidence shows another, a universe item lacking coverage, or remediation evidence predating approval. Do not average incompatible evidence or select the more favorable source.

The review pack must state coverage, exclusions, unresolved conflicts, source limitations, outcome unknowns, decisions not made, named decision owners and next evidence required. Use the five assets under `assets/` as reusable structures. Read `references/PRIMARY-SOURCES.md` for method-source applicability and `references/SOURCE-PROVENANCE.md` for the rejected candidate and clean-room boundary.

## Stop and qualified review

Stop on absent mandate or independence safeguard; unauthorized or privileged data; unclear criteria; unverifiable source/version/date; incomplete population without an accepted limitation; mixed control versions; missing units; evidence alteration; pressure to suppress an exception; or any request to operate a control, access a production system, classify fraud/material weakness, accept risk or issue an opinion.

Route engagement authority and final communication to the Chief Audit Executive and audit committee as applicable; control operation and remediation to management; legal questions to counsel; financial-reporting internal-control opinions to the external auditor; privacy/security matters to their accountable owners. Label every output `outcome_unknown` until the named qualified reviewer records a decision.
