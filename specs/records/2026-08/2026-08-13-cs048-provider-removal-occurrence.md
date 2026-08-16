# CS-048 — Make Provider removal one recoverable occurrence

## Recall

- User requirement: finish every remaining accepted code-smell item through root-cause repair, focused positive production-path verification, uninvolved read-only review, exact commits, a final upstream merge before push, and a zero-item remainder.
- Accepted finding: project/global Provider removal currently serializes on a file containing only `provider removal owner`, commits configuration, then separately removes the Provider credential from global `auth.json`. A process exit or Auth failure after the first commit loses the only residue fact and can still return HTTP 200 `committed_with_residue`; restart cannot enumerate or settle the deletion.
- Acceptance target: one durable Provider-removal occurrence identifies the request, scope, exact configuration transition, credential identity without storing the secret, stage and recovery decision. Startup settles every admitted occurrence before serving mutations. Same-request replay returns its correlated terminal receipt; mismatched replay is a typed conflict. Isolated process cuts before/after admission, config, credential and response delivery converge to one exact terminal revision.
- Hard constraints: the lock is liveness only and may not masquerade as a journal; no response-only residue protocol, fallback reader, compatibility route, parallel credential/config authority, raw credential/config secret in files or errors, unkeyed secret digest, source-text absence test or UI automation. Missing `auth.json` remains a valid empty credential set; malformed/unreadable Auth remains typed fail-closed. A Provider removal is forward-settled; it never attempts to reconstruct or roll back a secret-bearing prior config from an unsafe snapshot.
- Sources read: root `AGENTS.md`; accepted CS-048 audit entry; `provider/removal.ts`; Auth reader/writers; project/global Config readers, merge-patch writers and candidate validators; Provider/Agent/Channel invalidation owners; Provider project/global routes, error mapping, generated SDK and Overlay caller; server startup Runtime Server Ownership recovery; Project deletion durable-manifest example; filesystem atomic/durable primitives; Provider architecture; model-reference schemas and all Config model-bearing fields.
- Whole-repository findings:
  - `provider/removal.ts` owns a process map plus `proper-lockfile` over a constant file, but persists no operation identity or stage;
  - configuration and `auth.json` are different files with separate process-local write locks; `Auth.all()` correctly distinguishes missing from malformed/I/O/invalid credential, while removal catches all Auth failures after config commit and projects them as a successful residue response;
  - current `removalPatch()` handles the Provider declaration, enabled/disabled lists, root `model`/`small_model`, and native `agent.*.model`, but omits writable `command.*.model`, `runtime_templates.*.model`, and `expert_squads.*.agents.*.runtime.model` references;
  - project/global Config writers are canonical validation/reconciliation owners but are only process-local serialized at their file boundary; all Auth mutation callers likewise bypass Provider-removal state;
  - Config provider options may contain `apiKey` and Auth records contain access/refresh/key/token values, so a plain SHA-256 of either exact preimage would create an offline credential verifier;
  - `Filesystem.writeDurableAtomicIfAbsent()` plus directory metadata sync is sufficient for immutable phase facts. No mutable journal replacement is required if admission and every phase are separate no-replace records;
  - `acquireServerRuntimeAfterRecovery()` already holds Runtime Server Ownership before project-deletion and caller recovery, providing the single pre-listener recovery boundary;
  - the Overlay DELETE caller currently supplies no idempotency identity and explicitly interprets `committed_with_residue`; public routes and generated contracts expose the same obsolete protocol.
- Not affected: Provider OAuth authorization and token refresh occurrences (CS-067/071), MCP config/auth removal (CS-039), catalog/model refresh, historical Session model selections, encrypting `auth.json`, and changing the fact that saved Provider credentials are keyed globally by Provider ID.
- Independent-agent feedback: none yet. An uninvolved plan review is required before implementation.

## Root cause and failure chain

`proper-lockfile` proves only that one live process owns a critical section. Its target file contains no mutation facts and survives every operation unchanged, so it cannot answer which Provider or scope was being removed, whether configuration committed, which credential revision was observed, whether a later writer superseded the deletion, or what response should be replayed. The operation then crosses two independently persisted stores:

1. a project or global Config merge patch commits and its in-memory owners are reset;
2. `Auth.get()` observes the global credential;
3. `Auth.remove()` rewrites `auth.json`;
4. a transient response describes success or residue.

Termination after steps 1–3 destroys the only correlation. Retrying with a new invocation may remove a credential written after the crash, while restart cannot distinguish the intended old credential from a successor. Catching Auth failure and returning 200 merely hides the incomplete state. Adding another retry around `Auth.remove()` or placing more fields in the lock file would retain the same false authority: neither establishes an immutable admitted request nor coordinates successor Config/Auth mutations.

## Target authority

