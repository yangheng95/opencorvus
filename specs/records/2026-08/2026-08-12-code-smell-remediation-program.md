# Repository Code-Smell Remediation Program

## Recall

### User request

- Start fixing every accepted problem in the repository-wide code-smell audit.
- Before implementation, have an independent agent review the remediation plan.
- After implementation, have an independent agent review the complete delivery.

### Acceptance indicators

- The final audit baseline is `CS-001..078`, with 77 open findings and `CS-018` already closed during the audit.
- Every open finding must eventually have one bounded implementation batch, one current authority, removal of its superseded path, focused positive acceptance evidence, and an independent post-implementation review with no unresolved finding.
- The program remains iterative: one batch is complete only when its code, tests/checkers, documentation, review, commit, and delivery status are explicit; completing a batch does not imply the remaining register is fixed.
- Batch 1 fixes the only P0, `CS-009`, before broader shared primitives are introduced.

### Hard constraints

- Current architecture under `specs/current/architecture/**` remains authoritative. Security and Task-control changes must update those documents when their public contract changes.
- Do not add compatibility readers, fallback writers, shadow state, or parallel protocols. Each replacement deletes the old path in the same batch.
- All Large Language Model interactions remain streaming; no batch may add a non-streaming fallback.
- Non-UI implementation needs focused positive verification. Pure deletion with no replacement contract deletes obsolete tests instead of adding a negative “does not exist” assertion.
- UI automation, source-text UI assertions, Document Object Model tests, snapshots, screenshot baselines, and pixel tests are prohibited. Any such test encountered in the touched surface is deleted and not run.
- Preserve the current dirty worktree. Only task-owned files may be staged or committed.
- Before each product-code batch, an independent read-only agent reviews the written batch plan. After implementation and first-pass verification, an independent read-only agent reviews the full diff and evidence; valid findings are fixed and re-reviewed until clean.
- Push is allowed only when the complete `origin/main..HEAD` set is authorized and reviewed. Existing unrelated outgoing commits remain a delivery blocker unless separately authorized.

### Sources read before planning

- `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md`, including all 78 accepted entries, Refactoring Order, rejected leads, verification record, and final saturation rounds.
- `specs/current/architecture/README.md`.
- `specs/current/architecture/security-permission.md`.
- `specs/current/architecture/task-control-plane.md`.
- Batch-1 definitions and callers in transport protocol, Overlay host/Tauri transport, Overlay config service, Tauri command registration, and host-transport tests.

### Whole-repository search result

- `config.write-file` exists only in the native command union/validator, Tauri/browser capability maps, Tauri dispatch, and one capability test.
- `overlay_write_file` exists only as the unrestricted Rust command and in the two generated Tauri handler lists.
- `scaffoldProjectConfig` has no production caller. Its only adjacent test use is a mock member; no current user flow requires the scaffold.
- Therefore Batch 1 needs no replacement command or project-root token. The smallest correct boundary is deletion of the entire generic renderer-to-native write capability and the unreachable scaffold.
- `packages/overlay/test/host-transport-capabilities.test.ts` mixes two prohibited source-text cases with two allowed positive capability-map contracts. Batch 1 deletes only the prohibited cases and retains the direct capability contracts with the current command inventory.

### Independent agent feedback

- Pre-implementation plan review: PASS after two review rounds. The first pass rejected deletion of the whole host-capability test because two cases are allowed positive matrix contracts; it also identified the obsolete `scaffoldProjectConfig` mock in `git-init-current.test.ts`. The corrected plan retains and runs the positive cases, deletes only prohibited source-text cases, removes the stale mock, and has no unresolved review finding.
- Post-implementation delivery review: PASS after the collaborating review correction and final independent re-review.

## Program Strategy

The 77 open findings are implemented in authority-dependency order. A later wave may start only when it does not depend on an unfinished authority from an earlier wave.

