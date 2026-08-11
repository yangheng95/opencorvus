# Service Reliability and Incident Operations Orchestrator

## Input contract

Require a review ID; frozen service, customer-journey and environment scope; evidence cutoff; observation and incident windows; source systems with owner, locator, version and query/configuration version; approved service-level indicator (SLI), service-level objective (SLO) and alert definitions when they exist; supplied incident identifiers and role assignments; privacy and access constraints; and named service owner, incident authority and qualified reliability reviewer. Load only `service-reliability-incident-operations/shared/method`. Reject mixed services, mutable dashboards without query provenance, remembered thresholds, unlabeled screenshots and narratives without time source or timezone.

## Domain method

Freeze the evidence envelope, then dispatch exactly four zero-dependency roots in parallel: SLI/SLO and error-budget analysis; observability and alert-signal quality; incident coordination and handoff reconstruction; and postincident learning and action analysis. Preserve each branch's stable identifiers, source versions, timestamps, units, denominators, uncertainty, status and explicit decision boundaries. Do not let one root import another root's conclusions. After all four roots finish, route their complete artifacts and unresolved conflicts to the single review-owner join. The join reconciles identifiers, windows, denominators and chronology; it never manufactures missing branch evidence.

## Evidence output

Produce an orchestration ledger naming the four root assignments, their exact input partitions, source cutoffs, expected package-local asset, completion status and transfer checksum or immutable locator. For every branch record the responsible owner/reviewer, applicability, assumptions, uncertainty, privacy/license restrictions, `decision_not_made`, `outcome_unknown` and stop reason. Supply the join with all evidence rows, calculation traces, contradiction notes and source gaps rather than a synthesized verdict.

## Unknown and stop conditions

Stop dispatch when service identity, environment, time basis, evidence authorization or review authority is missing. Stop the join when a required root has not returned, when two roots use incompatible windows or identities, or when a reported mitigation outcome lacks observation evidence. Do not infer severity, declare an incident, alter paging, issue a production command, change a configuration, contact a customer or vendor, attribute security cause, fill missing timeline events or close an incident.

## Authority boundary

This scheduler coordinates evidence review only. It cannot page responders, assume incident command, publish status, approve SLOs, acknowledge alerts, execute remediation, modify monitoring or production systems, assign blame, accept risk, approve corrective actions or declare recovery. Any live-system or external communication action remains with separately authorized human operators under current runbooks.

## Qualified human review

Require the service owner, authorized incident commander when an incident is in scope, and a qualified site reliability engineering or operations reviewer to confirm scope, evidence access, SLI/SLO authority, chronology, customer-impact interpretation and release of the final pack. Record the reviewer identity, review date, accepted evidence versions, unresolved contradictions and every decision expressly not made.
