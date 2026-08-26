# Search code bounded execution repair

Status: implemented and locally verified; independent review pending

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Diagnose why the supplied Task hung, then repair the problem. |
| Acceptance | Repair the shared `search_code` production path so repository-wide searches preserve ignore boundaries, finish under a finite wall-clock and output budget, settle the exact supervised process tree on limit/cancellation, and return a positive result or typed execution error instead of leaving a Tool occurrence running indefinitely. Cover the real Host/Conversation path, the shared Task-owned branch, result filtering, and process settlement with focused non-UI tests. |
| Hard constraints | Preserve the user-running Overlay/backend and exact live `rg.exe` occurrence; do not stop, restart, or mutate them without separate authorization. Keep one `SearchCodeTool` implementation and one process-supervision primitive; do not add fallback search paths, UI tests, non-streaming Large Language Model calls, or Host workflow gates. Preserve unrelated dirty worktree changes. |
| Sources read | Supplied `opencorvus.debug.v2` bundle; live Task, Session, Tool, listener, PID, process-tree, supervisor-request, and settlement-marker state; embedded ripgrep help; `AGENTS.md`; `specs/README.md`; `specs/records/2026-08/README.md`; `specs/current/architecture/task-control-plane.md`; prior Windows glob/process-settlement record; `packages/opencorvus/src/tool/grep.ts`; `packages/opencorvus/src/file/ripgrep.ts`; `packages/opencorvus/src/util/process.ts`; `packages/opencorvus/src/shell/process-supervisor.ts`; all `search_code` definitions/call sites and focused process/tool tests. |
| Repository search | `search_code` is registered once and projected to primary assistants, Mission, projected workers, frontend-design, visual-quality, and Agent context surfaces. Every caller reaches `SearchCodeTool`; only execution authority selects `spawnHostCommand` versus `spawnTaskCommand`. `Process.runHost/runTask` already supplies cross-platform cancellation, finite wall-clock and output bounds, process-tree termination, output draining, and physical/output settlement. No route, schema, queue, Mission, Task, Session, Provider, or UI contract needs a parallel repair. |
| Starting state | Branch `arch-debt-remediation` at `a77e8f68918480035faafcdae5b2498125186d4c`, upstream `origin/arch-debt-remediation`, ahead by one commit. The worktree already contains unrelated edits in CLI/session code and tests; task-owned paths start clean and are limited to `packages/opencorvus/src/tool/grep.ts`, `packages/opencorvus/src/tool/grep.txt`, `packages/opencorvus/src/util/process.ts`, one focused non-UI test, this record, and the two specs indexes. |
| Independent agent feedback | None before implementation. The required post-implementation read-only review found a missing forced-add for this ignored record, a concurrent mixed/early commit, lost supervisor owner metadata, post-search include filtering that could exhaust the output budget on irrelevant files, missing narrow/directory include coverage, and an overbroad explicit-Git-directory promise. All implementation/documentation findings were accepted; Git-history facts are recorded without rewriting user history. |

## Incident reconstruction

Observed facts:

1. Mission Session `ses_-zUWdZaTdzzbPO5gmzsN` created Task `tsk_g00VTMRs7U00Vb4tu19D`. Its intent and requirements branches completed; its `source-investigator` branch remained the only running occurrence.
2. Tool Part `prt_g0VTMSO1200Hip54zIQT` persisted `search_code` input `{ pattern: "AutomationBench|8\\.07%|34\\.00%|100 cases|100 个|100 cases", include: "*" }` and stayed `running` from `2026-08-26T01:16:40Z`.
3. The exact live process chain was packaged backend PID 25044 -> supervisor PID 27804 -> `rg.exe` PID 16452. The command contained both `--hidden` and `--glob *`; after 711 seconds the child still existed, CPU time continued increasing, and the supervisor request had no `settled.json`.
4. ripgrep documents that a command-line glob overrides ignore logic and that `--hidden` includes `.git` unless it is explicitly excluded. The repository's ignored roots include `.git` (about 818 MiB of packs), `node_modules`, `.opencorvus`, and `.claude`.
5. `SearchCodeTool` buffers complete stdout, awaits process exit, then parses and truncates to 100 displayed matches. It sets no wall-clock or output budget. Therefore the display cap does not bound traversal, retained bytes, or Tool lifetime.
6. The prior exclusive-Tool errors and first `ExecutionCapsuleTreeInspectionConflictError` were terminal and recovered. The earlier Windows `glob("*")` aborted-output regression caused a backend restart; this occurrence instead retained a live CPU-consuming `rg.exe`. They are separate incidents.

## Root cause and shared impact