1. **Privilege and irreversible-data boundaries:** `CS-009`, `CS-036`, `CS-040`, `CS-046`, `CS-025`, `CS-029`.
2. **Durable occurrence, mutation, replay, and domain settlement:** `CS-001`, `CS-002`, `CS-003`, `CS-024`, `CS-034`, `CS-035`, `CS-039`, `CS-042`, `CS-044`, `CS-047`, `CS-048`, `CS-050`, `CS-052`, `CS-054`, `CS-055`, `CS-057`, `CS-058`, `CS-059`, `CS-060`, `CS-062`, `CS-068` through `CS-075`, `CS-077`, `CS-078`.
3. **Process and runtime ownership/readiness:** `CS-011`, `CS-013`, `CS-021`, `CS-022`, `CS-023`, `CS-032`, `CS-041`, `CS-043`, `CS-045`, `CS-051`, `CS-056`, `CS-067`.
4. **Single protocol and projection authorities:** `CS-004`, `CS-005`, `CS-010`, `CS-020`, `CS-033`, `CS-037`, `CS-038`, `CS-049`.
5. **Registry, composition, cache, and generated-source topology:** `CS-006`, `CS-012`, `CS-014`, `CS-016`, `CS-019`, `CS-027`, `CS-028`, `CS-031`, `CS-053`, `CS-061`, `CS-064`, `CS-065`, `CS-066`.
6. **Dead systems and delivery truthfulness:** `CS-007`, `CS-008`, `CS-015`, `CS-017`, `CS-026`, `CS-030`, `CS-063`, `CS-076`.

Each wave is still split into reviewable batches; it is not one repository-wide commit. Shared primitives are introduced only after at least two accepted findings prove the repeated contract, and all consumers migrate in the same batch that deletes the old representation.

## Batch Ledger

| Batch | Findings | State | Plan review | Implementation review | Commit |
| --- | --- | --- | --- | --- | --- |
| B01 | `CS-009` | committed; push blocked by unrelated outgoing commits | PASS | PASS | `20f18339` |
| B02 | `CS-036` | implementation and verification complete | PASS | PASS after four adversarial rounds | pending |
| Parallel B03-B05 | `CS-015`, `CS-040`, `CS-076` | committed; push blocked by unrelated outgoing commits | recorded in focused specs | PASS | `58ef06ca`, `6f59d5b2`, `0336604d` |
| B06-B07 | `CS-041`, `CS-047` | implementation/review correction in progress | recorded in focused specs | pending | pending |
| B08+ | remaining 70 open findings | queued by Program Strategy | required per batch | required per batch | pending |

## Batch B01 — Delete the unrestricted native file writer

### Observable problem and trigger

The release renderer can send `{ kind: "config.write-file", path, content }`. The Tauri host creates the supplied parent directories and overwrites the supplied path under the desktop user's authority. Any renderer script execution can therefore become an arbitrary user-writable-file overwrite.

### Root cause

An unused project-config scaffolding helper elevated a narrow business operation into a generic privileged filesystem command. Type validation checks only that `path` and `content` are strings; the host owns no canonical project identity or path confinement.

### Why the current structure cannot cure it

The only nominal caller constructs a safe-looking path in renderer code, but callers are not an authority boundary. Adding another renderer-side path check would preserve the same privilege inversion. A new native scaffold command is unnecessary because the helper has no production caller.

### Implementation boundary

1. Delete `config.write-file` from `NativeCommand` and its runtime decoder.
2. Delete the capability key from both host capability maps.
3. Delete the Tauri transport dispatch case.
4. Delete the Rust `overlay_write_file` command and both handler registrations.
5. Delete the unreachable `scaffoldProjectConfig` function and its now-stale comment.
6. In `packages/overlay/test/host-transport-capabilities.test.ts`, delete only the two prohibited cases that read UI/native source files and assert source prose. Remove their file-reading helpers/imports, keep the two positive tests that directly exercise the exported exhaustive capability map, remove `config.write-file` from their expected current command inventory, and run that focused test.
7. Remove the obsolete `scaffoldProjectConfig` mock member from `packages/overlay/test/git-init-current.test.ts`. Keep and run this service-level positive test; it does not inspect UI source text.
8. Search the whole repository again and require zero remaining production or test references to the deleted command/helper. This is delivery evidence for a pure command deletion, while the retained capability tests positively verify the current matrix.

No replacement API, compatibility alias, renderer validation, fallback filesystem writer, or native project-root token is introduced.

### Public contracts and affected consumers

- `@opencorvus-ai/transport-protocol` native command union and decoder lose the generic command.
- Overlay Tauri/browser capability declarations lose that key.
- Overlay Tauri dispatch and native invoke registry lose the command.
- No current production caller changes behavior because the scaffold helper is unreachable.

### Verification

