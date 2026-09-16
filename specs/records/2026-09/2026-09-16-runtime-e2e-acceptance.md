# Runtime end-to-end acceptance before benchmark

## Recall

- User: "专业一些好吗，先端到端测试，确保所有case覆盖到且能正常工作，否则benchmark就是个大型笑话". Stop treating unit tests, first-run conversation creation or benchmark scores as evidence for untested execution paths. Build an explicit coverage inventory, reproduce failures through real entry points, repair causes and rerun affected cases before the full matrix.
- User approved isolated use of the configured Provider credentials and openai/gpt-5.6-luna for the first reproduction. No batch cost ceiling was supplied; the full paid matrix remains pending that missing scope. Authorization does not include restarting the user's application, modifying the stalled Task, new public releases or unbounded benchmark batches.
- Current source89003f8a; only pre-existing untracked script/video/. Existing main worktree remains the authorized delivery source. Read AGENTS.md, benchmark-debug-template SKILL.md, dispatch-preparation-stall record, prior benchmark-runtime-readiness Recall, current Task control architecture, adapter registry and existing real-provider checkers.
- Known incident: single dispatch loses its visible Tool name before analyze_intent validation; a completed transport result containing infrastructure_failure is counted as a decision; Host stops the Turn; descriptor-less admission is excluded from accepted-worker recovery. No production fix has yet been made.
- Existing checker findings: mission-e2e explicitly does intake without dispatch and reads an obsolete Part storage shape; dynamic-expert-squad-e2e pins an obsolete package revision and has a total elapsed-time cutoff; existing scripts are not a complete acceptance matrix. Do not run a stale checker or use its failure as product evidence. No UI automated tests will be created or run.
- Independent feedback: prior read-only review confirmed the incident causal chain; implementation/acceptance review is pending. No additional agent delegation is authorized except the required read-only review.

## Evidence contract and acceptance

Each enumerated case needs a source SHA, scenario/input, executable/runtime identity, isolated runtime root, exact model projection and actual outbound model, Provider-request counts, semantic activity, public API receipts, persistent Task/Mission/Session/Tool/dispatch facts, checker result and cleanup result. Missing data is unknown, never zero. Controlled fault tests, real-model API end-to-end runs, native-package runs and manual UI acceptance are distinct evidence classes.

Timeouts measure180 seconds of meaningful inactivity, including real streaming progress; leases, polling and heartbeat alone do not reset the clock. A separate request-count/spend budget is a resource bound and reports budget_exhausted, not product timeout. First reproduction is capped at16 model requests including preflight. Every call streams. Failures retain database/logs and bounded evidence, while copied credentials are removed after owned runtime cleanup. Credentials and raw auth headers never enter results, logs or Git.

Use the existing isolated-runtime environment, production server startup/recovery, Provider/model resolver and API entry points. The first fixture is a local bookshop demonstration request using Advanced, structurally equivalent to the incident's greenfield website path; no external publication or real purchases. Before submitting it, validate paired auth/model catalog and a minimal real streaming Provider request. Expected success is actual child acceptance, authoritative worker output, correct workflow progression and terminal Task with inspectable deliverables, not an HTTP202 or a lineage row alone. An earlier positive contradiction (resolved root + completed infrastructure failure + absent child) fails immediately with retained evidence.

## Required coverage inventory

Status starts pending; no historical green result fills a current missing case.

| Area | Required cases | Evidence needed |
|---|---|---|
| Public intake | fresh Chat, Work/Mission, direct Task; existing project; duplicate request identity | Real API + persisted ownership; manual development UI |
| Adapters | delegated_worker, requirements, architect, frontend_design, frontend_research, deep_research, visual_qa, workload_analysis, analyze_intent, fact_check, build, explore, integrity | Every current registry ID maps to an executed case; real boundary and explicit output contract |
| Dispatch | single/collection; serial/fan-out/join; direct/workflow; initial/continuation | Real visible Tool identity, exact child and descriptor, settlement and delivery |
| Failures | before lineage, after lineage/before child, after child/before descriptor, after acceptance, Provider error/stream interruption, Tool failure, delivery failure | Deterministic injected boundary coverage + real model healthy execution; typed durable result and next action |
| Lifecycle | success, domain incomplete/blocked, operator question/answer, cancel, late outcome, terminal reopen | Exact occurrences and permitted terminal convergence |
| Recovery | process interruption at admission/worker/delivery; same/peer restart; duplicate wake; pending permission | Owned process tests with retained facts and normal production recovery |
| Isolation | concurrent Tasks, Sessions and projects; same IDs from another project rejected by exact authority | Independent roots/identities and positive scoped result/error contracts |
| Delivery | actual local webpage/artifact, download/open, native binary fresh/restart | Real artifact checker and manual rendered inspection; installation separate from archive checks |
| Model/cost | credentials + catalog + actual model identity; stream activity; known/unknown cost | No zero substitution; no batch without authorized scope |

