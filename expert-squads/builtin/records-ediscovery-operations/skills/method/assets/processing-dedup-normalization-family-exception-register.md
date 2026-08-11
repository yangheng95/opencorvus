# Processing, deduplication, normalization, family, and exception register

## Reusable evidence contract

- artifact_id: required stable artifact or row identity
- source_id_locator: exact authoritative source, document, system export, manifest, cell, page or event locator
- source_version_date: immutable source version plus issuance, extraction, collection and effective dates as applicable
- qualified_reviewer: named discipline owner with decision authority
- units_and_denominator: value, unit, currency, population and denominator, or explicit not-applicable rationale
- assumptions_uncertainty: authorized assumptions, unknowns, confidence and reason
- decision_not_made: no legal, collection, preservation, privilege, production, disposition or compliance decision
- outcome_unknown: state unresolved completeness, authenticity, relevance, legal effect and operational outcome
- stop_escalation: exact hold point, reason, escalation owner and required reviewer

Also record owner, entity/jurisdiction/applicability, cutoff/effective date, privacy/privilege/confidentiality/security/license state, evidence status and post-cutoff changes.

- artifact_id: REDO-PROC-001
- owner: e-discovery processing owner
- qualified_reviewer: discovery counsel, processing specialist, search/review lead and privacy/security
- decision_not_made: no suppression, family detachment, responsiveness, privilege, admissibility or production decision
- outcome_unknown: processing completeness and review effect remain unknown until manifests and exceptions resolve

Freeze input/output manifests, engine and configuration version, time zone, encoding, normalization, archive expansion, decryption/OCR, container/family handling, exact and near-duplicate rules, hash keys, custodian propagation, metadata mappings, language, indexing, exclusions and load-file versions. Reconcile every input item to processed, exception, duplicate member, family member, authorized exclusion or pending state with counts and denominators.

Each row records processing_item_id, source item, family_id, parent/attachment role, duplicate master/member, custodian scope, source and processed hashes, transformation/version, extracted text and metadata status, exception category, retry evidence supplied by the operator, privacy/privilege flags, owner, reviewer, confidence and stop. Preserve broken families, hash conflicts, corrupt/encrypted/unsupported files and silent count gaps visibly.

Deduplication is rule-dependent; never merge results from different scope or keys. Do not run processing, repair evidence, detach attachments, change indexes, suppress items or infer completeness. Stop on manifest imbalance, undocumented transformation, missing tool/version, family break, unclear privilege/privacy or requested live execution.