- Direct trigger: a repository-root search supplied `include: "*"`; `SearchCodeTool` translated it to `--glob *` while always enabling `--hidden`.
- Data/control-flow root cause: positive ripgrep globs override repository ignore authority, and the Tool bypasses the existing bounded `Process.runHost/runTask` primitive. Its 100-result limit is applied only after complete process/output settlement.
- Why the old path was insufficient: ordinary narrow searches usually exit quickly, so post-exit truncation looked like a result bound. It is only a presentation bound. Any broad positive include can reopen ignored dependency/runtime/history trees; a low-match or no-match pattern can then run for an unbounded period without reaching the parser.
- Shared scope: primary Chat/Code/Work, Mission, projected Task workers, frontend-design, visual-quality, and context agents all receive the same Tool. Host and Task process ownership, cancellation, concurrent Sessions, and multiple projects share the defect. Scheduler waiting is downstream impact, not the root owner.
- Exclusions: no evidence indicates Provider streaming, Task ingress, Mission wake, Session recovery, database ownership, or Overlay rendering caused this Tool to remain active. The existing process supervisor correctly kept the still-running child owned and observable.

## Implementation plan

1. Keep one argument builder and one result parser in `SearchCodeTool`, but run the exact executable/argv through `Process.runHost` or `Process.runTask` according to the existing execution authority.
2. Give the Tool a finite wall-clock budget and combined stdout/stderr byte budget. Propagate caller cancellation, wait for the shared process primitive to terminate and settle the owned tree, and expose a typed `SearchCodeExecutionError` for infrastructure/limit failures.
3. Stop passing positive `include` patterns to content search. For an included directory search, first use bounded `rg --files` enumeration under normal ignore rules and an explicit recursive Git-metadata exclusion, apply `minimatch` to that candidate list, then search exact candidates in Windows-safe argument batches. Enumeration and all batches share one wall-clock deadline and one retained-output budget. An explicitly targeted non-Git ignored file remains searchable through `path`; there is no fallback scan.
4. Retain positive result semantics: parse Windows and POSIX line endings, sort retained matches by modification time, return exact counts when the bounded command completes, display at most 100 matches, and preserve the existing inaccessible-path advisory for exit code 2 with usable matches.
5. Add focused non-UI contracts using the real Tool path: a broad `include: "*"` returns only the visible fixture while ignored and Git metadata fixtures remain outside the result count; narrow basename and directory includes filter candidates before a greater-than-budget non-candidate can emit content; a bounded-output supervisor fixture preserves the `search-code` owner, terminates, settles with a typed Tool execution error, and restores the live process count.
6. Run the focused search/process contracts, backend typecheck, Prettier, docs checks, and diff checks. Do not run UI automation tests.
7. Obtain independent read-only review of the complete diff and evidence, repair every valid finding, rerun affected checks, update this record, create a scoped commit, merge current upstream without rebase, inspect the entire outgoing set, and push normally.

## Verification and risk boundary

- Included directory searches enumerate ignored-aware candidates before content search. Candidate enumeration and all Windows-safe content batches consume one deadline and retained-output budget, so neither a large file list nor many match batches can run or buffer indefinitely.
- A repository that cannot complete within the search budget receives a typed error and must narrow `path` or `pattern`; it does not silently return partial matches as complete.
- Explicit paths remain authoritative for ordinary ignored artifacts. Git metadata is a deliberate exception: directory searches always exclude `.git` content, including when `.git` is the directory target. An ordinary repository-root include cannot accidentally widen into runtime, dependency, or Git metadata.
- The live packaged occurrence predates this source repair and will not adopt it until a later authorized runtime replacement. This implementation does not claim that the already-running Task was recovered.

## Completion record

Implemented:

- `SearchCodeTool` now uses the shared `Process.runHost/runTask` production primitive with caller cancellation, a 30-second shared hard wall-clock, a 2 MiB shared combined stdout/stderr budget, process-tree termination, output draining, and supervisor settlement.
- `Process.RunOptions` now preserves the stable supervisor owner; every search enumeration/content process is owned by `search-code` for diagnostic attribution and ownership observability. Cleanup remains bound to the owned handle or Task identity.
- Positive `include` patterns are compiled once with bounded brace/globstar expansion and applied to the bounded, ignored-aware file enumeration; they are never passed to content search. Exact candidate files are searched in argument-size-safe batches under the same deadline/output budget. Ripgrep retains repository ignore authority and receives an explicit recursive Git-metadata exclusion.
- Limit, launch, settlement, and fatal ripgrep failures surface as `SearchCodeExecutionError` with code `SEARCH_CODE_EXECUTION_FAILED`; caller cancellation remains the caller's abort error.
- The Tool description now states the ignore-boundary and bounded-retry contract.

Verification completed before the first independent review:

