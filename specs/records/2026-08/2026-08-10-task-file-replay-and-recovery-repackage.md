# Task File Replay and Recovery Repackage

## Recall

| Item | Record |
| --- | --- |
| User request | Diagnose the stalled `建立基线模型训练资产` Task, systematically repair the product defect, restore the same Task, and rebuild the local package. During packaging, the user supplied a second observable failure: `POST /mission/wake` returned API 500 for `D:\myhexin-local\demos\long-absa-task`. |
| Acceptance | `application/schema+json` Artifact resources are read and replayed as text; historical tool-result attachments no longer produce invalid OpenAI `file_data`; supported binary inputs retain typed transport; a native Git metadata watcher failure is isolated and cannot poison unrelated project requests; focused non-UI tests, typecheck, docs check, independent review, and Windows local packaging pass; the existing Task remains recoverable without database edits or replacement identity. |
| Hard constraints | Preserve one current implementation and one source of truth; no MIME relabeling, fallback protocol, database surgery, replacement Task, hidden message, UI automation test, unrelated cleanup, user-process restart, release, or tag. All LLM interaction remains streaming. |
| Input evidence | Task debug export `C:\Users\hengu\.codex\attachments\15ab4259-c481-460a-b7ec-d44c5ebce978\pasted-text.txt`; read-only runtime database inspection of Task `tsk_g019fea65accd0000000000006AeWsXW9IdhoBR`; target repository HEAD `84435d4`; OpenAI File inputs documentation fetched 2026-08-10; screenshot of the Mission wake 500; server logs `2026-08-10T005207-23692-1.log` and `2026-08-10T005520-22292-1.log`. |
| Sources read | `AGENTS.md`; `specs/README.md`; August records index; `session/text-mime.ts`; `artifact-catalog/index.ts`; `session/message.ts`; `provider/transform.ts`; `engine/queue.ts`; `task-api/index.ts`; `file/watcher.ts`; `project/instance.ts`; `project/vcs.ts`; relevant attachment/provider/watcher tests and package scripts. |
| Whole-repository search | Searched definitions and call sites for `isDecodableText`, `toolResultToModelOutput`, `file-data`, `file_data`, `artifact_read`, `QueuedWakeSettlementError`, task retry/replan/resume, immutable workflow binding, local packaging, `mission/wake`, `Native file watcher`, watcher health registration, subscription groups, and Git `HEAD` refresh. |
| Independent agent feedback | The first read-only review found two P1 gaps: an incomplete OpenAI accepted-MIME allowlist and an inline-only replay test. Both were fixed. A second review closed those findings. After the watcher and packaging repairs, the same read-only reviewer inspected the complete final diff, independently reran 15 focused tests, recomputed both installer digests, and reported no unresolved findings. No agent participated in implementation. |

## Problem depth and impact

### Observable state

- The Task is still `active`, but ten of eleven execution occurrences are terminal and the sole nonterminal Orchestrator Session is idle.
- `test-engineer` and `system-integrity-reviewer` each failed twice with OpenAI HTTP 400 at historical `file_data` replay.
- All four Delivery Slices retain implementation files and commit evidence but remain unaccepted because mandatory Test and Integrity nodes did not reach terminal success.
- A later scheduled wake ended with visible prose but no scheduler decision, so queue settlement correctly marked that wake `delivery_failed` and no further wake remained.

### Direct trigger

`artifact_read` classified `application/schema+json` as binary and persisted `schema.json` as a tool-result attachment. The OpenAI Responses projection then emitted that attachment as `file-data`, producing a `data:application/schema+json;base64,...` request rejected by the provider.

### Root data flow

1. `isDecodableText` recognizes a fixed set of `application/*` MIME values but not standards-based `+json` or `+xml` structured syntax suffixes.
2. The Artifact Catalog therefore returns those textual resources as binary attachments.
3. `toolResultAttachmentTransport` treats every non-image attachment on the OpenAI adapter as valid `file-data`, although the API accepts a finite MIME list.
4. `toolResultToModelOutput` rehydrates persisted attachments and sends the same invalid typed file on every immutable continuation.
5. The repeated provider failure happens before the worker can read recovery guidance or publish terminal evidence.

### Why prior paths did not heal it

- Retrying the committed occurrence preserves the correct immutable Session lineage, but replaying the same bad projection reproduces the same provider rejection.
- Creating a replacement Session or Task would hide the defect and violate immutable workflow authority.
- Retry/Replan accepts only terminal Tasks; this Task remained active after wake-delivery failure.
- The Orchestrator incorrectly inferred that repository code could not repair historical replay and attempted `fail_task`; final checkpointing then encountered a separate, now-ended supervised-process exit delay.

### Impact boundary

- Definitions: textual MIME classification and provider-aware tool-result attachment transport.
- Callers: Artifact Catalog inline reads, live tool output, persisted tool replay, compaction media stripping, and provider prompt conversion.
- Data: persisted attachment MIME and bytes remain immutable; the repair changes only model-bound projection.
- Lifecycle: existing queued-wake settlement logic remains authoritative. Recovery uses a new real operator message after the fixed runtime is active.
- UI: no UI code or UI automated tests are required. Packaging is native Windows delivery verification only.
- Unknown: the current desktop process cannot be restarted without operator authorization, so same-Task live recovery may remain a handoff after the package is built.

### Mission wake 500 discovered during delivery