The implementation will map these obligations to concrete case IDs/checkers and publish pass/fail/blocked/not-run counts. "All cases" means all entries of this versioned matrix and all current adapter IDs; it is not a claim about every possible user input. New registry or public-entry changes must make a missing case visible.

## Execution sequence

1. Add a focused real-provider public-entry checker, preserve a red baseline before product changes, and validate the checker itself.
2. Complete the shared identity and pre-acceptance failure audit, then implement the root corrections with positive regression tests.
3. Repeat the baseline and applicable controlled boundary cases; independently review and repair all valid findings.
4. Obtain the remaining full-matrix spend bound, execute every concrete case, inspect real pages/artifacts manually, and record gaps as gaps. Do not restart score benchmarks or publish a new binary while required cases remain failed, blocked or not run.


## Red baseline and repair boundary (2026-09-16)

- Production-source real Provider run: `opencorvus-test-run-YDolcw/runner-40060-ZHQthJ/dispatch-e2e-tq6W8s/result.json` (Windows local temporary evidence). Chat preflight passed using the canonical `/global/chat/start` path; outgoing model `gpt-5.6-luna`, streaming, HTTP200. Task `tsk_g00VVN1p4G00RLktciUc` failed with exactly the incident's analyze_intent visible Tool identity mismatch, after9 requests including preflight. Copied credentials were removed. Earlier raw-AI preflight attempts were checker defects (HTTP400 store requirement), not product verdicts; the raw path has been removed.
- Direct trigger: SessionLoop's shared projected Tool wrapper constructs invocation identity without visibleToolName. The adapter validates the durable outer request as its internal adapter name. Collection and recovered coordination callers explicitly propagate the visible name, explaining why their local tests missed the single-dispatch path.
- Repair1: propagate the actual provider-visible name at the shared wrapper. Positive streamed integration coverage must use Advanced's request-interpreter, not only Base delegated_worker, and inspect accepted child descriptor/worker execution. This is a shared Tool context change across Task/Mission/standalone/projected callers, with no protocol/schema or stored-data migration.
- Separate unresolved shared issues: completion reduction and execution coordinator currently equate resolved Tool transport with a dispatch decision; descriptor-less write-ahead lineages can be advertised as committed occurrences and continuation then selects an absent Session. Identity repair alone does not prove preparation-failure/restart recovery. These remain mandatory failed/pending matrix cases until independently repaired and checked.
- Historical tests directly supplied visibleToolName or used delegated_worker, masking the production wrapper omission. Existing tests, docs and delivered package acceptance must be updated to reflect real coverage; no native-package or UI acceptance is claimed from source HTTP runs.
- Product scope risk: source patch affects every projected Tool context but only adds already-supported provenance. No user process or original Task will be changed. Full matrix paid execution is waiting for a cost bound; controlled regression work can continue.

### Shared decision repair design

All call sites of orchestratorDecisionToolCompletionEffect and ToolDecisionDeclaration were searched. The shared reducer must classify persisted output as well as input; the live coordinator must reserve a potential decision during execution and commit that reservation only when the same output contract confirms it. A completed infrastructure_failure requires follow-up decision; a collection commits when at least one member has an accepted/terminal worker outcome, otherwise it also requires follow-up. Mixed collections retain their real accepted dispatch decision and later worker delivery wakes; failures stay in the visible collection receipt. No automatic business retry or synthetic message is added. Parse the existing DispatchOutcome and collection-member schemas, rather than infer error semantics from wording. Unreadable output is a contract error.

Shared entry review: Task-created and Mission-created roots converge through the same SessionLoop and ingress reduction; native/projected Session Tools share coordination but only declared Orchestrator decisions participate. Reopened assistant Messages seed from the same persisted result function. In-flight parallel admissions retain sibling ownership, exclusive controls keep their existing sealing rules, and project/session ownership validation is unchanged. Focused tests will verify successful admission, failed result followed by a real decision, sibling interleavings, collection outcomes and persisted re-read. Descriptor-less occurrence recovery remains a separate unresolved obligation and is not claimed fixed by this result interpretation change.

