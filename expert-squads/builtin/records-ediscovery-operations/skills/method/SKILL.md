---
name: records-ediscovery-operations-method
description: Build source-bound records, preservation, collection-provenance, processing, review, privilege-flag, request, and production evidence for qualified human review without live collection, deletion, legal rulings, or production.
---

# Records and E-Discovery Operations Method

## Operating posture

Work only under a written matter or records authority that identifies legal entity, jurisdiction, matter or program, effective cutoff, custodians and systems in scope, records schedules and hold sources, permitted source snapshots, privilege/privacy/security restrictions, decision owner and qualified reviewers. Freeze versions and digests before analysis. A file path, search result or review platform display is not self-authenticating evidence.

This is a bounded adaptation documented in references/UPSTREAM.md and references/ADAPTATION.md. It makes no live-system call and no legal determination. Preserve source facts, system metadata, operator instructions, analyst calculations, allegations and reviewer decisions as distinct classes.

## Shared evidence envelope

Every artifact and row records stable ID; matter/custodian/system/document/family identifiers where applicable; exact source locator, producer, version, collection or export method and date; cutoff/effective date and time zone; owner and qualified reviewer; entity, jurisdiction and request applicability; value, unit and denominator; hash algorithm/value and chain-of-custody event when supplied; assumptions; uncertainty/confidence with reason; privacy, privilege, confidentiality, security and license state; status; decision_not_made; outcome_unknown; and stop/escalation. Unknown values remain unknown. Never overwrite a conflicting hash, timestamp, family or coding value.

## Authority, retention, and hold baseline

Map engagement, investigation, litigation, regulatory, policy or records-program authority to named entities, jurisdictions, custodians, departments, systems, data types and periods. Record the issuer, version, effective date, supersession state and authorized interpretation owner for every records schedule, disposition authorization, preservation instruction, legal hold or release. Do not infer a legal duty or schedule from a file label.

Build stable scope assertions linking authority source to custodian/system/data category and status: proposed, included, excluded by cited instruction, disputed, unavailable or reviewer-resolved. Preserve conflicts between schedules and hold instructions. Record notice and acknowledgement evidence as supplied snapshots only; never send, chase, alter or release a notice. Stops include missing authority, ambiguous jurisdiction/entity, inconsistent schedule/hold source, requested live action, or required legal interpretation.

## Custodian, source, preservation, and collection provenance

Construct an authorized custodian and source-system inventory with aliases, role/department, relevant period, system owner, account/device/repository identifiers, data types, access restrictions, preservation state supplied by the operator, and known gaps. Use data minimization: do not expose content or personal data when metadata is enough.

For provided collection/export evidence, record collection ID, collector and authority, method/tool and version, source location, start/end times and time zone, acquisition scope, filters, item and byte counts, hash algorithm and values, container format, encryption, transfer events, exception logs and destination evidence. Reconcile collection manifests to source inventory without opening or collecting from systems. A matching hash supports bit-level identity only within its stated algorithm and events; it does not prove completeness, authenticity, relevance or admissibility.

Maintain chain-of-custody events as append-only assertions. Preserve failed, partial, inaccessible, encrypted, corrupted, unsupported, deleted-item and cloud-dynamic conditions with owner and escalation. Never manufacture a missing event or call an acquisition forensic.

## Processing, deduplication, search, and review evidence

Freeze processing engine/configuration version, time zone, encoding, normalization, archive expansion, decryption/OCR policy, container/family treatment, duplicate and near-duplicate definitions, hash keys, exception handling, text extraction, metadata mapping, language, indexing and load-file versions. Reconcile input manifests to processed population: successful, exception, suppressed duplicate, family member, excluded by authorized rule and pending.

Deduplication is rule-dependent. Preserve exact duplicate master/member mappings, custodian propagation, global versus custodial scope, family relationships and conflicting hashes. Never detach attachments silently. Search evidence records query or model version, syntax, fields, date boundaries, stemming/fuzzy behavior, validation set, population, hit and unique-family counts, sampling design, reviewer protocol and uncertainty. Do not invent terms, thresholds, recall/precision claims or responsiveness conclusions.

Review evidence retains batch, reviewer role, coding protocol/version, timestamps, issue tags, conflicts, overturns, quality-control sampling and escalation. Coding is an input allegation until authorized reviewer disposition. Never change platform coding.

## Production, privilege flags, and disposition evidence

Map every request, specification or category to stable request IDs, source text locator, jurisdiction, custodian/system/time scope, responsive-candidate mappings, objections or limitations supplied by counsel, missing evidence and reviewer. Preserve Bates or production identifiers, family treatment, native/image/text format, metadata fields, redaction annotations, placeholders, load-file relationships, volume/encryption and transfer-manifest evidence from pinned sources.

Privilege work records only source facts and flags: asserted basis source, author/sender/recipient, date, subject or description restrictions, attorney/role source, confidentiality indicator, family relationship, reviewer status and uncertainty. Never decide privilege, waiver or log sufficiency. Redaction and withholding remain counsel decisions. Disposition evidence maps schedule/hold sources, eligibility calculations, exceptions and authorizations but never deletes, releases or executes disposition.

## Chronology and cross-branch reconciliation

A chronology event has a stable event ID, date/time/time-zone precision, actor/entity, event assertion, source pinpoint, source type, confidence, contradicting source and reviewer. Distinguish document date, send/receive date, system timestamp, effective date and inferred sequence. Never turn an inferred date into a fact.

The scheduler launches four roots with the same baseline. The authority root freezes schedules and holds; custodian root traces inventory and collection provenance; processing root reconciles populations and review evidence; production root maps requests, privilege flags and disposition questions. The join waits for all roots, then reconciles IDs, versions, counts, hashes, families, dates, requests and authority sources. Conflicts remain explicit; the join never chooses a legal result or calls a population complete.

## Stops and authority

Stop on missing written authority, unpinned sources, unclear privilege/privacy/security/license, disputed custodian/system scope, unsupported hash or timestamp, manifest imbalance, family break, changing dataset, required legal interpretation, or any requested live collection, deletion, hold action, coding change or production. Preserve a hold point before external action.

No worker accesses a live system, contacts a custodian or party, collects/exports/copies data, changes retention or preservation, sends/releases a hold, deletes/disposes, changes review coding, produces material, or decides privilege, responsiveness, admissibility, authenticity, spoliation, legal sufficiency or compliance. Information governance and records owners, litigation/discovery counsel, privacy/security, forensic collection and e-discovery specialists retain authority.
