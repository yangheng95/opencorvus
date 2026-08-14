---
name: enterprise-backup-recovery-assurance-method
description: Prepare evidence for workload recovery scope, backup jobs and copies, retention and immutability, catalog and hash integrity, isolated restore tests and recovery validation. Use for bounded enterprise backup assurance without live repository access, backup changes, production recovery, malware conclusions or risk acceptance.
---

# Enterprise Backup Recovery Assurance Method

## Freeze recoverability scope and authority

Record organization, business service, workload, data sets, applications, databases, configurations, keys or certificates, infrastructure definitions, dependencies, backup products and repositories, policy versions, job and copy population, backup window, authorized restore-test environment, evidence cutoff, classification, accountable owners and requested decision. Assign stable IDs to workloads, data sets, dependencies, jobs, copies, repositories, manifests, restore runs, validation checks and evidence.

Attribute Recovery Time Objective and Recovery Point Objective only to a supplied controlled source with owner, version, effective date and unit. Never choose an objective. Separate backup, high-availability replication, archival retention, application export and infrastructure reconstruction; each supports a different claim.

## Map workloads, data and dependencies

Trace each business service to protected workloads, databases, files, object stores, configurations, secrets or key escrow references, software media, infrastructure definitions and external dependencies. Record protection method and explicit exclusions. Reconcile in-scope data sets to protected objects with population counts and units.

Preserve recovery order and dependency claims as attributed owner inputs. An application binary without configuration or a database without logs, keys, identity dependencies or external services may not support the requested recovery. Record missing dependency evidence without designing a recovery architecture.

## Reconcile jobs, copies, retention and immutability

Freeze configured schedule, policy/version, observed jobs, source snapshots, repositories, accounts or regions, storage or media classes, replica relationships, copy generations, retention horizon, legal holds, encryption metadata and deletion protection. Reconcile successful, warning, partial, skipped, failed, expired, replicated and unknown outcomes.

A successful job label proves only the product state represented by that record. Treat immutable, offline and air-gapped as supplied claims requiring exact configuration and control evidence. Preserve gaps, inaccessible media, stale catalogs, retention conflicts and outcome_unknown. Do not change or test live controls.

## Validate catalog, manifest and hash evidence

Trace source snapshot to job, copy, catalog, manifest and validation result. Record algorithm, tool/version as supplied, generation and verification times, expected and observed object counts and bytes, sample design, mismatches and unsupported objects. Keep archive-container integrity, object identity and application semantic consistency distinct.

A matching hash supports byte identity within the named algorithm and population. It does not prove semantic completeness, recoverability, absence of malware, suitability for a different generation or correctness of excluded objects. Never run commands, mount media or scan a repository under this Skill.

## Review isolated restore tests

Use only evidence from an already authorized isolated restore. Freeze copy generation, target environment, network and access boundary, runbook version, prerequisites, start/end, dependencies and success criteria set before the test. Separate copy retrieval, restore completion, boot or service startup, database consistency, application function, security validation, data reconciliation and business-owner acceptance.

Record manual interventions, substitutions, failed or skipped steps, reruns, residual data, privacy controls, cleanup evidence and ambiguous external effects. Measure elapsed time only from compatible timestamp pairs and state unit and clock basis. Do not extrapolate a sampled restore to the whole population without a declared sampling design.

## Join and assess evidence

Run workload/scope, copy/retention/immutability, catalog/hash-integrity and isolated-restore branches from one baseline. Join by workload, data-set, dependency, job, copy, repository, manifest and restore-run IDs. Reconcile generations, timestamps, counts, bytes, objectives and validation criteria.

Keep product status, integrity evidence, application validation, business acceptance and professional assurance separate. Every material row records source/version/date, effective date or cutoff, unit/denominator, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy/licence boundary, status, decision_not_made, outcome_unknown and stop reason.

## Stop and authority boundary

Stop for absent authority, unknown workload/data population, missing generation identity, incompatible policy/catalog versions, untraceable copies, unclear encryption/key dependency, invalid time basis, unauthorized restore environment, missing success criteria, protected data exposure or ambiguous external outcome.

Never access a live repository; initiate, cancel or alter a backup; change retention, replication, immutability or encryption; delete a copy; perform a production restore; scan for ransomware or malware; declare a disaster; certify recoverability; choose Recovery Time Objective or Recovery Point Objective; or accept residual risk. Service/data owners, backup administrators, application/database engineers, continuity and disaster-recovery owners, security, privacy, legal and risk authorities retain those decisions.