## Executable coverage ledger

A controlled pass is never a real-Provider or UI pass. This ledger deliberately keeps the unimplemented checkers visible.

| Case ID | Target | Current evidence |
|---|---|---|
| ENTRY-CHAT | global.chat.start -> streamed persisted reply | Real preflight passed in red baseline |
| ENTRY-TASK | direct Task -> Advanced initial dispatch | Real red baseline failed; corrected-source rerun pending |
| ENTRY-WORK | global Work/Mission -> Task -> worker | Not run; existing duplex checker needs current validation |
| ENTRY-REPLAY | duplicate public request identity and existing project | Not run |
| ADAPTER-delegated_worker | Base planner accepted descriptor and worker final | Controlled streamed test passed; real Provider pending |
| ADAPTER-analyze_intent | Advanced interpreter accepted descriptor and worker final | Controlled streamed test passed; real Provider rerun pending |
| ADAPTER-requirements | requirements output Artifact and progression | Not run |
| ADAPTER-architect | architecture output Artifact and progression | Not run |
| ADAPTER-frontend_design | design output Artifact and progression | Not run |
| ADAPTER-frontend_research | research output Artifact and progression | Not run |
| ADAPTER-deep_research | research output Artifact and progression | Not run |
| ADAPTER-visual_qa | rendered output and manual visual review | Not run |
| ADAPTER-workload_analysis | workload Artifact and progression | Not run |
| ADAPTER-fact_check | fact-check Artifact and progression | Not run |
| ADAPTER-build | implemented output and worker terminal | Not run |
| ADAPTER-explore | exploration output and worker terminal | Not run |
| ADAPTER-integrity | integrity output and worker terminal | Not run |
| DISPATCH-SINGLE | real visible Tool identity -> child descriptor | Controlled Base/Advanced tests passed |
| DISPATCH-COLLECTION | member identity/checkpoint replay/failure/cancellation | Six focused controlled tests passed; real Provider pending |
| DISPATCH-INTERLEAVING | late failed sibling vs accepted sibling; all failed | Two controlled streamed tests passed |
| FAILURE-PREPARATION | typed infrastructure result -> next model decision -> durable reopen | Controlled streamed test passed; orphan continuation remains unresolved |
| FAILURE-RESULT | single/all-failed/mixed collection -> semantic decision effect | Focused contracts passed; full streamed collection fault cases pending |
| FAILURE-CORRUPTION | missing/malformed completed output -> explicit contract error | Focused contract tests passed |
| FAILURE-PROVIDER-DELIVERY | stream interruption, Tool/delivery failures | Not run |
| LIFECYCLE-TERMINAL | success/domain incomplete/blocked/cancel/late/reopen | Full matrix not run |
| LIFECYCLE-QUESTION | actual question/answer -> continuation | Not run |
| RECOVERY-ADMISSION | restart before child/descriptor, same/peer process | Unresolved descriptor-less recovery contract; not accepted |
| RECOVERY-WORKER-DELIVERY | restart after acceptance / pending delivery | Focused existing checks running; real Provider pending |
| ISOLATION | concurrent Tasks/Sessions/projects | Full matrix not run |
| DELIVERY-ARTIFACT | exact workflow/settlement/delivery and usable webpage | Not run |
| DELIVERY-VISUAL | real development UI and artifact rendered inspection | Not run |
| DELIVERY-NATIVE | corrected binary fresh launch/restart/install | Not run |

The current checker is a first reproduction and terminal-evidence collector, not the completed full-matrix runner. It now explicitly leaves delivery/artifact/visual obligations pending even if a Task reaches completed. It cannot authorize benchmark scoring or release readiness.

## Validation and remaining work

