# CS-076 Native Upgrade Exact-Version Verification

## Recall

### User request

Repair only `CS-076`: the native installer currently discards the executable version probe and reports upgrade success from installer exit alone. Write this independent plan first, obtain a read-only plan review from `/root/surface_tooling_audit`, implement only after PASS, add focused non-UI positive tests, validate, and then obtain an independent read-only delivery review from `/root/backend_infra_audit`.

### Acceptance criteria

- A native upgrade succeeds only when the installer exits successfully **and** the exact executable at `process.execPath` executes a machine-consumable version probe whose normalized value equals the normalized requested target.
- Installer failure, probe execution failure, empty/malformed probe output, and an observed version other than the target all return a stable typed `UpgradeFailedError`; none reaches manual `Upgrade complete` or automatic `installation.updated` publication.
- Successful upgrade returns a typed receipt derived from the executable observation. Manual and automatic callers consume that receipt instead of synthesizing success from the requested target.
- `installation.updated` keeps its current public `{ version: string }` schema unless implementation proves that a schema change is unavoidable. If unavoidable, stop before changing shared transport, SDK, generated code, or public event contracts and report the minimum conflict set.
- Focused non-UI positive tests cover every settlement branch and the two callers' success consumption where practical. No UI automation, source-text absence assertion, snapshot, DOM, browser fixture, or pixel test is added or run.

### Hard constraints

- Do not touch the concurrent B02 files or the CS-040 domain.
- Do not modify `packages/transport-protocol`, SDK/generated outputs, shared README/index files, or shared audit/remediation records.
- Do not preserve the discarded probe as a fallback or introduce a second success source.
- No public event schema change without stopping for conflict review.
- This task owns only this specification, installation upgrade implementation, direct CLI callers when required, and focused tests.

### Materials read

- Repository `AGENTS.md`.
- `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md`, `CS-076`.
- `packages/opencorvus/src/installation/index.ts`.
- `packages/opencorvus/src/cli/cmd/upgrade.ts`.
- `packages/opencorvus/src/cli/upgrade.ts`.
- Relevant process-settlement architecture in `specs/current/architecture/task-control-plane.md`.
- Current package scripts and test conventions in `packages/opencorvus/package.json` and nearby test injection patterns.

### Whole-repository search results

- `Installation.upgrade` has exactly two production callers: manual CLI `packages/opencorvus/src/cli/cmd/upgrade.ts` and automatic updater `packages/opencorvus/src/cli/upgrade.ts`.
- `installation.updated` has one production publisher, the automatic updater. Its public schema is `{ version: string }`; no consumer requires a requested-versus-observed distinction.
- The installer command uses `VERSION: target` and checks installer exit, then executes `${process.execPath} --version` with `.nothrow()` but discards status/output.
- No focused installation upgrade test currently covers executable verification.
- The working tree contains broad unrelated concurrent changes, including prohibited packages and B02 files. They must remain untouched and must not enter this task's commit.

### Independent agent feedback

- Implementation-preceding independent feedback: none (parallel agent slots were occupied). The originally requested reviewer `/root/surface_tooling_audit` was already executing an independent CS-015 implementation batch and could not accept this review; the parent agent explicitly removed this extra pre-implementation gate and authorized implementation. Independent post-implementation delivery review remains required.

## Problem analysis

### Observable symptom and direct trigger

After the native install script exits zero, a missing, corrupt, non-executable, unchanged, or wrong-version target can still produce manual `Upgrade complete`; automatic update publishes the requested version through `installation.updated`. Trigger: the subsequent exact executable probe fails or observes a normalized version unequal to the requested target.

### Data/control-flow root cause

`Installation.upgrade(method, target)` treats installer exit zero as terminal success. It launches the correct observation point, `${process.execPath} --version`, but uses `.nothrow().quiet().text()` and discards both command status and text. Manual CLI tests only whether the Promise rejected. Automatic update publishes `{ version: latest }` from the requested value after the Promise resolves. Thus physical installation, observed executable revision, caller success, and event projection have no shared success receipt.

### Why the old abstraction does not cure it

`UpgradeFailedError` represents installer stderr only. The probe is an unowned side effect rather than settlement evidence. Atomicity inside the remote install script, if any, cannot prove which executable the current process path resolves to after the script returns. Caller-side requested target is an intention, not an observation.

### Affected contract and risk boundary

- Definition: `Installation.upgrade`, its failure type, and version normalization.
- Callers: manual CLI completion message and automatic update event publisher.
- Data: requested target, installer exit/stdout/stderr, executable probe exit/stdout/stderr, normalized observed version.
- Public event: schema need not change; its existing `version` field can be populated from the observed receipt.
- Delivery risk: malformed versions and provider-specific `--version` decoration must not be accepted through substring matching. Exact normalized equality is required.
- Excluded: installer transaction/recovery, desktop Overlay updater, release asset publication, transport protocol, generated clients, and rollback behavior.

## Implementation plan

### 1. Define one upgrade settlement receipt

Inside the installation subsystem, define a typed receipt containing at least:

- installation method;
- normalized requested version;
- normalized observed version;
- exact executable path that was probed.

`Installation.upgrade` returns this receipt. It is the sole success source for callers.

### 2. Define strict shared version normalization

Use one normalizer for both requested target and observed output:

- trim surrounding whitespace;
- accept one optional leading `v` only;
- require one complete semantic-looking version token for the whole normalized value rather than substring containment;
- reject empty output, multiple lines/extra prose, and malformed values;
- compare normalized strings exactly.

