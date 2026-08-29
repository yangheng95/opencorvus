# Inspect FrontierScience Research GPT-5.6 Luna smoke

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Benchmark `FrontierScience-Research` through the newly implemented Inspect AI evaluation framework, continuing the prior request to exercise GPT-5.6 Luna rather than the legacy AutomationBench runner. |
| Benchmark identity | `apodex/frontier-science-research@3364b7a`, whose immutable local definition derives its rubric prompt, `VERDICT: number` parser, `>= 7.0` pass threshold, and official `openai/gpt-5` judge pin from ApodexAI/FrontierAgent commit `3364b7a51b5b235d6de10f692160980bfb7544e9`. The current official Apodex dataset archive is a separately hashed operator-managed input and is not silently treated as revision-pinned data. |
| System under test | Exact OpenCorvus model `openai/gpt-5.6-luna`, explicit `base` prompt profile, one official sample, one epoch, one worker, and `sample_epoch` project isolation. Inspect owns dataset selection, concurrency, scoring, and logs; OpenCorvus owns Provider, Agents, tools, streaming, persistence, and Task acceptance. |
| Acceptance | The official encrypted Apodex archive is downloaded outside the repository and its FrontierScience Research JSON Lines file validates against the registered schema. A deterministic one-ID manifest freezes the first source-order sample without exposing its question or rubric. An isolated OpenCorvus runtime copies both Provider authority files, projects the exact model, passes a real exact-model Provider preflight, and runs exactly one Inspect sample to terminal state or the declared observation bound. The frozen judge either scores through its independent authority or returns a provenance-complete unscored observation without fallback. Dataset identity, Task identity, lifecycle, timing, token usage, estimated text-token cost, cleanup, and every evidence boundary are recorded. |
| Hard constraints | Do not resume or mutate AutomationBench or the prior BrowseComp Tasks. Do not expose question, ground truth, rubric, credential, or raw Provider configuration. Do not borrow the OpenCorvus Provider credential as `JUDGE_API_KEY`. Copy `auth.json` and `models.json` together and verify source/target equality without publishing their bytes or digests. Do not use Inspect `eval-retry`, start a second real sample, touch user processes/windows, or read benchmark inputs from the agent project. Preserve unrelated dirty-worktree changes. |
| Materials read | `AGENTS.md`; `specs/current/architecture/01-agents.md`, `02-data.md`, and `03-control.md`; the Inspect adapter and extensible-framework records; the prior BrowseComp Luna smoke; package registry, dataset loader, task builder, adapter, solver, scorer, tests, package metadata, and README; official OpenAI GPT-5.6 Luna model documentation; Apodex's frozen evaluation documentation and current official dataset card/archive instructions. |
| Whole-repository search | `packages/inspect-benchmark` is the sole Inspect-owned framework and already registers the exact FrontierScience Research suite. Its comparable mode requires an explicit system model, prompt profile, manifest, `sample_epoch` isolation, and dataset/manifest paths outside the project root. The current runtime has both `auth.json` and `models.json`; no process, user, or machine `JUDGE_API_KEY` is configured. The two pre-existing worktree modifications are outside this record and remain unstaged. |
| External result boundary | The first-party OpenAI model page documents Luna's model identity, supported reasoning efforts, context, and pricing but does not publish a FrontierScience Research score. Apodex publishes the benchmark, dataset, and its own agent evaluation protocol, but the inspected first-party materials do not publish a formal GPT-5.6 Luna aggregate. Third-party leaderboard values are not used as a comparison baseline. |
| Independent agent feedback | None before execution. After the first verification pass, a previously uninvolved read-only reviewer confirmed the framework/scorer contracts and cost arithmetic, but found that deleting all raw eval/runtime evidence before review prevented independent verification of the reported run; it also required explicit ignored-file staging, mixed-index isolation, and a revision-addressed dataset source. Resolutions and the remaining evidence limitation are recorded below. |

## Analysis and execution plan