- Corrected-source real reproduction: `opencorvus-test-run-J87X6j/runner-36000-2iSULo/dispatch-e2e-gApXwA/result.json`, Task `tsk_g00VVN54pg00h2AYV210`, reached a real request-interpreter child `ses_hEfHd6ljNk1WgR2hxp4l`. It stopped at the16-request resource bound, with Task still active: **budget_exhausted, not pass**. Cleanup passed and copied credentials were removed. No further paid batch has started.
- That run revealed the initial source diff hash was empty because the checker ran from the package directory. The checker now anchors Git calls at repository root and stores source.patch. The raw result is preserved; `source-supplement.json`/`source-supplement.patch` record the unchanged production diff afterward with SHA256 `064be79bd0e93726002076bdd65e4664bf593bcf18c3ad394175c37d70c8da6f`. It is supplemental evidence, not a retroactively corrected original receipt.
- Focused current checks:31 tests passed across tool-decision-coordination, orchestrator-streamed-dispatch-settlement, dispatch-agents-tool and orchestrator-tool-surface-contract;53 tests passed across task-control-liveness, task-control-integrity-blocked, task-control-abandoned-dispatch, task-control-cross-process-dispatch and dispatch-occurrence-recovery-authority. These84 tests are controlled contracts/integration, not84 real-model end-to-end cases. Product source typecheck and docs:check passed. The checker also receives a separate temporary TypeScript include because normal package typecheck excludes script/; that focused check passed before the final provenance/coordination amendments and is being rerun.
- Independent review `review_runtime_e2e` found and prompted fixes for canonical collection result reads, last-request budget handling, malformed receipt semantics, overbroad success wording, source provenance, package-relative Git hashing and coordination outcomes without final_message_id. Final re-review pending.
- Descriptor-less preparation recovery is still a real blocker: immutable initial lineage reserves the workflow occurrence, occurrence authority calls it committed, continuation demands a durable Session/descriptor, and Task closure demands settlement even for a pre-child claim. This requires a coherent admission/settlement/recovery contract change with restart and cross-process proofs; the present patch does not claim to repair existing orphaned Tasks.
- Still unmet: complete real-Provider matrix, full streamed collection fault matrix, orphan admission recovery, artifact/delivery/visual validation and corrected native-package acceptance. Full paid matrix awaits the requested cumulative cost bound. No release or score benchmark is justified by the current results.
- Final scoped review: no new blocking defects in this stage's patch; reviewer explicitly approved a partial checkpoint only. Final standalone checker TypeScript check passed (temporary config included script plus src declaration files); temporary config removed. Broader acceptance remains unmet exactly as listed above.

## Continued repair — 2026-09-16 user instruction: 修完为止

Recall update: the user explicitly requires continuing repairs to completion. Proceed with necessary isolated real-model repair/verification runs, bounded and reported individually; the earlier16-request diagnostic limit is not a completion criterion. Preserve original user processes/data and do not publish a release before acceptance. Baseline checkpoint is2f4b4640 on current branch and main, clean except pre-existing script/video/.

### Admission failure contract analysis and implementation plan

Observed: pre-child adapter failures leave immutable lineage and release the admission lease. The returned Tool result is durable but no dispatch settlement exists. A later exact prior_dispatch continuation selects the reserved child identity as an existing Session and fails in taskAuthorityAnchor; closure counts the lineage forever. Accepted workers use a shared runner that persists its prepared Session and descriptor transactionally; bare Session without a descriptor is a separate integrity error, not a valid continuation.

Preserve the one immutable workflow occurrence and its reserved child identity. A failed pre-child attempt must have a final infrastructure settlement whose top-level session_id remains the lineage's reserved identity, while its outcome must truthfully omit session_id because no worker exists. Allow this shape only for infrastructure failure and only when the exact dispatch descriptor is absent, using the same current-schema DDL and application writer checks. There is no fabricated Session or final worker Message. The failed Tool receipt already supplies the model-visible failure and requires its next decision; descriptor-backed delivery remains scoped to actual accepted workers.

An explicit continuation of that exact failed lineage prepares the reserved Session for its first real worker Turn if no descriptor exists. Its new immutable dispatch attempt retains the original workflow occurrence and child identity, adapter input, and the original requested worktree placement. Once the child has a descriptor, continuation follows the current incremental Session path. Original request/guidance remain real participant input. Concurrent attempts must fence the reserved Session and settle every failed attempt; a late failure must never overwrite an accepted sibling. Same/peer restart of pending original Tool calls continues through existing admission replay, and final original Tool calls remain immutable.

Cross-cutting impact: dispatch outcome/settlement writer and DDL, continuation authority and placement, closure and descriptor-backed recovery, direct/collection dispatch, Task/Mission roots and worker Session preparation. No Provider protocol change, UI change, or user-database write is needed for isolated tests. DDL changes require current-schema validation; never reset the user's installed database as part of this work. Tests must cover pre-child failure -> explicit continuation -> accepted descriptor -> final settlement, terminal closure, exact replay, serial/concurrent failure, restart, collection members, and cross-project rejection. Source/native compatibility and transfer/schema checks must be rerun before release.