If the repository's real `opencorvus --version` format includes a stable product prefix, represent that format explicitly in this one parser and cover it with a fixture; do not use fuzzy extraction.

### 3. Make installer and probe observable through a bounded internal executor boundary

Factor command execution behind a small installation-local dependency boundary returning executable, arguments, exit code, stdout, and stderr. Production still uses Bun's streaming/process primitive for both commands. Tests inject deterministic installer and probe receipts without invoking the network installer or replacing the running binary.

This boundary is not a second implementation: it only supplies observations to the same settlement function. It must not leak into transport, SDK, generated APIs, or configuration.

### 4. Expand one stable failure contract

Keep `UpgradeFailedError` as the one upgrade failure family, but give it structured stages and observations sufficient for callers and diagnostics:

- `stage: "installer" | "executable_probe" | "version_mismatch"`;
- requested target;
- observed version when parseable;
- executable path for probe failures;
- exit code and stderr where applicable;
- concise message.

Do not expose success on any failed probe branch. Manual CLI can continue rendering the error's public diagnostic; update its field usage if the error payload changes.

### 5. Consume the observed receipt in both callers

- Manual CLI shows `Upgrade complete` only after receipt return. No public output schema changes are needed.
- Automatic update publishes `Installation.Event.Updated` with `receipt.observedVersion`, never the requested `latest` value.
- Preserve existing catch/log behavior for automatic failure, but include structured stage/target context when available.

### 6. Focused positive tests

Add one installation-focused test file covering:

1. installer nonzero → typed `installer` failure with installer observation;
2. installer zero + probe nonzero → typed `executable_probe` failure;
3. installer zero + empty/malformed probe → typed `executable_probe` failure;
4. installer zero + valid old/different version → typed `version_mismatch` failure naming requested and observed versions;
5. installer zero + normalized exact version → receipt contains exact requested/observed version and executable path;
6. optional leading `v` normalization succeeds only when the complete normalized values match;
7. decorated/substring output is rejected rather than guessed.

Where the automatic updater is testable without global module replacement, add a focused test proving its event version comes from the returned observed receipt. Otherwise keep caller logic as a direct receipt projection small enough for typecheck and independent review, and document that focused limitation rather than adding a brittle mock or source-text assertion.

### 7. Verification

Run only non-UI checks:

- focused installation upgrade test through the repository's declared test runner;
- `bun run typecheck` in `packages/opencorvus`;
- focused lint/check if the package exposes one applicable to touched files;
- `git diff --check` on task-owned paths;
- repository search confirming exactly two callers consume the new receipt and no requested-target success projection remains;
- no UI automation.

After first-pass verification, request `/root/backend_infra_audit` to independently read the specification, exact diff, tests, and verification evidence. Resolve every valid finding and repeat review when a repair is required.

## Non-goals and conflict stop condition

- No change to `Installation.Event.Updated` name or schema.
- No change to OpenAPI, transport protocol, SDK, generated artifacts, Overlay native updater, release logic, or shared documentation indexes.
- If a real consumer requires additional event fields or generated schema changes, implementation stops before those files are touched and reports the exact event definition, consumer, generator, and generated targets that would conflict.

## Positive completion evidence to record

- Plan-review result and reviewer identity.
- Exact task-owned diff.
- Focused test command and terminal result.
- Typecheck/check command and terminal result.
- Independent delivery-review result and any resulting correction/re-review.
- Final Git commit and push status, with unrelated dirty files excluded.

## Implementation and verification log

- Implementation: first pass complete. `Installation.upgrade` now validates the requested version, observes installer and exact executable probe results through one installation-local runner, rejects installer/probe/malformed/mismatch outcomes through structured `UpgradeFailedError`, and returns one exact observed-version receipt. Manual and automatic callers consume that receipt. `installation.updated` remains unchanged as `{ version: string }` and is populated from `receipt.observedVersion`.
- Focused positive test after independent-review repairs: `bun run script/run-tests.ts test/installation-upgrade-verification.test.ts` passed, 6 tests / 31 expectations. Covered exact success receipt, downloader nonzero before installer/probe, installer nonzero after a complete download, probe spawn failure, probe nonzero, empty/malformed/decorated output, exact mismatch, optional leading `v`, repository prerelease form, and malformed Semantic Versioning inputs.
- Typecheck: `bun run typecheck` passed. The first run found one CS-076-local redundant value-as-type annotation plus two transient concurrent B02 errors in `server/routes/experimental.ts`; only the local annotation was repaired. A clean rerun after the B02 owner converged passed without touching that file.
- Diff hygiene: `git diff --check` passed for all task-owned paths. Whole-source caller inventory still has exactly two `Installation.upgrade` callers, and the sole `installation.updated` publisher uses `receipt.observedVersion`.
- Public-schema conflict check: no conflict. Transport protocol, SDK/generated outputs, shared README/index files, B02 files, and CS-040 files were not touched.
- UI automation: not run; not applicable.
- Independent delivery review: first pass by `/root/backend_infra_audit` found two valid blockers: shell-pipeline tail exit could hide downloader failure, and the local version regular expression admitted malformed versions. The implementation now observes download and installer execution as separate stages and uses the repository `semver` parser. Focused tests and typecheck passed after repair. The same reviewer re-read the repaired implementation, caller projections, tests, schemas, and prohibited-path boundary and returned PASS with no remaining blocker. No commit or push has been made.
