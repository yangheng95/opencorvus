# Compact identities and Host references

## Recall

- User request: every hash-like value exposed by the product must be at most 24 characters, explicitly including Task and Artifact identifiers; continue through staged, reviewable commits instead of mixing unrelated repairs.
- Acceptance: every newly issued OpenCorvus runtime/business identifier is at most 24 characters; deterministic Artifact identity is also at most 24 characters; language-model tools and ordinary UI never require copying a longer digest; full cryptographic SHA-256, Git object identity, package digest and byte-integrity facts remain complete inside Host-owned storage and verification.
- Hard constraints: never truncate a cryptographic digest and call it verified; retain one identifier generator and one Host reference system; no fallback, dual protocol or model-taught workflow gate; schema/storage changes require an explicit migration boundary; positive non-UI tests only; real-page UI evidence only; preserve unrelated work and deliver each phase through its own reviewed commit and push.
- Sources read: `packages/opencorvus/src/id/id.ts`, the compact Task identifier record, Engine Artifact publication and idempotent identity, Artifact Catalog locator/read/selection references, `panel.create_task`, Task package binding, Permission request/attempt/ledger issuance and recovery, Evolution Artifact schemas and the fresh exact-Luna controller/SQLite/tool-call evidence.
- Whole-repository search: `Identifier.create/ascending/descending`, every identifier prefix, `art_idempotent`, SHA-256/package/Git digest schemas, Artifact locator/read/selection references, `expectedPackageDigest`, public transport schemas, persistence columns, generated package payload and identifier tests were searched across core, plugin, transport, Overlay, expert packages, tests and architecture records.
- Independent feedback: the read-only live reviewer confirmed that the fresh Luna Mission twice shortened the exact 64-character installed package digest to 63 characters in `panel.create_task`; Host validation rejected both calls and the third minimal retry recovered. A later fresh run proved ordinary Task, Session and core Artifact issuance is 24 characters, while every package `artifact_publish` idempotent output still persisted the 79-character `art_idempotent_<64hex>` form. The same run proved the new correlated Evolution publisher succeeds, then failed later at an independent cross-Task predecessor-correlation boundary. During Project-ID review, the reviewer found that resetting only the DB would let an old `.git/opencorvus` marker resurrect the expanded ID, and that Windows case-equivalent path spellings must share the same canonical material; both cases are now part of the positive Project identity contract.

## Problem and first bad transition

The product currently mixes three different concepts:

1. OpenCorvus-owned runtime identifiers. New Task IDs already use a fixed 24-character canonical form, while Session, Message, Part, Artifact and most other families still use an approximately 43-character expanded encoding.
2. Deterministic business identifiers. Idempotent expert output uses `art_idempotent_<full SHA-256>`, producing an approximately 79-character Artifact ID even though the full payload SHA is stored separately.
3. Cryptographic integrity facts. SHA-256, Git object IDs and package digests are correctly full-length, but some model-facing tools ask the model to copy them as control input.

The fresh exact-Luna run exposed the third class directly. The Mission received the correct installed package digest, then twice omitted its final hexadecimal character when calling `panel.create_task`. The Host failed closed and no invalid Task was created, but the diagnostic stage was delayed and the model incorrectly blamed the canonical digest before eventually recovering. The data-integrity validator is correct; requiring a language model to reproduce a long cryptographic token is the bad transition.

Blindly truncating SHA-256 to 24 characters would weaken collision resistance, break package/tree/resource verification, invalidate existing immutable locators and create a second definition of equality. The repair must shorten OpenCorvus identities and model/UI references while keeping complete cryptographic facts behind the Host boundary.

## Current facts

- `Identifier.create("task", ...)` emits 24 characters, but the general generator uses a direction marker, two 48-bit hexadecimal fields and fourteen random Base62 characters.
- Artifact locator/read/selection references already use Host-minted 19-character values (`al_*`, `ar_*`, `as_*`) and resolve to complete persisted locators without model reconstruction.
- Exact Task package revision binding already resolves an installed incumbent selected through the Mission's held prompt profile. For that installed-incumbent path, `panel.create_task.expectedPackageDigest` is a redundant model-provided compare-and-swap token rather than the package identity owner. Candidate Trials are the explicit exception until Phase 2 provides a short Host revision reference for their not-yet-installed candidate package.
- Engine Artifact rows already store complete payload SHA-256 independently from `id`, so deterministic compact Artifact IDs do not need to contain printable full SHA text.
- Existing databases contain expanded identifiers and JSON payload references. Rewriting those identifiers is a storage migration, not a parser tweak, and cannot be silently combined with new issuance.

## Architecture boundary

### Internal cryptographic facts

Full SHA-256, Git object IDs, package/tree/resource digests and signatures remain canonical, untruncated and Host-owned. They may appear in privileged diagnostics and exported audit material, but ordinary language-model tool inputs and default UI surfaces receive a compact Host reference of at most 24 characters instead of the digest.