- `rg` production reference inventory for `config.write-file`, `overlay_write_file`, and `scaffoldProjectConfig` returns no result after deletion.
- `bun test packages/overlay/test/host-transport-capabilities.test.ts packages/overlay/test/git-init-current.test.ts` (focused non-UI positive contracts only).
- `bun run --cwd packages/transport-protocol typecheck`.
- `bun run --cwd packages/overlay typecheck`.
- `cargo check --manifest-path packages/overlay/src-tauri/Cargo.toml`.
- `bun run docs:check`.
- `git diff --check` for task-owned files.
- Do not run the removed source-text cases, the Overlay UI suite, or any other UI automation.

### Delivery and risk

- The change deliberately removes an unused internal API. Any unknown downstream consumer fails at compile/decode time instead of retaining privileged compatibility.
- The Rust command removal must include every debug/release handler list; typecheck alone cannot prove that, so the final diff and whole-repository reference search are mandatory.
- Existing unrelated worktree edits must remain untouched and unstaged.

### Completion record

- Plan review: PASS after correction and independent re-review.
- Implementation: complete. The generic transport command, decoder branch, both capability entries, Tauri dispatch, Rust command and both handler registrations were deleted. The unreachable scaffold helper and obsolete mock were deleted. The capability test retains its two direct positive matrix contracts and no longer contains the two prohibited source-text cases.
- Verification: first pass PASS. Whole-repository `rg` returned no reference to `config.write-file`, `overlay_write_file`, or `scaffoldProjectConfig`. The two focused test files passed 5 tests / 26 expectations. Transport Protocol and Overlay TypeScript typechecks passed. `cargo check --manifest-path packages/overlay/src-tauri/Cargo.toml` passed. `bun run check:sdk-imports` passed for `OpenCorvusClient`; `bun run api:routes-check` passed 6 rules across 34 route files; `bun run docs:check` passed with 338 operations / 25 groups. A first parallel wrapper timed out before returning per-command receipts, so none of that attempt was counted; every check was rerun separately to a terminal success. After the collaborating review found one stale file-header reference to the deleted scaffold responsibility, that comment was corrected and the complete focused verification set passed again.
- Independent implementation review: PASS. The first implementation review found no actionable issue. A separate collaborating review then found one stale file-header description of the deleted scaffold responsibility; the primary agent corrected only that comment, reran the full focused verification set, and the independent reviewer re-reviewed the final diff with no P0-P3 finding.
- Commit/push: committed as `20f18339`. Push is blocked because `origin/main..HEAD` also contains four pre-existing commits whose complete authorization, verification, and independent-review evidence is not established in this task; no unrelated commit will be pushed implicitly.

## Batch B02 — Make Worktree ownership observation fail closed

### Observable problem and trigger

The final managed-Worktree deletion proof reads recursive ownership-marker directories. A top-level or nested `readdir` failure currently becomes an empty list; an unreadable marker becomes `undefined` and is filtered out; target `stat` failure becomes “missing.” The boolean `hasLiveOwner` then reports false and explicit removal or garbage collection (GC) may physically remove a directory and branch while the durable owner authority was merely unobservable. The final Project sandbox check is also conditional on the directory still being observable, weakening a durable database owner into a filesystem hint.

Direct triggers include `EACCES`, `EIO`, Windows `EPERM`/`EBUSY`/sharing failures, a disappearing nested ownership directory during recursion, an unreadable or malformed marker, or a target `stat` failure during orphan reconciliation.

### Root cause and control/data flow

`Ownership.Worktree.listMarkers` collapses confirmed absence, complete empty observation, partial recursive observation, marker read failure, and malformed authority into one array. `hasLiveOwner` further collapses that array to a boolean. `Worktree.removeManagedProjectWorktreeDirectory` interprets false as an ownerless proof inside the final critical section. `WorktreeGC.apply` logs reconciliation failure but still proceeds through candidates, and returns only counters rather than an exact preservation receipt.

### Why the current structure cannot cure it

- The process-local `WorktreeOwnershipCriticalSection` prevents same-process acquisition/removal races but cannot replace restart-safe filesystem owners.
- Logging an observation failure does not carry a value to the destructive decision.
- A catch-and-preserve inside GC inspection does not protect an already-built exact candidate during apply.
- Project sandbox membership is a separate durable owner; checking physical existence before honoring it recreates the same absence inference.
- `CS-046` is earlier: ordinary Project discovery erases durable sandbox rows. This batch does not modify discovery or infer release from physical absence; that remains a separate B03 repair.

### Approved design boundary for review