- Request `285de8ad-2e44-4b29-b044-89e8284d105e` failed before Mission route work with `Native file watcher failed for D:\myhexin-local\demos\long-absa-task\.git\HEAD: EPERM`.
- The direct trigger was replacement of the fixture repository: the watched `.git\HEAD` disappeared, its VCS refresh observed a non-repository, and the Windows native watcher emitted `EPERM`. The repository was recreated later, so a fresh backend accepted `/mission/wake` with request `8488052b-043a-4e4e-9f5b-4e744a8daee5` in 95 ms.
- The control-flow root cause is broader than that transient filesystem change: `createSubscriptionGroup` records every asynchronous watcher termination as permanent instance unhealthiness, and `Instance.provide` runs that health check before every unrelated route. An optional Git branch-notification channel therefore turns one terminal watcher into project-wide 500 responses.
- Callback logging already isolates subscriber failures, and `Event.Failed` already exposes watcher diagnostics. Runtime subscription termination must likewise publish its exact diagnostic and dispose owned watchers, while project request health remains independent. Initialization failure remains explicit during project open; no alternate watcher implementation or retry loop is introduced.
- The VCS resolver must also map a currently absent `.git` directory to the positive `undefined` branch state before invoking Git, so repository replacement produces a branch transition rather than an unrelated Git command error.

## Implementation plan

1. Extend the canonical text MIME classifier to structured JSON/XML suffixes.
2. Decode every resolved textual tool-result attachment to bounded UTF-8 text with its immutable evidence identity before provider transport selection.
3. Restrict typed OpenAI file transport to the documented MIME set required by current product use; retain native image transport and explicit unsupported evidence for other binary types.
4. Add focused positive tests for structured JSON Artifact reads, historical tool-result replay, and supported PDF typed transport.
5. Run targeted tests, package typecheck, root docs check, and diff checks.
6. Obtain an independent read-only review, resolve every valid finding, repeat review if fixes are required, then create the local Windows package.
7. Commit and push only the reviewed task changes. Restore the original Task through a real operator wake only after the fixed runtime is running.
8. Isolate native watcher runtime termination from instance request health, preserve failure publication and deterministic disposal, and make VCS branch refresh recognize repository removal.

### Packaging toolchain finding

The first package attempt exposed two independent defects in the legacy local orchestrator rather than in the product build:

- It requested Bun cross-compilers for every operating system even when only the current Windows host package was required; Bun 1.3.14 repeatedly downloaded but could not extract the Linux ARM64 compiler on Windows.
- Its native step invoked the Overlay `build` script with `--skip-opencorvus-build`, but that script is Vite-only and rejects the unknown flag. The command therefore could neither build the native executable nor produce the bundle directory named in its own summary.

The repair makes local packaging use the existing single host-bound `build:overlay` primitive, then invokes Tauri's bundle-only phase for the host's documented installer kinds with updater artifacts disabled for unsigned local builds. Linux Docker packaging remains an explicit independent option; the obsolete cross-platform sidecar prebuild and `--skip-cli` path are removed rather than retained as a second implementation.

The repaired native build reached a valid `target/release/opencorvus-overlay.exe`, then found the old developer copy under `packages/overlay/dist/` locked by a running process. Local installer packaging now passes an explicit `--skip-dist-copy` option so the build retains the canonical Tauri release executable as installer input without stopping or overwriting the user's running process. Ordinary developer builds keep their existing dist copy behavior.

## Verification ledger

| Check | Result |
| --- | --- |
| Structured MIME and provider projection tests | `bun test --timeout=0 test/tool-result-attachment-provider-projection.test.ts test/tool/result-attachment-materialization.test.ts`: 11 pass, 0 fail, 19 assertions. |
| Watcher runtime isolation | `bun test --timeout=0 test/file-watcher-runtime-isolation.test.ts test/persistent-instance-publication.test.ts`: 3 pass, 0 fail, 8 assertions. The tests verify exact diagnostic delivery and disposal, initialized project health after runtime termination, and the Git-repository-removal branch transition. |
| Historical canonical replay | The focused test writes `application/schema+json` through `AttachmentStore.write`, replays its canonical `/attachment/...` reference, and verifies text, reference, digest, MIME, and content. |
| OpenAI accepted binary contract | Positive table tests retain typed-file transport for PDF, `application/csv`, `application/x-iif`, and Google Sheets. The implementation contains the complete documented File inputs MIME list fetched 2026-08-10. |
| TypeScript | `packages/opencorvus`: `bun run typecheck` passed. |
| Documentation | Root `bun run docs:check` passed with 322 operations and 25 groups. |
| Patch hygiene | `git diff --check` passed. |
| Independent review | First review: two P1 findings, both fixed. Second review closed the attachment changes. Final review covered the watcher, packaging scripts, full diff, ignored spec, untracked tests, and installer files; 15 tests passed independently, hashes matched, and no unresolved findings remained. |
| Windows local package | `bun run package:local --skip-linux` passed. MSI: `OpenCorvus_0.0.38-beta_x64_en-US.msi`, 187,580,416 bytes, SHA-256 `564AF63CF63D414C13919E9847BBD96973F57EAEB8309283E014873C41ABF4C3`. NSIS: `OpenCorvus_0.0.38-beta_x64-setup.exe`, 186,482,468 bytes, SHA-256 `CF610BA69C19289FA0402F40C80191D5031C19B6397D31E42CB7AA54D4E30940`. Embedded server payload stamp reports 8,153 files, 424,669,874 bytes, digest `996ac89dd453b568f247953f318050ecffc8a433a27540db53b3433fb7837577`. |

The repository-wide Biome invocation is not a declared package acceptance script and reports pre-existing whole-file lint debt in `provider/transform.ts`; it did not modify the worktree. The declared focused checks above remain authoritative for this change.
