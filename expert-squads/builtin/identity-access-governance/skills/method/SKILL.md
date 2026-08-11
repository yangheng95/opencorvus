---
name: identity-access-governance-method
description: Prepare evidence for enterprise identity lifecycle, account-entitlement correlation, access requests, roles, segregation of duties, certifications, dormant and orphaned accounts. Use for bounded Identity Governance and Administration review without provisioning, revocation, access approval, compliance determination or live-directory action.
---

# Identity Access Governance Method

## Freeze authority, population and decision

Record the organization, workforce and non-workforce populations, authoritative source, directory and application scope, tenants, review period, data cutoff, effective-date basis, privacy classification, system and evidence versions, identity and application owners, qualified reviewers and requested human decision. Assign stable IDs to identities, lifecycle events, accounts, groups, roles, entitlements, requests, policies, certifications, decisions, exceptions and evidence.

Do not assume that Human Resources is authoritative for every identity type or attribute. Contractors, partners, service accounts, shared accounts, privileged accounts and machine identities may use different sources and owners. Record source precedence and conflicts. Separate employment or engagement status from digital account status and access authorization.

## Reconcile Joiner-Mover-Leaver lifecycle

Model Joiner-Mover-Leaver events as dated source observations with prior and new values, effective time, observation time, event type, source record and downstream trigger. Preserve pre-hire, future-dated, rehire, concurrent-role, leave, internal transfer, vendor-extension, termination-correction and late-arriving events. Do not infer an employment action or make an HR decision.

Reconcile each event population to downstream account and entitlement populations. Measure complete, missing, duplicate, late and conflicting events with explicit denominators. A missing downstream match may reflect latency, identifier change, scope exclusion or data-quality failure; it is not automatically an access failure.

## Correlate identities, accounts and entitlements

Use declared deterministic keys before probabilistic candidates. Preserve each match rule and version. Distinguish asserted ownership, verified deterministic mapping, candidate mapping, shared or service ownership and unknown owner. Keep aliases and many-to-many relationships. Trace direct assignments, group inheritance, nested groups, role membership, birthright rules and temporary grants to effective entitlements.

Reconcile populations by system and tenant. Record accounts without an in-scope identity, identities without expected accounts, duplicate accounts, dormant accounts, stale feeds, entitlement-path ambiguity and conflicting identifiers. Call an account orphaned only under the supplied definition and qualified ownership review; one failed join is insufficient.

## Trace requests, roles and control evidence

Link requestor, beneficiary, entitlement or role, business justification, policy version, approver identity and capacity, decision time, duration, fulfillment evidence, exception and revocation expectation. Separate birthright, requested, inherited, emergency, privileged and temporary access.

Treat role mining as descriptive evidence: document population, features, grouping method, version, exceptions and business validation. Do not create or approve roles. For segregation of duties, bind the exact rule ID, rule version, effective period and applicable systems to the entitlement combination. Report a potential conflict and counterevidence; only authorized control owners decide whether a violation or approved exception exists.

## Review certifications and account exceptions

Freeze campaign population, snapshot time, systems, entitlements, reviewer assignment and decision vocabulary. Reconcile included, excluded, completed, delegated, expired and default or unchanged decisions. Test whether remediation evidence references the same account, entitlement, certification decision and effective interval. A ticket status is not proof of production change.

Classify dormant, stale, duplicate, orphaned, shared, service and privileged accounts through supplied definitions. Preserve exception owner, justification, approval evidence, expiry and monitoring. Do not deactivate or alter an account.

## Join evidence and preserve uncertainty

Run authoritative lifecycle, account-entitlement, request/role/segregation-of-duties and certification/orphan branches from one frozen baseline. Join by stable IDs and reconcile effective dates, population totals and source versions. Keep raw observation, normalized value, derived correlation, analyst hypothesis and attributed human decision separate.

Every output row records source locator/version/date, cutoff/effective date, unit or denominator where relevant, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy and licence boundary, status, decision_not_made and stop reason. Preserve contradictions and false-positive/false-negative limitations.

## Stop and authority boundary

Stop when authority, population, identity keys, source precedence, entitlement meaning, policy version, certification snapshot, privacy purpose or qualified ownership is missing or conflicting. Do not query live directories, use credentials, contact identities, provision or disable accounts, grant or revoke access, reset credentials, approve requests or exceptions, declare a segregation-of-duties violation, certify compliance or accept risk.

Identity owners, Human Resources, application and data owners, Identity and Access Management administrators, security, privacy, audit, legal and authorized governance bodies retain every employment, ownership, access, remediation, compliance and risk decision.