### OpenCorvus identifiers

All newly issued runtime/business IDs use one canonical generator with a maximum total length of 24 characters, including prefix and separator. The encoding retains direction, a complete timestamp domain, a bounded logical sequence and cross-process entropy. Prefix values that cannot fit the shared body are shortened at the single prefix registry, not special-cased at call sites.

Deterministic Artifact identity uses a domain-separated compact encoding derived from the full canonical SHA-256 bytes. The full digest remains the equality/integrity fact. Publication checks detect the improbable compact-ID collision and return a typed integrity error instead of aliasing different payloads.

### Model and UI references

Model-facing APIs do not accept raw digest assertions where the Host already owns the selected authority. Installed-incumbent Mission Task creation can supply the held Expert Squad ID and let the Host resolve and pin its exact installed revision. Candidate Trial creation still needs a Phase 2 short Host revision reference before its raw digest field can be removed. Artifact operations continue to use the existing short locator/read/selection references. Later digest-bearing tool surfaces receive equivalent Host-issued references from the same authoritative read/inspect response rather than a new alias store.

The default UI renders compact IDs/references of at most 24 characters. A privileged audit detail may show the complete internal digest as evidence, but it is not a copyable workflow control token.

## Staged delivery

### Phase 1A — canonical issuance

1. Generalize the canonical default generator to every `Identifier` family and retain timestamp/order/uniqueness guarantees without rewriting caller-supplied legacy identities.
2. Add a domain-separated compact derivation primitive for later migrations, but do not switch an existing durable replay key until its owning migration or epoch boundary lands.
3. Add positive contracts for every canonical prefix family, the complete same-timestamp sequence window, deterministic derivation and timestamp recovery.

### Phase 1B — handcrafted identity closure

Inventory and migrate caller-supplied and handcrafted business identities that bypass default `Identifier` issuance, including Session/request/workspace inputs, delayed Task waits, Project IDs, memory file/chunk, permission request/attempt and durable bus occurrence identities. Each owner moves atomically with its persistence and replay tests. Existing deterministic Artifact, Build, scheduler, Mission receipt and coordination keys remain unchanged until this boundary supplies their explicit migration or reset epoch; permanent dual-read is not allowed.

The first Phase 1B delivery owns idempotent expert-output Artifact identity only. New publication derives one domain-separated compact Artifact ID through `Identifier.deterministic("artifact", canonical)` and keeps the complete payload SHA-256 in the existing integrity columns and exact locator. A compact ID that is already occupied by different canonical material returns a typed identity-collision error. Because existing pre-release databases may contain the old 79-character deterministic IDs in immutable locator payloads, startup rejects that legacy epoch with `DATA_RESET_REQUIRED`; it does not silently issue a second ID, rewrite immutable provenance, or keep a permanent legacy lookup. Other caller-supplied and handcrafted families remain in later Phase 1B commits.

The second Phase 1B delivery owns Project identity only. The canonical normalized repository identity material remains
the complete `.git` path, but `Project.directoryProjectID` derives the persisted business identity through
`Identifier.deterministic("project", material)` instead of exposing the 40-character SHA-1. The new `prj_*` ID is at
most 24 characters. A pre-release database containing an expanded Project primary key belongs to the previous
identity epoch and returns `DATA_RESET_REQUIRED` before project discovery; no duplicate Project row or dual lookup is
created. Project row `generation` remains a distinct internal occurrence UUID and is not a user/model-facing Project
identifier. After the authorized DB reset, Project discovery treats any non-current marker as prior-epoch metadata,
derives the compact ID from the absolute normalized path with Windows-only case folding, and rewrites the marker
before inserting the new Project row. A second bootstrap must then accept the compact row and marker.

The third Phase 1B delivery owns the delayed Task-wait fire identity only. A pending delay row has not yet issued a
fire identity; execution derives one compact `call` identity from the complete Automation job identity, then transfers
the delay row and queued Task ingress in one transaction. After that transfer the delay row no longer exists, so a
restart consumes the already-persisted ingress rather than deriving a second identity. Session and recurring
Automation identities remain in later Phase 1B commits because they own additional durable Message, Session and run
rows and require their own epoch boundary.

The fourth Phase 1B delivery owns Project Memory file and chunk identities only. Pending user-input files derive a
compact `memory` identity from Project, occurrence kind and occurrence identity; their single content chunks derive a
compact `memchunk` identity from that file identity. The Project `MEMORY.MD` envelope uses separate domain-separated
Project-context material for its compact file and chunk identities. Existing expanded memory primary/foreign keys
belong to the prior pre-release epoch and cause `DATA_RESET_REQUIRED` before any memory read; no dual lookup or
in-place rewrite is retained. Memory content, occurrence provenance and Project ownership remain complete persisted
facts rather than being encoded into the business identifier.