1. In `engine/ownership.ts`, introduce one backend-internal observation vocabulary and one snapshot authority. Filesystem probes return `present(value) | confirmed_missing | unobservable({ operation, normalizedPath, code, cause })`; the snapshot returns `{ entries, integrity: complete | invalid | unobservable }`. Only an `ENOENT` observed by a complete parent-directory listing before a child is entered is confirmed absence. `ENOTDIR` is always invalid/unobservable. If an entry was observed and its later read yields `ENOENT`, or any entered nested read yields `ENOENT`/`ENOTDIR`, the snapshot is partial and unobservable. No partial marker list can sign an ownerless proof.
2. Replace the generic recursive crawler from `tasks/` with a canonical scoped traversal that reads only `tasks/<canonical-task>/sessions/<canonical-session>/ownership/worktrees`. It must not enter Artifacts, materializations, traces, or any other Task subtree. A complete parent listing that lacks `sessions`, `ownership`, or `worktrees` is an observed absence; an unreadable unrelated Artifact subtree is irrelevant. An unreadable observed canonical ownership path makes integrity unobservable. Marker path-derived Task/Session identity must equal the marker content.
3. Marker `readFile` failure is unobservable. Invalid JSON or invalid schema is `integrity: invalid`, not absence. The schema requires canonical Task and Session IDs, absolute `cwd`, a positive-integer `ownerPid`, finite non-negative `createdAt`, `kind: worktree`, and path/content identity agreement; destructive proof rejects invalid integrity. Diagnostic inspection retains an internal invalid entry without treating it as releasable.
4. Replace boolean PID liveness with `alive | dead | unobservable`: only `ESRCH` proves dead, `EPERM` proves alive, and every other `process.kill(pid, 0)` failure is unobservable. Replace the Task-owner boolean with `active | releasable`, where releasable means the exact Task is missing or terminal under the existing database policy. The single state table is: PID alive => owned; PID unobservable => unobservable; PID dead + Task active => owned by its durable restart marker; PID dead + Task missing/terminal => releasable, and only explicit reconcile/release may remove it. This does not attempt the separate PID-occurrence precision repair in `CS-023`.
5. Replace boolean `hasLiveOwner` with a receipt-producing projection over that single snapshot: `owned(marker identity) | ownerless(complete snapshot proof) | unobservable/invalid`. Change `WorktreeOwnershipCriticalSection.remove` itself so `proveOwnerless` must return the typed/branded ownerless proof (or an explicit `owned` result), not an arbitrary boolean. Its sole production caller and focused tests migrate together; no compatibility boolean, fallback scan, or final true/false adapter remains.
6. Migrate every snapshot consumer: `list`, `releaseOwner`, `releaseSessionOwner`, `releaseTaskOwners`, `releaseDirectoryOwners`, `orphans`, and `reconcileOrphans`, plus their Worktree/managed-session/Session settlement callers. Non-destructive exact release may delete already-confirmed valid matching entries from the same snapshot even when another entry makes integrity invalid/unobservable, then returns a structured release receipt containing released identities plus integrity preservation. Callers explicitly record/propagate that preservation without undoing the safe exact release. No release method performs a second scan and no caller silently discards integrity. Destructive ownerless proof still requires `integrity: complete`.
7. Replace orphan target `pathExists` with typed `stat` observation. Only target `ENOENT` yields `target-missing` after the marker snapshot is complete; `ENOTDIR`, `EACCES`, `EIO`, `EPERM`, `EBUSY`, and other failures propagate the stable observation failure and leave the marker authoritative.
5. The destructive identity path must use the same observation contract before marker proof. Add an exact removal-only identity resolver for target, primary, registered entries, and matching sandbox identity that never turns `realpath` failure into lexical equality and never turns filesystem case/identity `stat` failure into `false`. `EACCES`, `EIO`, `EPERM`, `EBUSY`, sharing violations, junction/alias uncertainty, or an invalid primary identity produce the typed unobservable result. Do not change the broad non-destructive `canonical()` helper in this batch; route the final removal gate and its registered/sandbox comparisons through the strict resolver and remove every catch-to-absolute/catch-to-false in that chain.
9. Add `WorktreeOwnershipObservationError`. Server diagnostics retain normalized absolute paths, invalid marker details, and original causes. Public NamedError data exposes only stable `operation`, error `code`, safe message, and a non-sensitive resource/scope; it never returns internal marker/runtime paths, raw cause, PID, or malformed contents. Map it explicitly to HTTP 503 before generic `Worktree* -> 400`; add the 503 named-error schema to the shared error catalog and all three reachable routes: both delete endpoints and `GET /project/current/cleanup-candidates`. Regenerate OpenAPI/SDK and require clean generated-artifact verification.
10. In the final removal proof, a matching `Project.sandboxes` entry is an owner whenever `releaseSandboxOwnership` is false. Remove the `exists(directory)` condition. Sandbox comparison uses the strict identity observation: proven same means owned, proven different may continue, unknown never means different. Explicit release is the only row-removal authority; B02 never removes a Project row because a path is physically missing.
11. Replace `WorktreeGC.ApplyResult { removed, failed }` with an exact discriminated settlement. Project reconciliation failure appends a project-scoped preservation and skips every candidate for that project. Candidate final-proof failure appends a candidate-scoped preservation with `projectID`, caller-known Worktree identity, reason, operation, and code. Successful removals return exact candidate receipts; counts may be derived summaries only. Internal primary/marker paths and causes remain server diagnostics. Physical directory/branch removal is reachable only after strict identity and complete ownerless proof.
12. Contract the public cleanup response to caller-known identities and safe diagnostics. Remove `markerPath`, raw marker `cwd`, `ownerPid`, `createdAt`, and internal `primaryDir` from the HTTP/SDK shape. Expose project/Task/Session/Worktree identities only where they are already public plus safe reason/operation/code. No production consumer exists outside generated SDK declarations, so record this as an intentional breaking diagnostic-contract correction, update route schema to the complete current preservation union plus ownership observation, and regenerate SDK/OpenAPI rather than extending the leaking schema.
13. Update `specs/current/architecture/task-runtime-directory.md` to make scoped complete observation, strict destructive identity, PID/Task owner state, safe exact release, public-safe diagnostics, invalid/unreadable marker handling, and durable sandbox ownership the current deletion contract.
14. Do not change `Project.fromDirectory`, `Project.sandboxes()`, ordinary GC inspection candidate rules (`directory`, `.git`, `realpath`), or ordinary-discovery writeback in B02. Those are B03/`CS-046`. B02 changes GC only at apply-time revalidation/preservation and changes identity helpers only for the final destructive gate.

