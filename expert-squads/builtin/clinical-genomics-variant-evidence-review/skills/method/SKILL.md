---
name: clinical-genomics-variant-evidence-review-method
description: Source-versioned clinical genomics variant evidence review across case identity, population and computational evidence, functional and segregation evidence, and classification provenance without diagnosis or classification authority. Use for Select for variant/build identity, transcript and HGVS normalization, database provenance, population frequency, computational evidence, functional evidence, segregation, phenotype fit, criteria trace, or classification discrepancy review. Do not select for diagnosis, patient-specific classification, treatment, report sign-out, or genetic counseling.
---

# Clinical Genomics Variant Evidence Review Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not diagnose, classify a patient variant, recommend testing or treatment, communicate a result, or change a laboratory information system.
- Do not infer consent, phenotype, family relationships, ancestry, penetrance, pathogenicity, reportability or clinical actionability.
- Only the authorized molecular laboratory and qualified genetics professionals may approve criteria, classification, report language and patient communication.

## Freeze the review baseline

Before analysis, freeze:

- case and specimen identifiers, consent/privacy scope, indication and phenotype vocabulary/version
- genome assembly, transcript accession/version, gene-disease context, HGVS expressions and normalization tool/version
- variant database releases, retrieval timestamps, search filters, evidence cutoff, laboratory SOP and criteria specification version
- qualified laboratory director, molecular geneticist, bioinformatician and genetic counselor review owners

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Establish one canonical variant identity before comparing evidence. Keep genomic, coding and protein expressions, assembly, transcript and normalization result linked; never merge records merely because a short variant label looks similar.
2. Record every database assertion as a source-versioned observation with submitter, condition, review status, assertion date and exact locator. Counts are not independent evidence when submissions share a laboratory, family, publication or derived dataset.
3. Keep population observations, computational predictions, functional assays, case observations, segregation, de novo evidence, allelic evidence and phenotype specificity in separate evidence lanes. Preserve direction, strength as supplied, limitations and conflicts.
4. Trace each applied or considered criterion to the laboratory-controlled specification and the supporting evidence IDs. Do not invent a criterion strength, combine evidence, resolve a conflict, or emit a five-tier classification.
5. Reconcile evidence cutoff, build/transcript drift, duplicate cases, circular use of assertions, sample quality and missing provenance before a qualified review. A database absence is not evidence of absence.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Genomic Case and Build Identity Analyst

Freezes case, specimen, phenotype, gene-disease, build, transcript and normalized variant identity.

- specimen and case linkage
- HGVS/build/transcript normalization
- phenotype and gene-disease scope
- privacy and consent boundaries

Reconcile:

- all variant expressions resolve to one authorized canonical record
- transcript versions and normalization tools are explicit
- case and family IDs do not leak direct identifiers

Stop when:

- assembly or transcript unknown
- conflicting specimen identity
- consent or access scope absent

### Population and Computational Evidence Analyst

Builds versioned population-frequency and computational-evidence observations without clinical interpretation.

- database release and query provenance
- allele counts and denominators
- population stratification and quality flags
- prediction model/version and calibration limits

Reconcile:

- allele frequency retains numerator and denominator
- duplicate or overlapping datasets are marked
- prediction outputs are not treated as independent clinical proof

Stop when:

- query/build mismatch
- denominator unavailable
- model or database version missing

### Functional and Segregation Evidence Analyst

Traces assay, case, segregation, de novo, allelic and phenotype evidence with independence and quality limits.

- assay design and biological relevance
- case ascertainment and phenotype specificity
- pedigree and segregation units
- publication and case overlap

Reconcile:

- assay controls and replication are locatable
- case observations are not double counted
- segregation inputs preserve informative meioses and uncertainty as supplied

Stop when:

- unverifiable assay
- family relationship ambiguity
- publication does not support the claimed observation

### Variant Classification Provenance Analyst

Maps existing criteria and classifications to controlled specifications, evidence IDs, dates and conflict questions.

- criteria specification version
- assertion submitter and review status
- evidence-to-criterion trace
- classification discrepancy and staleness

Reconcile:

- every existing criterion has a source locator
- conflicting assertions remain separate
- outdated evidence cutoffs are visible

Stop when:

- criteria version absent
- classification provenance unavailable
- requested output would decide classification

### Clinical Genomics Variant Evidence Review Owner

Joins identity, population/computational, functional/segregation and criteria-provenance branches into a qualified review pack.

- cross-branch identity agreement
- evidence independence and duplication
- conflict and staleness register
- qualified decision queue

Reconcile:

- all evidence IDs resolve
- no branch silently upgrades evidence strength
- classification remains decision_not_made

Stop when:

- canonical variant identity unresolved
- material branch conflict
- qualified sign-out owner absent

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/variant-case-build-transcript-identity-register.md`: Freeze the exact variant and authorized case scope. Required domain fields: case_id and specimen_id, gene and disease_context, genome_build, transcript_accession_version, hgvs_genomic_coding_protein, normalizer_version, phenotype_ontology_version.
- `assets/population-computational-evidence-ledger.md`: Preserve query, allele-count and model evidence without clinical inference. Required domain fields: database_release, query_and_filters, allele_count, allele_number, population_group, quality_flags, model_name_version, score_direction.
- `assets/functional-case-segregation-evidence-matrix.md`: Map functional and case-level evidence to exact source passages and limitations. Required domain fields: assay_or_case_id, source_locator, experimental_system, controls, replicates, phenotype_fit, pedigree_unit, independence_group.
- `assets/criteria-classification-provenance-conflict-register.md`: Trace supplied criteria and classifications without deciding them. Required domain fields: assertion_id, submitter, condition, criteria_spec_version, criterion_as_supplied, strength_as_supplied, evidence_ids, classification_as_supplied, assertion_date.
- `assets/clinical-genomics-qualified-review-pack.md`: Present reconciled evidence, conflicts and explicit human decisions. Required domain fields: canonical_variant_id, evidence_cutoff, branch_status, material_conflicts, missing_evidence, qualified_questions, decision_not_made, sign_out_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Bounded MIT adaptation of identifier, version, query, filter, pagination, count and provenance discipline from K-Dense-AI/scientific-agent-skills at d661d27ef4ddad5b9287bdd84887ace27e2320b8, skills/database-lookup/SKILL.md. Networking, scripts, external writes, database-specific defaults, classification, diagnosis and treatment are excluded. Clinical genomics evidence governance is clean-room. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