- The remaining task is an operational benchmark run, not another framework implementation. The suite, loader, scorer, and OpenCorvus Solver already exist; framework code changes are allowed only if the real run exposes a root defect.
- Use the official password-protected Apodex archive in a unique temporary evidence root. Record archive and full dataset SHA-256, row count, schema fields, selected opaque sample ID, and exact one-ID manifest SHA-256 without printing or committing task content. Selection is the first row in source order, so this is a deterministic smoke and not an unbiased quality estimate.
- Run focused package validation before any paid request. Prepare a clean `HEAD` source snapshot for the OpenCorvus runtime so the run does not consume unrelated working-tree edits; connect that snapshot to the existing dependency installation without creating a branch or Git worktree.
- Prepare a separate canonical `OPENCORVUS_HOME`, copy `auth.json` and `models.json` together, verify byte equality, and validate exact `openai/gpt-5.6-luna` projection before startup. Start one hidden loopback server on a newly allocated port and verify its process/listener identity.
- A real `POST /global/providers/openai/test` for exact `gpt-5.6-luna` is the paid preflight. If it does not return `connected` with the exact Provider/model pair, no benchmark Task is created.
- Execute exactly one comparable Inspect sample with `--model none`, one epoch, one connection, one sample worker, `base` prompt profile, `sample_epoch` isolation, five-second polling, and a 1,800-second end-to-end observation deadline. Inspect logs live outside the repository. No `eval-retry` is permitted.
- The run is bounded by the same 1,800-second observation deadline and by an operator cost guard: inspect isolated usage at timed checkpoints and cancel the exact test-owned Task through `POST /task/:taskID/cancel` if estimated Luna text-token cost reaches USD 0.50 before terminal completion. The cost estimate uses current official Luna rates: USD 0.20/M uncached input, USD 0.02/M cached input, and USD 1.20/M output; the estimate is not invoice evidence and excludes tool fees or any long-context multiplier. Because the product has no benchmark-specific hard spend primitive, timed usage observation plus canonical Task cancellation is the enforceable boundary.
- The frozen FrontierScience judge requires independent `JUDGE_API_KEY` authority and official `openai/gpt-5`. None is configured, so the expected quality observation is unscored. The system Provider credential stays inside OpenCorvus and is never exported to Inspect. Lifecycle and output projection can still be accepted; no accuracy, pass/fail, or official-Luna comparison will be claimed without a real judge score.
- Inspect the resulting eval and product state structurally without reproducing prompts, targets, reasoning, answers, or credentials. Record lifecycle, score coverage, exact model/profile, dataset/manifest identity, Task/request identity, duration, calls/tokens, cost estimate, and any failure's data/control-flow root cause.
- Settle the exact Task if still active, call the isolated service's normal disposal path, verify its process tree and listener exit, delete the copied authority files and temporary question-bearing data, run focused verification and docs checks, obtain mandatory independent read-only review, repair every valid finding, commit only owned files, merge current upstream without rebase, inspect the outgoing commit set, and push.

## Execution evidence

### Official data and frozen selection

- The source repository was official Hugging Face dataset
  `apodex/Deep-Research-Benchmarks`, file
  `deep_research_benchmarks_260607.zip`, retrieved through its documented
  `resolve/main` URL on 2026-08-29. During review, the Hub API resolved `main`
  to commit `b279a0e985dbcba33b415118f388a4521ff5b06b`; the same file at the immutable
  `resolve/b279a0e985dbcba33b415118f388a4521ff5b06b/` URL reported
  `X-Repo-Commit` with that revision, `X-Linked-Size: 1440107`, and
  `X-Linked-ETag` equal to the downloaded archive digest. This locates the
  exact downloaded content even though the initial operator URL used floating
  `main`.
- That official Apodex encrypted archive was 1,440,107 bytes with
  SHA-256
  `ae878efcc620fd19db343edf327fd5b8fc6cb132a4b83c7b694c687fb9ef2c29`.
  The Hugging Face dataset card identifies the bundle as Apache-2.0 while
  warning that per-benchmark upstream rights still apply; no dataset is
  redistributed by this repository.
- Its FrontierScience Research JSON Lines file contained 60 unique rows and
  validated the required `task_id`, `task_question`, and `ground_truth`
  fields. Its SHA-256 was
  `8ec3e559cdd73ab34cbc1ade97afde5d676ab8b376e8ef048fc15c59a9f74559`.
  The deterministic smoke selected only opaque sample ID `0`, the first row
  in source order. The exact one-ID manifest SHA-256 was
  `0847f204152919bcbe7c6fce16da00775b46033ede59a886b2be9a605e75f5e0`.
  No question, rubric, ground truth, answer, or model reasoning is reproduced
  here.