### Definitions, callers, public contracts, and data impact

- Definition/scan owner: `packages/opencorvus/src/engine/ownership.ts` canonical scoped snapshot, strict marker parser, PID/Task projection, list/release receipts, ownerless proof, orphan inspection/reconciliation.
- Final destructive gate: `packages/opencorvus/src/worktree/index.ts` `removeManagedProjectWorktreeDirectory`, explicit project Worktree removal, GC removal, and orphan reconciliation wrapper.
- Release consumers: `packages/opencorvus/src/worktree/managed-session-owner.ts`, Worktree owner-release/reconcile wrappers, and every Session/Task settlement caller found by the final whole-repository search migrate to and explicitly settle the release receipt.
- GC settlement: `packages/opencorvus/src/worktree/gc.ts` `apply` project reconciliation and exact candidate settlements. Inspection-side candidate discovery bugs remain B03 except where B02 removes unsafe public fields or feeds an exact candidate to apply.
- HTTP mapping/contracts: `packages/opencorvus/src/server/error.ts`, `packages/opencorvus/src/server/error-handler.ts`, `packages/opencorvus/src/server/routes/project.ts`, and `packages/opencorvus/src/server/routes/experimental.ts`; generated OpenAPI/SDK artifacts follow the canonical generator.
- Durable data: ownership marker files and `ProjectTable.sandboxes` are preserved on every unobservable result. This batch adds no database column, journal, compatibility reader, or new deletion path.
- Overlay changes are unnecessary: existing non-2xx handling can project a typed server error. In particular, the concurrently dirty `TaskDirBar.tsx` remains untouched.

### Focused positive verification

