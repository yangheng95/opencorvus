# Compact identities and Host references

## Recall

- User request: every hash-like value exposed by the product must be at most 24 characters, explicitly including Task and Artifact identifiers; continue through staged, reviewable commits instead of mixing unrelated repairs.
- Acceptance: every newly issued OpenCorvus runtime/business identifier is at most 24 characters; deterministic Artifact identity is also at most 24 characters; language-model tools and ordinary UI never require copying a longer digest; full cryptographic SHA-256, Git object identity, package digest and byte-integrity facts remain complete inside Host-owned storage and verification.
- Hard constraints: never truncate a cryptographic digest and call it verified; retain one identifier generator and one Host reference system; no fallback, dual protocol or model-taught workflow gate; schema/storage changes require an explicit migration boundary; positive non-UI tests only; real-page UI evidence only; preserve unrelated work and deliver each phase through its own reviewed commit and push.
- Sources read: `packages/opencorvus/src/id/id.ts`, the compact Task identifier record, Engine Artifact publication and idempotent identity, Artifact Catalog locator/read/selection references, `panel.create_task`, Task package binding, Evolution Artifact schemas and the fresh exact-Luna controller/SQLite/tool-call evidence.
- Whole-repository search: `Identifier.create/ascending/descending`, every identifier prefix, `art_idempotent`, SHA-256/package/Git digest schemas, Artifact locator/read/selection references, `expectedPackageDigest`, public transport schemas, persistence columns, generated package payload and identifier tests were searched across core, plugin, transport, Overlay, expert packages, tests and architecture records.
- Independent feedback: the read-only live reviewer confirmed that the fresh Luna Mission twice shortened the exact 64-character installed package digest to 63 characters in `panel.create_task`; Host validation rejected both calls and the third minimal retry recovered. No implementation review has occurred yet.

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
- Exact Task package revision binding already resolves the selected prompt profile in the Host. `panel.create_task.expectedPackageDigest` is therefore a redundant model-provided compare-and-swap token for Mission creation, not the package identity owner.
- Engine Artifact rows already store complete payload SHA-256 independently from `id`, so deterministic compact Artifact IDs do not need to contain printable full SHA text.
- Existing databases contain expanded identifiers and JSON payload references. Rewriting those identifiers is a storage migration, not a parser tweak, and cannot be silently combined with new issuance.

## Architecture boundary

### Internal cryptographic facts

Full SHA-256, Git object IDs, package/tree/resource digests and signatures remain canonical, untruncated and Host-owned. They may appear in privileged diagnostics and exported audit material, but ordinary language-model tool inputs and default UI surfaces receive a compact Host reference of at most 24 characters instead of the digest.

### OpenCorvus identifiers

All newly issued runtime/business IDs use one canonical generator with a maximum total length of 24 characters, including prefix and separator. The encoding retains direction, a complete timestamp domain, a bounded logical sequence and cross-process entropy. Prefix values that cannot fit the shared body are shortened at the single prefix registry, not special-cased at call sites.

Deterministic Artifact identity uses a domain-separated compact encoding derived from the full canonical SHA-256 bytes. The full digest remains the equality/integrity fact. Publication checks detect the improbable compact-ID collision and return a typed integrity error instead of aliasing different payloads.

### Model and UI references

Model-facing APIs do not accept raw digest assertions where the Host already owns the selected authority. Mission Task creation supplies the held Expert Squad ID; the Host resolves and pins its exact installed revision. Artifact operations continue to use the existing short locator/read/selection references. Later digest-bearing tool surfaces receive equivalent Host-issued references from the same authoritative read/inspect response rather than a new alias store.

The default UI renders compact IDs/references of at most 24 characters. A privileged audit detail may show the complete internal digest as evidence, but it is not a copyable workflow control token.

## Staged delivery

### Phase 1 — issuance and Task creation

1. Generalize the canonical compact identifier generator to every OpenCorvus-owned identifier family and retain timestamp/order/uniqueness guarantees.
2. Replace `art_idempotent_<full SHA-256>` with a deterministic, domain-separated compact Artifact ID while retaining full SHA columns and collision checks.
3. Remove `expectedPackageDigest` from the model-facing `panel.create_task` ABI. Mission creation resolves the exact held package revision in the Host; internal services may still carry the full digest after resolution.
4. Add positive contracts for all prefix families, high-volume same-timestamp issuance, deterministic Artifact replay/collision behavior and Mission Task creation from held package authority.

### Phase 2 — remaining model-facing digests

Inventory each plugin/package tool field that currently asks the model to repeat a package, resource, workspace, scorer, Git or payload digest. Replace it with a short Host reference derived from a prior authoritative response, then delete the raw model-input field in the same change. Regenerate schemas, SDKs and embedded package payload from canonical sources.

### Phase 3 — persistence migration and UI

Define an explicit current-schema migration for expanded stored IDs and every relational/JSON reference, or declare the existing database epoch incompatible and require the already-supported explicit reset path. Do not accept both canonical ID formats as a permanent dual protocol. Update default UI projections and real-page screenshots after the storage decision is complete.

## Positive verification

- Generate at least 4,100 ascending identifiers at one timestamp for every prefix family; prove length at most 24, uniqueness, lexical order, canonical schema acceptance and timestamp recovery. Prove descending order separately.
- Publish the same canonical expert output twice and prove the same compact Artifact ID plus the same complete payload SHA; attempt a controlled compact-ID collision fixture and prove a typed integrity failure rather than aliasing.
- Create a real Mission-owned Task using only a held prompt profile and prove the persisted package revision binding equals the installed package digest without any digest in model tool input.
- Run focused identifier, Artifact publication and Task package binding tests, relevant typechecks, docs check and diff check.
- Obtain independent read-only review after each implementation phase, fix every valid finding, then commit, merge upstream, verify the outgoing set and push before the next phase.
- Final acceptance requires a fresh exact-Luna random evolution run in which no model tool input contains a raw identifier/digest longer than 24 characters, followed by real `document@1` and `chart@1` page screenshots and database/resource integrity closure.