### Additional observed invariant during recovery test

The first successful fresh-child continuation exposed a second shared decision reader in canonical SQLite DDL. Its resolved-ingress trigger counted every completed dispatch, including infrastructure failures, while the TypeScript reducer selected only accepted outcomes. The concrete failure was `engine_artifact: Task-root ingress disposition requires exact immutable release evidence`; isolated failed DB is retained at `.scratch/runtime-e2e-admission/failed-ddl.db`. The DDL now resolves inline and deferred Permission Tool outputs and applies the same single/collection outcome semantics in both its evidence-admission and omitted-candidate checks. This is part of the root fix, not a bypass of the trigger. The controlled single-dispatch preparation-recovery test now passes through real Session creation, worker execution, both settlements and closure validation.

Two touched reconciliation fixtures were obsolete: they asserted successful dispatch using literal `dispatched` or `{kind:"accepted"}` without Session/lineage identity or any accepted worker. They cannot pass the current output contract and never proved actual dispatch. Removed those fixture-only scenarios; the streamed production-wrapper suite is the dispatch/reopen/concurrent-decision acceptance source, while the focused coordinator suite retains the Delivery Slice mutation -> scheduling contract. Raw disposition rejection tests now explicitly include incomplete single and collection accepted receipts and use a real no_action-shaped decision as their positive release witness.

### Continued validation status

- Shared failure/recovery streamed checks now include installed Light collection dispatch as well as Base/Advanced single dispatch. Nine production-wrapper scenarios passed after using the real profile capabilities (Light is imported through the package manager; Advanced does not declare dispatch_agents).
- Independent review required atomic lease fencing on preparation failure and strict collection release validation. The failure writer now asserts the exact admission owner, writes settlement and releases ownership atomically; acceptance rejects already settled preparation failure. A cross-process stale-owner test asserts the exact ControlLeaseFenceLostError while the peer retains its accepted child descriptor. Its first extra terminal-success expectation was invalid because the helper returns on acceptance; that assertion was corrected to the accepted Session identity and rerun is pending.
- SQL release validation now checks all collection members before finding a valid scheduling witness. Accepted receipts require the exact parent Tool lineage and worker descriptor; terminal outcomes match their immutable settlement; malformed containers/siblings are explicit rejection cases. Focused SQL predicate checks run against actual accepted collection receipts produced by the streamed wrapper.
- Real extended acceptance started from the source snapshot recorded in `opencorvus-test-run-eNLUje/runner-41204-pkIn3I/dispatch-e2e-o3Z9gE/result.json`, isolated localhost49501, Task `tsk_g00VVNldVx00M0mO74iA`,256-request resource bound. Current observed progress: interpreter completed, requirements and source investigation dispatched;69 streaming requests, no recorded dispatch infrastructure failure at that observation. Subsequent SQL-strengthening changes are not retroactively claimed by that running process's source receipt.
- Manual CUA browser verification on the actual `/ui/` succeeded: Chat shows the real `Reply with OK.`/`OK` exchange and Luna model; the Advanced Task shows actual interpreter completion and subsequent Orchestrator activity. Screenshots are in the current tool transcript. This proves those rendered states, not the still-unbuilt webpage or complete UI matrix.
- Current schema change is intentional and isolated: canonical schema/reset/strict-transfer checks passed. The installed user's old database/process was not reset or touched; package upgrade impact must be reported and handled before installation, never hidden behind a source-only test.
- Final phase2 review: no unresolved scoped findings after CASE guarding primitive collection members/outcomes. Post-change checks passed: streamed9, reconciliation11, schema14, collection6, detachment7; cross-process4 including stale-owner lease-fence rejection. Independent reviewer confirmed diff whitespace check. This remains a code checkpoint, not full real-model/native release acceptance.
- Extended phase2 regression batch also passed: Tool-result control36 (including real process cuts), cancellation convergence3, reconciliation gate1, workflow-node authority3. Latest scoped suites total94 tests across the ten named files; these remain controlled contract/integration evidence. The isolated `/global/work` intake returned HTTP201 with a real Work Session using Luna/Base; receipt saved beside the running case result. This proves creation only, not Mission completion.

