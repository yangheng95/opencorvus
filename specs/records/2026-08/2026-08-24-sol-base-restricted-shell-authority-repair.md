# Sol Base restricted-shell authority repair

## Recall

- User request: after the formal Sol Mission/Base AutomationBench run stopped, repair the bench environment and resume the authorized test.
- Acceptance criteria: identify the first failing boundary from preserved evidence; keep all prior attempts immutable; prevent a 50-case run from launching with the wrong restricted-shell authority; retain the historical 1–50 shell digest while preserving the 51–600 extension; invalidate the five affected Sol attempts; rerun only missing or invalid slots; and prove the repaired first batch reaches valid sealed evidence before allowing later batches.
- Hard constraints: use the dedicated bench branch and worktree; exact `openai/gpt-5.6-sol`, Mission intake, Base only, repetition 1; no more than five active cases; do not overwrite evidence or rerun already verified slots; keep credentials out of logs/spec/Git; stop launches on a framework bug; use focused positive tests, documentation/type checks, and an independent read-only review before delivery.
- Materials read: repository `AGENTS.md`; `skills/automationbench-experiment/SKILL.md`; `specs/records/2026-08/2026-08-22-automationbench-adversarial-acceptance-repair.md`; Sol supervisor, batch coordinator, trial runner, catalog, verifier, contract, restricted shell, and focused benchmark contract tests.
- Whole-repository search: definitions and callers of `restricted-agent-shell`, `wrapper_sha256`, `AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256`, batch sealing, orphan attempts, dispositions, and supervisor invocations were inspected. The search confirms one runtime wrapper path is used by all current supervisors while the evidence authority intentionally distinguishes the immutable 1–50 digest from the current extended digest.
- Independent agent feedback: none before implementation. The first read-only delivery review found that catalog/verifier still derived the extended authority from the caller-selected installed wrapper and that installation happened before the per-supervisor lock. Both findings were accepted and repaired; a fresh final review is required after regression verification.

## Evidence and root cause

- The persistent Windows WSL host exited after batch 1. Its supervisor log records five scored trial processes followed by `Rolling batches 1 contain failed, invalid, or unsealed trials`.
- All five new Sol attempts reached natural Mission completion, emitted official scorer results, passed evaluator, profile, Skill, trace, replay, terminal-quiescence, and host-boundary audits, and left no active lease.
- Catalog reconstruction rejects every result with `sandbox_isolation_failed`; the nested cause is `restricted_shell_authority_mismatch`. Each result sealed wrapper digest `ac14f4540c68d48cdc744a1d0b607243a28cbe82fd76a662b03847b49ec0d063`, while cases 1–50 require the immutable Base digest `32ed4bd67d0c51d4acc8f86c7fbc1c47b7fc68aa75d5bc0d69728f658e3893b0`.
- The installed WSL wrapper exactly matches the current bench source, so this is not stale file copying. Commit `3acc93934` broadened the single source wrapper from the original 50-case UID range to cases 1–600. The authority contract intentionally retained the historical 1–50 digest, but the trial runner and all supervisors still accept only the new single wrapper path. A fresh 1–50 run therefore cannot satisfy its own catalog contract.
- The earlier process-host `SIGHUP` also left five `orphan_unsealed` attempts. They remain audit evidence, but they are not the direct cause of the second batch failure: the second receipt lists zero eligible runs because all five scored results fail restricted-shell authority.
- The old path did not root-fix the issue because behavioral isolation preflight proved only UID/filesystem/socket behavior. It did not prove that a case range was launched with the digest later required by catalog and final verification.

## Repair plan

1. Add an immutable Base restricted-shell source containing the original 1–50 contract and keep the existing 1–600 wrapper as the extended authority. Expose one contract resolver for the expected source/digest by case index.
2. Make the trial runner select the expected source identity from the actual case index before it runs the shell. Make catalog and verifier accept an installed wrapper only when its digest is one of those two source authorities, while continuing to audit each sealed attempt against its case-index authority.
3. Point 1–50 supervisors to a root-owned installed Base wrapper and leave the 51–600 supervisor on the extended wrapper. Add an environment deployment/check script so both installed files are copied from the exact clean runner commit, root-owned, non-writable, and digest-verified before any Provider or model work.
4. Add focused positive tests for both boundary cases, supervisor selection, and environment identity. Run the focused benchmark contract tests, benchmark typecheck, documentation check, shell syntax checks, and Git diff checks.
5. Mark the five Sol scored attempts `invalid_bug` without rewriting their sealed directories; catalog the earlier signal-interrupted starts as preserved non-eligible attempts; independently review the code/spec/test diff; commit and push the bench-only framework repair; synchronize the WSL runner and installed wrappers to that exact commit.
6. Relaunch the Sol supervisor in a persistent hidden Windows WSL host. Reuse no invalid slot, confirm five new batch-1 run IDs and active leases, then require a completed batch-1 receipt with five eligible runs before considering the environment repaired.

## Scope and risks

- This is benchmark-only framework and environment work. No product runtime, release branch, tag, release, or public deployment is authorized.
- The Base and extended wrappers must remain explicit authorities; accepting arbitrary current digests would silently invalidate historical evidence, while replacing the historical digest would relabel old runs.
- Existing sealed result directories and manifests are immutable. Operator dispositions may classify run IDs, but may not alter their contents.
- A new run must not begin until source, installed wrapper, catalog, and verifier agree on the same case-index authority.

## Implementation and verification

- Added immutable `restricted-agent-shell-base.sh` with measured SHA-256 `32ed4bd67d0c51d4acc8f86c7fbc1c47b7fc68aa75d5bc0d69728f658e3893b0`; retained the extended wrapper at `ac14f4540c68d48cdc744a1d0b607243a28cbe82fd76a662b03847b49ec0d063`.
- Added one case-index source resolver and made the trial preflight compare the installed wrapper against the matching source after isolated runtime/bridge setup but before any Provider or model work. Catalog and verifier admit only those two repository sources, then continue to audit every sealed run against its case-range authority.
- Added a root-only installer that atomically projects both wrappers with mode `0755`, byte-compares each installed file to source, and reports only their public digests. Sol Base and Luna Advanced use the Base path; Luna cases 51–600 use the extended path.
- All three supervisors acquire their per-experiment lock before installing the exact source wrappers. The installer has its own shared lock and atomically replaces each target. Supervisors trap `HUP` as well as `INT`/`TERM`, reset all three signals in the handler, terminate the active coordinator, and wait for its trial-sealing path.
- The five affected scored Sol run IDs were classified in the root-private `run-dispositions.json` as `invalid_bug: restricted_shell_authority_mismatch`; its resulting authority file remains root-owned mode `0600`. No sealed run directory or manifest was changed. The earlier five signal-interrupted starts remain visible as `orphan_unsealed` audit attempts.
- Focused contract suite: 66 tests, 157 expectations, zero failures. Package typecheck passed both ordinary and benchmark tsconfig. `docs:check` passed 331 operations across 25 groups. Bash syntax checks passed for both wrappers, the installer, and all three supervisors. `git diff --check` passed.
- Live environment projection check installed both WSL files as `root:root` mode `0755` and reproduced the exact Base and extended source digests above.