### 1. One Provider mutation authority, with an explicitly non-authoritative lock

Add a runtime-neutral Provider mutation authority module that owns:

- one process-keyed plus cross-process `proper-lockfile` critical section rooted at a file named and documented only as `provider-mutation.lock`;
- one opaque active-handle/context, so nested Config/Auth calls made by the same removal reuse the current critical section rather than deadlock or acquire a second authority;
- the Provider-removal occurrence store and keyed-secret identity owner described below;
- hooks used by every canonical Config file writer and every `Auth.set`/`Auth.remove` mutation to reconcile active removal occurrences before a successor write.

The module must not import Config or Auth. `provider/removal-occurrence.ts` owns only schemas, locks, keyed identities and immutable records. `provider/removal.ts` remains the domain orchestrator and imports Config/Auth. Config and Auth may import the neutral occurrence module without a cycle. Production callers cannot inject an alternative registry, store, lock or digest implementation.

All in-repository Config writes pass through their existing canonical `writeConfigFile` owner under this Provider mutation handle. After the candidate is fully parsed and validated but before persistence, that owner computes the exact before/after Provider mutation projections for the writable file. If a Provider-affecting projection changes outside the currently executing removal, it durably terminalizes every active occurrence for that Provider ID across **all project and global scopes** as `superseded` before writing the successor config. Scope remains part of each Config projection identity, but saved Auth credentials are globally keyed by Provider ID; a project-scoped successor can therefore make a global removal unsafe, and vice versa. Auth mutations perform the same cross-scope supersession for the Provider ID before publishing a successor credential mutation. A failure after marking `superseded` preserves the prior/current stores and prevents recovery from deleting a possibly successor credential; it is a safe terminal decision, not an attempt to roll the occurrence backward. Manual/external file changes that bypass the process are detected by recovery's exact keyed comparison and produce the same terminal `superseded` decision.

The removal orchestrator acquires this authority once across admission, Config, Auth and terminal publication. Internal calls reuse its opaque handle. There is no second removal-specific process map or Config/Auth lock order. Existing domain locks such as Skill/Conversation validation remain outside their current Config transaction boundary; the implementation records and documents the total order and adds a contention test so no code path acquires the Provider authority in reverse.

### 2. Durable keyed state identity without secret publication

The authority owns one 32-byte random installation key at a mode-0600 data path. It is created with durable no-replace publication only when no Provider-removal occurrence exists. Once any occurrence exists, a missing, truncated or unreadable key is a typed startup integrity failure; silently generating a replacement would make all prior revision claims unverifiable. Rotation is outside this task.

Every secret-bearing exact state is represented by domain-separated Hash-based Message Authentication Code using SHA-256 (HMAC-SHA-256) under that key. The HMAC inputs are canonical, versioned binary/JSON projections and include a domain, scope and Provider ID. Public responses never expose these values. Logs and errors contain only operation ID, Provider ID, scope, stage, safe reason and typed owner names.

The writable Config projection is schema-aware and contains only fields whose semantics refer to the target Provider:

- the exact writable `provider[providerID]` declaration;
- membership in writable `enabled_providers` and `disabled_providers`;
- writable root `model` and `small_model`;
- writable `agent.*.model` and `command.*.model`;
- writable `runtime_templates.*.model`;
- writable `expert_squads.*.agents.*.runtime.model`.

It neither recursively searches arbitrary strings nor treats prompt/content text as a model reference. The same pure projection/removal primitive supplies admission HMACs, successor-change observation and `removalPatch()`, so the list cannot drift into two registries. Project scope means the canonical writable project config projection; global scope means the canonical writable global config projection. Inherited/effective values are used for post-commit validation/runtime projection, not falsely recorded as bytes owned by the writable file. Historical Session overlays are not rewritten.

The Auth projection is `absent` or the exact `Auth.Info` value encoded canonically and HMACed. Its raw value never enters an occurrence record. Before admission the removal reads and validates Auth while holding the mutation authority. Malformed/I/O/credential-schema failures therefore return the existing typed Auth-unavailable 503 with zero admitted occurrence and zero Config mutation.

### 3. Immutable occurrence and phase records

Store occurrences below one mode-0700 data directory. Each operation has a directory keyed by a caller-supplied UUID. Every record is a strict, versioned JSON object published with durable no-replace semantics and directory metadata sync; phase records are immutable and named by their fixed ordinal, so no mutable replace or partially updated “current journal” exists:

```text
provider-removal/<operation-id>/
  00-admitted.json
  10-config-committed.json
  20-credential-committed.json
  30-runtime-reconciled.json
  40-terminal.json
```