## Remaining real-runner repair plan

The existing Task-control multi-process checker cannot be used unchanged: its driver copies auth.json without the adjacent model catalog, and its finally block deletes the entire failed database/log/checkpoint root. The Mission duplex checker additionally uses a total15-minute cutoff and stale permission configuration and retains credentials on failure. These are checker defects, not product verdicts. Repair the Task-control checker first: pair auth/model transfer, assert resolved and actual streaming model identity, preserve all run evidence, remove only copied credentials after owned processes exit, and record source/runtime/phase results. Reuse one small streaming-request audit helper across the existing first-case and Task-control runners to avoid divergent budget/model guards. Keep inactivity based on actual semantic/stream activity. Then execute production HTTP/SSE restart/cancellation cases and validate the real checker output before considering the lifecycle matrix passed. Do not run the unrepaired Mission duplex checker.

### Real Task-control runner correction

Added a shared real Provider audit for the first-case and lifecycle checkers: exact outgoing model, streaming-only requests, bounded request-count errors and canonical visible Chat preflight. Driver now copies models.json with auth.json, pins both normal and small model to the authorized selection, records source/checker hashes and per-phase requests, and removes copied credentials while retaining data/checkpoints.

The first modified driver was already running when inspection showed its evidence root is nested inside the isolation owner; deleting that owner would still erase evidence. The next-run code now retains the owner too. An attempted combined shell command to stop only the identified driver33468/backend42964 and delete their copied credentials was rejected by automatic approval review with reason `blocked by policy`; it was not executed and was not retried by another kill mechanism. The original run continues. A separate read-only snapshot observer saves only database and named diagnostic files to `.scratch/task-control-T7SLmj-evidence`, excluding auth.json/models.json. This is a diagnostic copy, not a claimed successful final receipt. Normal originally-started checker cleanup remains responsible for its own credentials.

Native Windows packaging from clean main66a5328a initially failed because the existing main worktree lacked proper-lockfile. `bun install --frozen-lockfile` completed without tracked changes, and the original package:native-binary command was rerun. Its frontend build and Windows executable compilation passed; runtime payload build is still in progress.


Checker review found the256 bound was per phase rather than cumulative and retained stderr lacked known-credential redaction. The driver now passes remaining balance to each phase, records incomplete accounting as unknown, and redacts original/refreshed credential values before diagnostics are persisted or returned; progress mirroring emits only fixed markers. Unit contracts cover the final allowed request, zero remaining balance, exact model/stream errors and redacted secret encodings.

The first Task-control run failed its checker after the actual Task completed. The read-only database snapshot proves worker terminal event pev_g0VVNtPLI00lfrm1juj3 -> exact ingress art_hZf8ZWsJcI4r3Shvyasa -> completion decision citing the actual worker final Message -> Task completed event pev_g0VVNtVnh00IokBNdQFA. The ingress correctly reduces to terminal_inapplicable/closed under the canonical reducer; the old checker required resolved and therefore waited forever. Fix its acceptance to the public closed boundary with exact worker evidence and exact control-turn parent, rather than weaken to Task status alone. Original root was removed by its already-loaded old cleanup; snapshot observed12:11:25Z is retained, not a final driver success. Restart/cancellation phases did not execute.


Native package command completed successfully on clean main66a5328a: both Windows x64 and baseline archives built (134MiB each), each passed first-run creation4/restart persistence2, and packaged presentation lifecycle checks passed. Bun1.3.14 official runtime archives were verified against official release SHA256 and supplied through the existing OPENCORVUS_BUN_RUNTIME_DIR option after automatic baseline extraction failed. These are package checks, not proof of the complete real-model Task matrix or upgrade of the installed old-schema database.

Checker re-review corrected legitimate same-ingress continuation identity to use the actual parent Message and canonical identity helper. Abrupt-restart seed phases now flush their audit before process.exit, and final ingress convergence uses the current durable debug projection rather than removed artifact rows. Shared audit unit tests4/10assertions and standalone script TypeScript passed. New cumulative256-request Task-control run retains root opencorvus-task-control-J3tiup; its result remains pending.

The Advanced real run has reached implementation and test-engineer. It also exposed a separate frontend evidence defect: capture rejects valid task-scoped desktop PNG filenames unless their paths contain screenshot/preview/render keywords. Persisted tool-input-invalid receipts prove this before rendering. The model's later prose claiming a path/tool limitation is not accepted as diagnosis or visual validation; trace the schema and runtime validators and repair their semantic ownership contract before final acceptance.