- Extend `packages/opencorvus/test/algorithm-batch-one.test.ts` with snapshot/receipt matrices: root missing; canonical ownership path unreadable; observed nested disappearance; marker read failure; malformed and path/content-mismatched markers; strict marker field failures; target stat failures; unrelated unreadable Artifact subtree ignored. PID `ESRCH` + missing/terminal Task is releasable, `EPERM` is alive, unknown kill errors are unobservable, and dead PID + active Task remains owned. Exact release removes its known valid match and returns any unrelated integrity preservation; destructive proof requires complete integrity. Critical-section tests use the branded proof.
- Extend `packages/opencorvus/test/project-directory-and-worktree-gc.test.ts` through production removal/apply. Target/primary/sandbox identity `realpath`/`stat` and marker observations inject `EACCES`, `EIO`, `EPERM`, and `EBUSY`; each yields a public-safe 503 or exact project/candidate preservation whose receipt positively identifies the still-preserved directory, branch, Git registry entry, Project sandbox row, and marker. Complete strict identity + complete ownerless proof + explicit release still yields the exact success receipt.
- Assert all three route contracts expose the safe 503 by parsing/equating the complete public discriminated payload (`operation`, `code`, safe scope/resource, message) and the complete cleanup candidate/preservation unions. Assert the server diagnostic error/log object positively carries the correlated internal operation/path/cause. Generated SDK/OpenAPI must expose exactly the public-safe schema. Do not add field-absence or “rm was not called” tests.
- Run the explicit non-UI algorithm/GC files plus every settlement contract whose production caller changes: `packages/opencorvus/test/session-execution-authority-managed-worktree.test.ts`, `packages/opencorvus/test/dispatch-agent-managed-lifecycle.test.ts`, and `packages/opencorvus/test/session-error-bridge.test.ts`, plus the exact Engine/Session settlement test selected from the final caller diff if another caller migrates. These tests must positively prove the exact release receipt and integrity preservation reach the caller's current settlement/error contract while a complete release still reaches its expected terminal receipt. The concurrently modified generic runner/preload files are not staged and the whole suite is not run.
- Run `bun run --cwd packages/opencorvus typecheck`, `bun run api:routes-check`, the repository SDK/OpenAPI generation cleanliness check selected by the existing scripts, `bun run docs:check`, whole-scope symbol/catch search, and task-file `git diff --check`.

### Delivery and risk

- The public behavior change is intentionally fail-closed: transient ownership observation returns 503 rather than 400/false deletion success. Clients may retry only after the authority becomes observable.
- A malformed marker can now block automated deletion until repaired; that is safer than treating corrupted ownership as absence and is documented as such.
- The implementation must not stage concurrently dirty runner, preload, Overlay UI, database-recovery spec, or B01-unrelated `main.rs` changes.
- Pre-implementation review: PASS after three read-only rounds. The first review identified five P1 gaps in absence semantics, owner state, consumer migration, strict sandbox identity, and public/GC receipts. The second found missing real settlement tests and a prohibited field-absence assertion. The final revision covers all findings and passed with no unresolved P0-P3 issue.
- Implementation: complete. Ownership scanning now returns typed complete/invalid/unobservable snapshots from only the canonical Task/Session ownership subtree; destructive proof requires one branded complete ownerless receipt. PID, target, primary, Git registry, process-binding, marker, and durable sandbox authorities are fail-closed and converge through one removal occurrence. Explicit sandbox release uses the exact stored rows plus complete authority revision compare-and-swap; external-directory Task creation holds the same strict physical-directory admission through atomic Task/process-binding publication. GC returns exact project/candidate settlements, and public 503 diagnostics exclude internal paths, PIDs, and marker payloads.
- Verification: `algorithm-batch-one.test.ts` passed 22 tests / 78 expectations; `project-directory-and-worktree-gc.test.ts` passed 37 / 55; runtime isolation plus all migrated settlement contracts passed 24 / 167. OpenCorvus, Transport Protocol, and SDK typechecks passed. Route policy passed 6 rules / 34 files; documentation passed 338 operations / 25 groups; SDK import checking and task-owned diff checks passed. Generated OpenAPI, SDK types, and English/Chinese API references were regenerated from the canonical routes.
- Independent implementation review: PASS after four adversarial rounds. Round one found exact sandbox-alias release and production GC/route coverage gaps. Round two found non-atomic sandbox proof/release. Round three proved the initial helper did not cover the production Task registration-to-binding interval. The final repair made the real `EngineService.createTask` external-directory occurrence hold strict admission across registration, `Instance.provide`, and the atomic Task/process-binding commit; its controlled production-path race test and the complete diff were re-reviewed with no remaining P0-P3 finding.
- Commit: pending exact staging.

## Subsequent Batch Planning Rule

After B01 is reviewed and committed, the primary agent re-reads the next selected findings and architecture sources, expands this document with their exact definitions/callers/data contracts and positive checks, then obtains a fresh independent plan review before touching those product paths. The program continues until all 77 open findings are closed or a precise external blocker is recorded.