`40-terminal.json` is a strict immutable union with `kind: "completed" | "superseded"`; it is the single no-replace terminal slot, so cross-process completion and supersession cannot both publish different filenames. Same-byte replay of an already published phase is idempotent; different bytes at the same phase, including another terminal union member, return a typed occurrence drift error. Admission binds:

- schema version and operation UUID;
- Provider ID and `project|global` scope;
- for project scope, exact Project ID, generation and canonical directory authority needed for recovery;
- the Config authority identity and keyed HMACs of the exact before and intended after writable projections;
- credential state `absent` or keyed HMAC;
- canonical removal intent/version and timestamps.

`10-config-committed` proves the current writable projection equals the admitted after HMAC. `20-credential-committed` proves the credential is absent and records whether admission observed `removed|absent`. `30-runtime-reconciled` proves the canonical Provider, native-agent and Channel owners have consumed the post-removal effective Config. `40-terminal` with `kind="completed"` contains the exact public terminal receipt. `40-terminal` with `kind="superseded"` contains only the stable reason and the observed owner category/config-or-credential revision mismatch, never state bytes or HMACs.

An existing operation ID with the same normalized request resumes or returns its terminal record. The same ID with another Provider, scope or project identity throws `ProviderRemovalOperationConflictError` (409). A superseded replay throws `ProviderRemovalSupersededError` (409) with the operation identity and stable reason. No old response schema or response-derived fallback reader remains.

### 4. Forward recovery and successor preservation

One `recoverProviderRemovalOccurrences(runtimeOwnership)` runs from `acquireServerRuntimeAfterRecovery()` after Runtime Server Ownership and filesystem cleanup ownership are established but before caller recovery, services or listener binding. It asserts the ownership handle, acquires the Provider mutation authority, strictly parses the key, all occurrence directories and all phase sequences, and processes nonterminal occurrences in deterministic admission order.

For each occurrence it resolves the exact project identity/generation when applicable, reads the current writable Config projection and validated Auth state, then applies this state machine:

- current Config equals admitted `before`: apply the one canonical removal patch, validate the effective candidate, publish it, prove `after`, and write `10`;
- current Config equals admitted `after`: write/reuse `10` without another Config write;
- current Config equals neither, or the project identity/generation no longer matches: publish `40-terminal{kind:"superseded"}` and preserve current Config/Auth;
- after `10`, credential equals the admitted HMAC: remove it, prove absence and write `20`;
- credential was admitted absent or is already absent: write/reuse `20` with `absent`;
- credential is present with another HMAC: publish `40-terminal{kind:"superseded"}` and preserve it;
- after `20`, reconcile the canonical runtime owners from the current effective Config and write `30`; restart-created empty caches are still reconciled through the same owner rather than being treated as implicit proof;
- after `30`, publish the exact `40-terminal{kind:"completed"}` receipt.

Any transient Config/Auth/filesystem/runtime reconciliation failure after admission leaves the immutable prefix active and surfaces `ProviderRemovalPendingError` (503) with operation ID and current phase. It is never HTTP 200 residue. Startup retries the exact prefix. Deterministic journal corruption, impossible phase order, missing key, HMAC/identity drift within an already claimed phase or a conflicting `40-terminal` payload fails server startup with one typed data-integrity error instead of skipping the occurrence.

This is intentionally forward-only. It never stores raw old Config/Auth values to reconstruct a rollback. A successor mutation wins by first publishing `superseded` under the same authority or by being observed as a different keyed revision; recovery will not delete successor data even when the new credential bytes happen to equal the old bytes, because the in-repository successor writer durably records supersession before its write.

### 5. Public request and receipt contract

Both DELETE routes require `x-opencorvus-mutation-id: <uuid>`. This is a domain idempotency identity, distinct from `x-opencorvus-request-id` diagnostics. Overlay generates one UUID when the user confirms deletion and reuses it for bounded transport retry of an ambiguous response; SDK callers can do the same. The route passes it unchanged to `removeProvider()`.

The only successful response is the strict durable receipt persisted in `40-terminal{kind:"completed"}`:

```ts
{
  operationID: string
  providerID: string
  scope: "project" | "global"
  status: "completed"
  config: "removed" | "absent"
  credential: "removed" | "absent"
}
```

It contains no transient runtime issue array. Runtime reconciliation is a required stage before completion; failure remains a recoverable 503. `committed_with_residue`, `residue` and credential=`residue` are deleted from server, Overlay, OpenAPI, generated SDK and localized presentation. The two routes declare the exact 409 operation-conflict/superseded responses and 503 Auth-read/pending/authority-integrity response schemas. Generic request diagnostics remain orthogonal.

## Complete affected surface