- `bun script/run-tests.ts test/tool/search-code-bounded-execution.test.ts`: 2 passed. The broad-include contract executed through Task authority and returned exactly the one visible match; the over-budget fixture terminated once, settled, returned the typed error, and restored the supervisor live-handle count.
- `bun script/run-tests.ts test/conversation-tool-execution-authority.test.ts`: 2 passed, including the real Conversation/Host `search_code` execution path.
- `bun run typecheck`: passed with exit code 0.
- `bun script/run-tests.ts test/work-artifact/qualification.test.ts`: the directly relevant `process runner enforces wall-clock and combined output limits independently of activity` contract passed. The whole file was not green: an unrelated canonical Work Artifact SVG revalidation test timed out and reported its own missing Windows supervisor settlement marker; 14 passed, 1 failed, 1 unhandled error.
- `bun run docs:check`: blocked by pre-existing, unrelated Session command/shell route edits in the dirty worktree. Regeneration would change only the API rows for `messageID` and `PublicSessionPromptIdentityConflictError`; those generated files are outside this task and were not modified.
- `git diff --check` on task-owned tracked paths: passed.

First independent read-only review:

- Six findings were accepted: force-add the ignored record; acknowledge the concurrent mixed/early commit without rewriting history; preserve `search-code` owner metadata; filter candidates before content output; add narrow and directory include contracts; document `.git` directory exclusion precisely.
- While review was in progress, another actor committed and pushed the first implementation together with unrelated CLI/Session/SDK changes as `3485ce44e`, followed by additional commits through `107ed86f7`. This task did not create, reset, rebase, force-push, or otherwise rewrite those commits. The review repairs and missing record will be delivered in a new scoped commit.

Verification after review repairs:

- `bun script/run-tests.ts test/tool/search-code-bounded-execution.test.ts`: 3 passed. In addition to the original broad-include and settlement contracts, basename and directory include calls completed against a visible non-candidate whose raw matches exceeded the entire Tool output budget.
- `bun script/run-tests.ts test/conversation-tool-execution-authority.test.ts`: 2 passed, including real Conversation/Host search execution after candidate batching and owner propagation.
- `bun run typecheck`: passed with exit code 0.
- `bun run docs:check`: passed, 332 operations across 25 groups.
- Prettier check over every task-owned code/test/spec/index file and `git diff --check`: passed.

Second independent read-only review and repairs:

- Five findings were accepted: compile one bounded matcher instead of one per candidate; preserve fatal regex validation when include selects no candidates; continue from file-enumeration exit code 2 when stdout contains usable candidates and propagate the inaccessible-path advisory; add real multi-batch/shared-output-budget evidence; correct owner wording to diagnostic attribution only.
- Include candidate filtering now checks caller cancellation and the shared wall deadline while iterating the file list. Empty candidate sets validate the regex through ripgrep on bounded empty standard input before returning a zero-result contract.
- A controlled partial-enumeration fixture produces more than 30,000 candidate argument characters, proves multiple content batches remain below the 12,000-character application bound, preserves owner and settlement for every batch, and returns the positive inaccessible-path advisory.
- A second controlled fixture consumes the retained-output budget across enumeration and the first content batch, then proves the next batch terminates and returns the typed execution error instead of receiving a fresh per-process budget.
- `bun script/run-tests.ts test/tool/search-code-bounded-execution.test.ts`: 6 passed, including invalid-regex/no-candidate and both multi-batch contracts.
- Post-repair Prettier and `git diff --check`: passed.
- The post-repair full typecheck is currently blocked only by an unrelated concurrent `src/tool/skill-market.ts` discriminated-metadata typing error. The post-repair docs check is currently blocked only by concurrently added `/global/skill/market/detail`, `/install`, and `/search` routes whose generated API rows have not yet been committed. This task did not modify those sources or their generated closure.

Third independent read-only review and repairs:

- Two findings were accepted: minimatch's built-in brace/globstar caps silently truncate instead of throwing, and a partial file enumeration could still lose its incompleteness fact when include/content filtering produced zero matches.
- Include compilation now rejects patterns longer than 4,096 characters, more than 256 brace expansions, or more than 32 globstar path segments before constructing the one matcher. Extended globs are disabled to avoid minimatch's silent nested-extglob fallback; supported brace/globstar patterns retain complete semantics.
- Partial enumeration stderr is retained. Partial enumeration plus zero included candidates or zero content matches now returns `SearchCodeExecutionError`, while partial enumeration plus usable matches still returns those matches with the inaccessible-path advisory.
- `bun script/run-tests.ts test/tool/search-code-bounded-execution.test.ts`: 8 passed. New contracts cover all three include complexity boundaries and both partial-enumeration zero-result branches.

Final independent read-only review:

- The only fourth-round finding was a false-positive partial-zero test fixture whose fake handle did not expose standard input. The fixture now exposes writable standard input and both error/cause messages must contain the persisted `enumeration incomplete` fact. The focused suite remains 8 passed.
- The follow-up reviewer reported no unresolved findings and authorized the scoped corrective commit boundary: `grep.ts`, `grep.txt`, `util/process.ts`, the focused test, and this force-added record only. Current README and all Skill Market/Session/UI diffs belong to concurrent work and are excluded.

Pending scoped corrective commit, upstream convergence, outgoing-commit audit, and push. The live packaged occurrence still predates this source repair and was not stopped or restarted.