The fifth Phase 1B delivery owns Permission request, execution-attempt and append-only ledger-event identities only.
Request identity remains deterministic over the complete Project, Session, Message, Tool call and permission
fingerprint tuple; attempt identity remains deterministic over that exact request; ledger events use the canonical
ordered Permission occurrence issuer. Legacy configuration migration uses a separate domain-separated compact
Permission request/decision identity. Full policy revisions, provider digests, scope fingerprints and durable result
SHA-256 remain complete integrity facts. Existing expanded `prm_*`, `pat_*`, `ple_*`, migration decision slots and
their relational mirrors belong to the prior pre-release epoch and cause `DATA_RESET_REQUIRED` before Permission
recovery or replay; no dual lookup or in-place rewrite is retained. A compact deterministic request identity occupied
by different canonical invocation material returns a typed identity-collision error instead of reusing another Tool
call's decision or execution.

The sixth Phase 1B delivery owns the scheduler-delivery occurrence identity graph only. One canonical invocation
derives one compact deterministic occurrence graph for the protocol event, protocol inbox, target Message, target text Part and Session control
identity through five separately domain-separated `Identifier.deterministic` calls. The complete source-body SHA-256
remains in the scheduler payload. Existing expanded `pev_scheduler_*`, `pib_scheduler_*`, `msg_scheduler_*`,
`prt_scheduler_*` and `sctl_scheduler_*` rows belong to the prior pre-release epoch and cause
`DATA_RESET_REQUIRED`; replay never mixes old and current members of one occurrence graph. Any compact event/inbox
occupancy by different scheduler semantics returns the existing typed scheduler conflict instead of aliasing.

The seventh Phase 1B delivery owns the Orchestrator terminal-control Message/Part occurrence only. An exact lifecycle
or infrastructure wake derives separate compact deterministic Message and Part identities while the complete wake,
source kind and fact identities remain in the visible provenance payload. The same material replays one exact bundle;
different compact-ID occupancy returns a typed control identity conflict before generic Session upsert. Existing
expanded `msg_orchestrator_control_*` and `prt_orchestrator_control_*` rows with matching control provenance belong to
the prior pre-release epoch and cause `DATA_RESET_REQUIRED` rather than dual lookup or in-place rewrite.

The eighth Phase 1B delivery owns the Mission caller-receipt Message/Part occurrence only. One terminal Mission derives
separate compact deterministic Message and Part identities from its exact Session identity while caller lineage,
Mission identity, terminal reason and the formal receipt pointer remain complete persisted facts. The receipt bundle
and Mission metadata pointer stay in one transaction; different compact-ID occupancy returns a typed conflict before
generic Session upsert. Existing expanded `msg_mission_receipt_*` / `prt_mission_receipt_*` graphs with exact Mission
receipt provenance belong to the prior pre-release epoch and cause `DATA_RESET_REQUIRED`, never dual lookup or rewrite.

### Phase 2 — remaining model-facing digests

Inventory each plugin/package tool field that currently asks the model to repeat a package, resource, workspace, scorer, Git or payload digest. Replace it with a short Host reference derived from a prior authoritative response, then delete the raw model-input field in the same change. This includes replacing `panel.create_task.expectedPackageDigest` with a Host reference that can bind both installed incumbents and uninstalled candidate revisions; removing the digest without that replacement would break candidate Trial creation. Regenerate schemas, SDKs and embedded package payload from canonical sources.

### Phase 3 — persistence migration and UI

Define an explicit current-schema migration for expanded stored IDs and every relational/JSON reference, or declare the existing database epoch incompatible and require the already-supported explicit reset path. Do not accept both canonical ID formats as a permanent dual protocol. Update default UI projections and real-page screenshots after the storage decision is complete.

## Positive verification

- Generate the complete 3,844-value same-millisecond sequence window for every prefix family; prove length at most 24, uniqueness, lexical order, canonical schema acceptance and timestamp recovery. Prove descending order separately.
- When a durable deterministic key is migrated, publish the same canonical fact twice and prove replay of one compact identity plus the same complete payload SHA; attempt a controlled compact-ID collision fixture and prove a typed integrity failure rather than aliasing.
- Persist one legacy `art_idempotent_<64hex>` expert output in an isolated pre-release database, reopen it through the production database bootstrap, and prove the typed reset-required epoch boundary before any business read.
- When Phase 2 introduces the package-revision reference, create real incumbent and candidate Trial Tasks and prove each persisted package revision binding resolves from that short Host reference without a model-supplied digest.
- Run focused identifier, Artifact publication and Task package binding tests, relevant typechecks, docs check and diff check.
- Obtain independent read-only review after each implementation phase, fix every valid finding, then commit, merge upstream, verify the outgoing set and push before the next phase.
- Final acceptance requires a fresh exact-Luna random evolution run in which no model tool input contains a raw identifier/digest longer than 24 characters, followed by real `document@1` and `chart@1` page screenshots and database/resource integrity closure.
