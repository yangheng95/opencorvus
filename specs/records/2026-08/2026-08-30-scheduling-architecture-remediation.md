# Scheduling architecture remediation

## Recall

| Item | Record |
| --- | --- |
| User requirement | Push the verified `v0.0.55beta` work, then solve every remaining architecture issue. After the ledger is empty, run a real end-to-end Mission, inspect the complete persisted scheduling trajectory, repair every anomaly from the shared architecture root and repeat until clean; then release public version `0.0.56beta` and the website. |
| Version boundary | Public versions use at most three numeric components. The failed `0.0.56-beta` and `0.0.57-beta` identities remain immutable; the current canonical corrective target is `0.0.58-beta`. Dynamic package revision `2026.08.30.2` is an internal package revision required by its existing schema, not a public release version. |
| Benchmark boundary | The benchmark worktree and branch remain separate. Benchmark code is not merged, modified or used as the delivery source. Current repairs are derived from the main worktree's source, current architecture and authoritative audit records. |
| Current baseline | `origin/v0.0.55beta` and `HEAD` are `fc8d498582c8c3ae5e8b6dab2c9476d323747cb8`. Dynamic durable frontier, exact terminal Message authority, SDK/OpenAPI generation and the recovery-cycle ownership cuts are pushed. Full pre-push passed root typecheck, routes, docs, control leases, architecture/package/release/module topology and secret scan. |
| Preserved parallel work | `packages/opencorvus/src/session/index.ts`, `packages/web/src/content/expert-squad-distribution.generated.ts` and `packages/web/src/content/public-market-zh-01-35.ts` remain unrelated unstaged changes and are excluded from every remediation commit. |
| Sources read | `AGENTS.md`; the user-pasted repository architecture-debt audit; `2026-08-24-repository-architecture-debt-saturation-audit.md`; `2026-08-25-architecture-debt-remediation.md`; `2026-08-28-remaining-architecture-debt-closure.md`; `2026-08-30-scheduling-algorithm-razor-audit.md`; current architecture index and the current production definitions/callers named by each finding. |
| Repository reconciliation | ARC-001 through ARC-059 are historical closed findings with committed implementation/review/runtime evidence. The later scheduling razor audit is a new queue: 34 runtime/algorithm findings (A1-A24 including A18a/A18b, B1-B9) and two documentation contradictions (C1-C2). Old `状态：HEAD` text remains evidence until current-source verification closes or disproves each row. |
| Acceptance | Each retained row needs current code/data-flow proof, one source of truth, focused positive production-path evidence, relevant checkers, and uninvolved read-only FINAL PASS. After all rows close, a fresh exact-remote real Mission must have one coherent Task/Mission/Session occurrence trajectory, exact FIFO/wake/retry/recovery/terminal receipts, no malformed Tool input, duplicate effect, hidden Message, stale owner, live lease, Project crossing or unexplained error. |
| Independent feedback before this cut | The Dynamic/recovery delivery passed repeated independent review. No independent reviewer has yet reviewed the B1 implementation cut; review follows its first-green verification. |

## Current ledger

| Group | IDs | Current disposition |
| --- | --- | --- |
| Frontier and dispatch ownership | A1-A2 | A1 changed materially in `bc90758f1`/`fc8d49858` and requires current-source reconciliation against the collection-occurrence critique; A2 remains current and unclosed. |
| Mission close/recovery | A3-A4, B4 | Open pending current-source repair. |
| Wait/Automation occurrence | A5-A9, B3, B6-B7 | Open pending current-source repair. |
| Task/Mission/Work creation identity | A10-A17 | Open pending current-source repair. |
| Deletion, Project, Workspace and Git lifecycle | A18a-A24 | Open pending current-source repair. |
| Shared protocol and scheduling complexity | A19, B1-B2, B5, B8-B9 | B1 is the first implementation cut below; the others remain open. |
| Architecture documentation | C1-C2 | Open until implementation semantics are selected and the current documents are corrected. |

The ledger is intentionally not marked closed by historical commits, narrow tests or the previous ARC-059 Mission. Any current-source evidence that a row is already repaired must still identify the exact implementing commit and prove the audit's trigger and root no longer exist.

## Cut 1 — B1 Task-root decision repair Host gate

### Analysis

- **Observable behavior:** after one Task-root Provider step ends without a committed decision receipt, Session loop sets `toolChoice: "required"`; after the next gap it also removes every Tool without a decision declaration. The model no longer sees the same inspection and decision surface it was originally asked to reason over.
- **Direct trigger:** `taskRootDecisionRepairRung`, `taskRootDecisionRepairToolSurface`, the conditional replacement of `tools`, and `processor.process(... toolChoice)` in `session/loop.ts`. The dedicated test asserts the forced/narrowed ladder rather than a domain result.
- **Control-flow root:** the Host converts a semantic model-output gap into workflow-routing authority. The real finite convergence owner is already the Task-root semantic Turn budget and reducer; changing Provider tool-choice and hiding current facts is a second policy mechanism, not a data-integrity check.
- **Why the old path does not cure it:** forcing an arbitrary Tool can produce another inspection call, while hiding inspection Tools can force a lifecycle decision without current evidence. Both alter the model's choice instead of improving prompt/context/Tool definitions. The bounded exhausted/operator-visible settlement already handles repeated non-decisions.
- **Affected surface:** Session loop Provider request options, Task-root prompt projection, decision-repair test, Dynamic frontier decision declaration and documentation. No persisted schema, API, Message visibility, retry budget or Provider streaming mode changes.

### Single-source repair

Keep the bounded semantic-gap count and its visible repair guidance inside the same streamed assistant Turn. Remove the rung type, forced `toolChoice`, decision-only Tool filtering and related logging. Every retry sees the exact originally projected Tool surface and ordinary Provider `auto` choice; the Host continues to validate only whether a committed decision receipt exists and lets the existing finite budget reach its durable operator surface. Delete the obsolete gate-focused test because no replacement Host policy exists; positive Task-root decision/recovery and Dynamic real-provider contracts remain the behavior evidence.

### Required verification

Run the focused Task-root reducer/decision/terminal contracts, Dynamic deterministic/frontier contracts, OpenCorvus typecheck, exact module topology and diff checks. Then obtain an uninvolved read-only review of code, removed test, this record and regression evidence before commit/push.

### First-green evidence before independent review

The obsolete gate-focused test is deleted with the mechanism. The first independent review confirmed the Host gate was removed without changing Turn, prompt, budget or reducer ownership, and found two P2 evidence gaps: the production-shaped retry contract did not compare both Provider Tool requests, and this record still named the obsolete release target. The repaired production-path contract now proves the initial step and its visible repair step share the exact Base scheduler Tool key surface, ordinary Provider `auto` choice and one assistant Message; the finite reducer then settles the recorded decision. The version boundary follows the immutable failed tags and current `0.0.58-beta` authority.

After those repairs, the focused production contracts pass 35/35 with 69 assertions across initial Task ingress, Task-root reduction, Tool decision coordination, assembled Orchestrator Tool surface, durable Dynamic frontier recovery and deterministic real-provider evidence validation. OpenCorvus typecheck, docs (338 operations / 25 groups), architecture index (27 live documents), `git diff --cached --check` and exact candidate-index module topology pass at 1057 production modules / 5176 runtime edges / no retained SCC / four clean imports. The second independent read-only review confirmed both P2 findings closed, the obsolete mechanism would fail the new production-path contract, all unrelated paths remain excluded, and returned FINAL PASS with P0-P3 all zero.