- The registered loader independently resolved one Sample with the same
  dataset and manifest digests. It preserved the frozen suite identity,
  official `openai/gpt-5` judge pin, and `>= 7.0` rubric threshold.

### Isolated runtime and pre-acceptance preparation

- The service ran from a clean archive of product commit
  `fc390c86cb18f4d7ba74b3e763070c7b81ef1361`. The snapshot's relevant
  `packages/opencorvus/src/session/index.ts` Git blob was
  `83da42715bb3b62a649f04a71d8a342ea472c133`, exactly the `HEAD` blob, so the
  unrelated worktree formatting edits did not enter the runtime.
- The isolated canonical home copied both `auth.json` and `models.json`.
  Source and target bytes matched for both files; their bytes and digests are
  intentionally omitted. The copied catalog projected exact model
  `openai/gpt-5.6-luna` as `gpt-5.6-luna`.
- The first clean-snapshot server launch failed before binding because only
  the root dependency directory had been connected while Bun resolved the
  package-local `packages/opencorvus/node_modules`. Connecting that package
  dependency directory repaired the isolated fixture; it did not alter
  product or framework source.
- A real exact-model
  `POST /global/providers/openai/test` then returned `connected` for Provider
  `openai` and model `gpt-5.6-luna`. The preflight consumed one request, 25
  uncached input tokens, and 5 output tokens.
- The first Inspect invocation reached the public Task route but failed before
  Task persistence with HTTP 500. Request
  `7e6431d7-5c3a-4faf-91cb-cf8c15ad2cfa` exposed the root cause: the clean
  snapshot attempted to build the Windows process-supervisor helper under the
  long temporary source path and MSVC returned `LNK1104` while creating an
  intermediate executable. The global Task board remained empty and Provider
  usage remained exactly the one preflight call, so this attempt created no
  duplicate Task or model execution.
- The repository's official
  `packages/opencorvus/script/prepare-test-process-supervisor.ts` built the
  exact source-hash helper `runtime-6ab0dfeec3f4f7eb` at the short repository
  target path. Its 692,224-byte executable was copied byte-for-byte into the
  clean snapshot's expected generated target. The test-owned server then shut
  down through its public `/shutdown` route and restarted successfully with
  the same runtime home. This repaired the local checker fixture rather than
  bypassing product process supervision.

### Successful real Inspect execution

- A fresh `inspect eval` invocation, not `eval-retry`, loaded exactly one
  sample with one epoch, one connection, one sample worker, explicit model
  `openai/gpt-5.6-luna`, explicit `base` prompt profile, comparable mode,
  `sample_epoch` project isolation, five-second polling, and the 1,800-second
  end-to-end deadline. Inspect AI's optional Windows control surface reported
  the known missing `socket.AF_UNIX` warning; evaluation continued normally.
- Inspect created only Task `tsk_g00VTh0qDA00K5YdGugL` for request
  `inspect:foWaS6k6d4cmGGSPtXCBqC`, project
  `prj_hxGe4b7DItkVzybtqujy`, and base package revision. The Task reached
  durable `completed` / terminal reason `completed`; Inspect captured
  Completion Decision Message `msg_hPiZK5C9B7ZzA8IxPxL9`. The projected final
  completion was non-empty at 552 characters. No output body is reproduced.
- The sample ran from `2026-08-29T13:38:49.985760Z` to
  `2026-08-29T14:02:15.508491Z`: 1,405.406 seconds of sample working time.
  The complete CLI run took approximately 23 minutes 32 seconds and exited 0.
- The successful eval log was
  `2026-08-29T13-38-45-00-00_opencorvus-suite_L6AvA5bsJgAGfH2bQw8jLt.eval`,
  25,790 bytes, SHA-256
  `132351be44303cc954f41c2de26966bc9e4a265823cd68bbc53cdd409bfc8061`.
  Structural parsing reported `status=success`, one completed sample of one,
  no sample error, exact benchmark/scorer/source revision, exact system
  model/profile/isolation, and the matching dataset/manifest digests.
- The pre-acceptance failure log was
  `2026-08-29T13-32-59-00-00_opencorvus-suite_9RpFN5K6JN8e3UgkC49Pvg.eval`,
  26,306 bytes, SHA-256
  `15e5c383ed8acfd4342ee08ab42d13f2c64ef76c8039395261426c62e9f76534`.
  Its digest and structural failure facts are retained only as
  failure-boundary evidence and are excluded from the successful benchmark
  result. The raw log was deleted with the temporary evidence root after
  structural inspection.