- Provider removal orchestrator and new neutral occurrence/mutation-authority modules.
- Auth canonical mutation functions so every saved-credential set/remove participates in successor ordering; the existing single Auth schema/read authority remains unchanged.
- Project/global Config canonical file writer plus the one pure Provider projection/removal primitive; all current Config mutation entry points continue to delegate to that writer.
- Server startup recovery ordering and typed errors; Provider project/global DELETE route request/response schemas and error mapping.
- Overlay Provider deletion transport, retry/result handling and obsolete residue copy; generated OpenAPI/JavaScript SDK and bilingual API documentation.
- Provider architecture, this isolated record and both spec indexes.
- Focused process worker and non-UI production tests.
- Excluded: OAuth/refresh mutation protocols, catalog refresh, session history rewriting, credential encryption, Provider discovery/test routes, Project deletion and MCP config/auth occurrence design.

## Positive verification

1. Build a real isolated data/config/project home and call the project and global production DELETE routes with explicit mutation UUIDs. Seed every supported writable Provider reference (declaration, lists, root/native/command/template/expert models) and a real saved credential. Assert the exact completed receipt, strict terminal occurrence schema/phase sequence, exact post-removal writable/effective Config projection, absent credential and canonical runtime owner projection.
2. Spawn independent Bun processes sharing the same physical files and cut with hard exit at: after `00` before Config; after Config before `10`; after `10` before Auth; after Auth before `20`; after `20` before runtime reconciliation; and after `40` before HTTP response delivery. A successor process enters the real startup ownership/recovery chain. Same-ID route replay returns the byte-equivalent terminal receipt and one occurrence; same ID with different input returns the exact 409 conflict.
3. For each cut, compare the parsed occurrence to its strict schema and recompute the keyed identities through the authority test port. Assert the record contains only the declared HMAC/state fields and terminal receipt, while a credential containing unique token/refresh/key sentinels and a Provider option `apiKey` remains represented by the expected keyed identity. This is an exact positive schema/identity assertion, not a text-absence test.
4. Race two independent processes at the mutation authority: recovery versus `Auth.set` with a different credential, recovery versus `Auth.set` with byte-identical credential, and recovery versus Provider-affecting Config writes in the **same and opposite scope** (project successor during global removal and global successor during project removal). The successor operation first wins the single `40-terminal` slot with the exact superseded fact; recovery returns the correlated 409 and preserves the successor state. Race completion against supersession directly and prove only one terminal union value can be published. An unrelated Config mutation leaves the removal active and recovery completes it. Include a project generation replacement case that terminalizes as superseded and preserves the replacement project.
5. Seed missing `auth.json` and prove normal completed removal with credential=`absent`. Seed malformed JSON, schema-invalid credential and a real non-ENOENT I/O condition before admission; Config and occurrence inventory remain at their exact prior state and both routes return the safe typed 503. Inject a real post-admission Auth write failure after Config commit; the route returns `ProviderRemovalPendingError`, the exact prefix remains enumerable, and startup completes after the fault is removed.
6. Corrupt one immutable phase, publish an impossible order or conflicting `40-terminal` bytes, remove the HMAC key with an existing occurrence, and alter an already claimed project/config identity. Reopen through the production server startup path and assert the exact typed data-integrity/reset-required operation; no listener binds and no later phase is written.
7. Exercise the Overlay's non-UI Provider service boundary with an ambiguous first response followed by same-ID retry and assert its projected completed result. Do not run/render the Providers panel or add UI automation. Update OpenAPI/generated SDK/docs and run route/schema/import drift checkers.
8. Run focused removal/Config/Auth/startup tests, OpenCorvus and SDK typechecks, documentation checker and exact task-owned `git diff --check`. Obtain an uninvolved read-only implementation review; fix every valid finding and repeat until PASS before committing.

## Risks and sequencing

- `storage/db.ts`, generated SDK/OpenAPI, spec indexes and architecture files are currently owned by CS-004/CS-008 dirty work. Do not implement or edit shared surfaces until those deliveries are committed; never combine their hunks.
- A static lock target may remain only as a cross-process liveness primitive with the new name/contract. The immutable occurrence directory is the sole durable mutation authority.
- Config mutation coordination must not add a second Config parser/writer or recursively re-enter the Provider lock. The opaque active handle and one canonical `writeConfigFile` boundary are required implementation invariants.
- The Provider-specific projection list is an explicit schema contract, not a generic recursive string scan. Future model-bearing Config fields must extend this single primitive and its exhaustive contract test.
- Crash injection belongs below durable phase publication and response delivery but production calls the real Config/Auth/route/startup owners. A fixture that directly fabricates terminal records is insufficient.

## Delivery state

- Recall, root-cause chain, single mutation/occurrence authority, secret-safe state identity, immutable phase protocol, forward recovery, public contract, affected surface, tests and sequencing are drafted.
- Independent plan review is pending. Production implementation, verification, implementation review, commit, final upstream merge and push have not started.