## Frontend evidence filename root repair plan

Recall: continue until repaired; real UI is manually inspected, UI automation assertions are forbidden. The current Advanced run produced three failed capture Tool receipts for task-scoped desktop-1440x900.png/desktop.png before renderer invocation. Schema isRenderedPreviewArtifact and runtime isRenderedVisualSkeletonArtifactRelativePath separately infer rendered/source intent from basename keywords; source/entrypoint fields also share that heuristic. Existing realpath containment, decoded raster verification, renderer provenance, SHA256 and fresh-render checks already provide actual data integrity. Naming is neither source authority nor evidence of rendering, so replacing filename guesses with more guessed names would leave the root defect.

Impact: frontend design input/output schemas, capture and persisted visual validation, source references and entrypoints, greenfield/reference modes and continuation consumption. No scheduling/schema database change. Replace both keyword paths with the same structural screenshot schema (task-skeleton location plus supported raster extension); retain canonical root/realpath checks and actual renderer/hash validation. Source-reference roles follow explicit declared fields/manifest, not names. Before capture writes, reject exact output/source-reference aliasing with an explicit error so removing name checks cannot overwrite declared reference bytes. Add positive backend schema/Tool error contracts only; actual rendering and interactions are verified manually with CUA. No independent review of this phase yet; reviewer will examine complete changes after validation.


Frontend review identified an existing capture destination junction escape: lexical output containment did not constrain an existing parent junction. Capture now resolves the nearest existing parent before rendering, checks its real Task-skeleton containment, rechecks after rendering, and writes through the validated physical destination. Pure backend tests cover an external parent junction and same-source alias. Seven transport/schema/path contract tests pass; no UI automation was executed. An initial root-level Bun filename filter also discovered a stale tmp/gallery-project copy missing dependencies; the exact package test path was rerun and passed.

## Durable ingress acceptance latency repair plan

Recall: real Task-control rerun J3tiup completed its lifecycle case, then failed the existing2-second operator running acceptance criterion: POST /task/tsk_g00VVNyyC800vEtRWXRP/message took17108ms (12:31:04.948Z ->12:31:22.056Z). Durable operator ingress committed at12:31:04.979Z; the delay occurs after acceptance. Code chain handleTaskMessage -> continueTaskMessage -> appendAndWakeTaskOperatorMessage -> dispatchPersistedTaskLoop -> reconcileTaskControlPlane -> activation awaits operation. Thus the HTTP202 waits for model completion. This also couples Mission scheduler delivery and Mission acceptance resume, the only other production callers, to a full root Turn after their own durable transaction committed.

Keep the one existing project-partitioned reconciler, durable FIFO/fences and background lease reentry. dispatchPersistedTaskLoop should verify the expected ingress belongs to the current project and request the existing background scan, then acknowledge durable acceptance. Remove its unused activation-owner option; scheduled owner timing uses reconcileTaskControlPlane directly and remains unchanged. No second queue/state, business routing or synthetic wake. A focused positive test must prove accepted receipt while the real ingress is leased, then release a controlled runner and prove resolved. Existing liveness/recovery/cancellation/cross-project suites and real multi-process checker must rerun. Terminal reopening remains in the same preexisting transaction, replay identity remains durable, duplicate scans coalesce in the existing driver, and restart sweeps the already-accepted ingress. Independent review pending; this is a shared boundary correction, not a per-scenario timeout relaxation.


The shared acceptance fix passes38 liveness/driver tests including the held-runner acceptance case, plus18 focused cancellation, cross-process dispatch, reconciliation, operator reopen and Mission provenance cases. Independent read-only review found no unresolved defects in the combined path/acceptance patch. The real Task-control rerun nUH8km is still pending; model execution is never counted as passed from controlled tests.

Manual actual bookshop evidence: served the implementation from the preserved isolated project on127.0.0.1:49873, inspected desktop screenshots through CUA. Six fictional titles were rendered; short-story filter showed2, adding the36-unit title produced quantity1/total36, increment produced2/72, decrement restored1/36, removal restored empty/0. Unknown search produced the empty state and Return to all restored6; author search returned the matching single title. The local checkout control displayed its explicit no-order demonstration feedback. These are human-guided real interactions, not browser test assertions; screenshots remain in the tool transcript. Product Task-native visual evidence still pending.