### Usage and scoring boundary

- The final isolated aggregate was 101 Provider calls, 580,142 uncached input
  tokens, 4,523,520 cached-input tokens, 28,503 output tokens, and 6,639
  reasoning tokens. Subtracting the independently observed preflight gives
  the one real Task 100 calls, 580,117 uncached input tokens, 4,523,520
  cached-input tokens, 28,498 output tokens, and 6,639 reasoning tokens.
- The runtime's local cost field was USD 0 and is not billing evidence. Using
  the current published Luna text-token rates gives an estimated USD
  0.2407024 aggregate and USD 0.2406914 for the Task alone, before any tool fee
  or long-context multiplier. The run remained below the USD 0.50 operator
  cancellation guard.
- `task_completed` returned Inspect value `C` and aggregate accuracy `1.000`,
  proving the real OpenCorvus Task lifecycle and Completion Decision projection
  completed successfully.
- `benchmark_quality` returned `NaN` / unscored with
  `scoring_status=unavailable` and `reason_code=judge_unavailable`. Its
  metadata preserved the exact official model and route pins. The intentional
  no-retry judge execution policy remains protocol-divergent from Apodex and no
  independent `JUDGE_API_KEY` existed, so there is no rubric point value,
  pass/fail verdict, FrontierScience accuracy, or official Luna comparison.

## Result status

The execution owner recorded a successful real framework and system-lifecycle
smoke with an explicitly unavailable quality score. The recorded run exercised
one official FrontierScience Research row, frozen membership, one isolated real
OpenCorvus Task using exact GPT-5.6 Luna, a non-empty terminal answer, and
fail-closed judge coverage. Because the original Apodex protocol requires an
actual `openai/gpt-5` model judge, this is not a complete FrontierScience
Research benchmark result. It does not establish whether the answer earned at
least seven rubric points and must not be reported as `1/1` FrontierScience
quality accuracy. Per the user's stop decision, no model-judge or Provider
rerun will be performed.

The one pre-acceptance infrastructure failure created no Task and no Provider
call. It was repaired with the repository's current process-supervisor build
primitive, after which one fresh invocation completed. No Inspect retry or
second real Task was used.

After the Task and Inspect eval were terminal, the isolated service accepted
`POST /global/dispose` and admitted `/shutdown` occurrence
`cal_g0VTh7YVi00j4eltYNLL`. It settled zero remaining prompt Sessions and Tool
parts, its PID exited, and the loopback listener on port 55491 disappeared.
The temporary dependency junctions were removed first and the exact validated
test root was then deleted, including the official question/ground-truth data,
eval bodies, sample project, isolated database, and copied Provider authority.
The source `auth.json`, source `models.json`, and both original dependency
directories remained present. No user-owned service, process, or window was
stopped.

## Independent review

The uninvolved read-only reviewer confirmed from current source that comparable
mode enforces explicit model, prompt profile, manifest, and `sample_epoch`
isolation; judge unavailability maps to provenance-complete unscored output
without fallback; the frozen rubric parser, `>= 7.0` threshold, and
`openai/gpt-5` judge pin match this record; and the token-cost arithmetic is
correct. The reviewer found no benchmark content or credential disclosure.

The reviewer could not independently verify the reported Task/eval/runtime
facts because the successful eval body, isolated database, project, and
question-bearing data had all been deleted before review. The digests in this
record cannot independently establish the contents of files that no longer
exist. Consequently the Task count, lifecycle, eval status, token receipts,
unscored metadata, and cleanup receipts above are execution-owner reports, not
an independently reproduced evidence closure. Reconstructing an artifact after
deletion would be misleading; a future Provider-backed run must retain a
sanitized, content-free structural evidence artifact through review and delete
only the question, rubric, answer, reasoning, raw Provider configuration, and
credential material.

The dataset provenance finding was resolved by recording the official
repository, filename, retrieval date, immutable Hub revision, and matching Hub
size/ETag above. The delivery finding is resolved at commit time by forcing the
ignored record into a task-only index and staging only this benchmark's two
index entries; the parallel Dynamic Expert Squad entries and all other dirty or
staged files are excluded from this task's commit.

After these revisions, the same uninvolved reviewer reported no new unresolved
P0-P3 findings. The non-recoverable evidence limitation above remains part of
the result rather than being treated as resolved.
