# Inspect BrowseComp GPT-5.6 Luna smoke

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Use the newly implemented benchmark framework to test a benchmark with a formal GPT-5.6 Luna result. The user corrected that this is not the legacy AutomationBench continuation. |
| Benchmark identity | `apodex/browsecomp@3364b7a`, executed through `packages/inspect-benchmark` and Inspect AI 0.3.259. OpenAI publishes BrowseComp as 1,266 difficult browsing problems, reports a formal GPT-5.6 Luna result of 83.3%, and requests that dataset questions and answers not be exposed publicly. That published aggregate is benchmark-selection evidence, not a baseline that a one-row smoke can reproduce. |
| System under test | Exact OpenCorvus model `openai/gpt-5.6-luna`, explicit prompt profile, one sample, one epoch, one worker, and `sample_epoch` project isolation. Inspect remains the evaluation control plane; OpenCorvus remains the Task, Agent, Provider, streaming, tool, persistence, and completion authority. |
| Acceptance | A real official BrowseComp row is loaded from operator-managed data outside the agent-readable project root; an exact one-ID manifest freezes membership; the isolated OpenCorvus service passes exact Provider/model preflight; Inspect creates one real Task and records its terminal Completion Decision; the frozen BrowseComp judge emits a scored observation, or a missing/unavailable independent judge is reported as unscored without fallback. No synthetic row may be reported as benchmark evidence. |
| Hard constraints | Do not resume or mutate the legacy AutomationBench evidence. Do not expose BrowseComp question/answer text, canary values, credentials, or raw Provider configuration. Do not borrow the OpenCorvus Provider credential as `JUDGE_API_KEY`. Copy or bind `auth.json` and `models.json` together if an isolated runtime is prepared. Do not touch user processes or windows. Do not start more than one real sample. Preserve unrelated dirty-worktree changes. |
| Materials read | `AGENTS.md`; `specs/records/2026-08/2026-08-26-inspect-ai-benchmark-adapter.md`; `specs/records/2026-08/2026-08-26-extensible-inspect-benchmark-framework.md`; package README, registry, dataset loader, task builder, OpenCorvus solver, judge boundary, Apodex definition, and focused Inspect eval tests; official OpenAI GPT-5.6 Luna model page, BrowseComp release, and `openai/simple-evals` BrowseComp reference implementation. |
| Whole-repository search | The only new framework is `packages/inspect-benchmark`. Its registered suites are Apodex-revision-pinned BrowseComp, FrontierScience Research, and FrontierScience Olympiad. AutomationBench is not a registered suite in this framework. The local OpenCorvus model catalog contains the exact `openai/gpt-5.6-luna` projection and the installed Provider authority has an OpenAI entry. No official BrowseComp data file or process/user/machine `JUDGE_API_KEY` is currently present. |
| Independent agent feedback | None before execution. The first post-verification read-only review found the ignored new spec, the missing wall-clock bound around Task creation, and incorrect aggregate-call attribution. All three were repaired. The second read-only review found no unresolved P0-P3 issue. The reviewer did not modify files or delegate. |

## Analysis and execution plan

- The observable gap is operational rather than a second framework implementation: the committed suite has only been validated with deterministic transports and zero-sample loading, while a real OpenCorvus-backed benchmark sample has not yet been exercised here.
- The system Provider and judge are separate authorities. An available OpenCorvus OpenAI credential can authorize the system Task only; the BrowseComp quality result remains unscored unless an independent `JUDGE_API_KEY` is configured for the frozen `gpt-4.1-2025-04-14` judge route.
- Prepare a package-local ignored Python virtual environment and run focused package checks before any paid request.
- Download the official encrypted BrowseComp CSV to a temporary operator-only directory, verify source identity, decrypt locally with the official algorithm, transform without logging content, and create a one-ID manifest. Dataset and manifest remain outside the isolated sample project.
- Prepare an isolated OpenCorvus home and project root in a temporary directory. Bind or copy the current `auth.json` and `models.json` together without printing contents. Start a new hidden loopback-only server on a free port; do not restart or stop any user-owned runtime.
- Preflight the exact Provider/model projection and service/project identity. If it fails, do not create an Inspect sample.
- Run exactly one BrowseComp sample through `opencorvus_suite` with comparable mode, explicit model/profile, `sample_epoch` isolation, and one worker. Preserve Inspect logs outside the repository. A missing judge key is expected to produce a provenance-complete unscored quality observation; it must not become zero or trigger a fallback.
- Inspect the log structurally without printing the prompt, answer, target, reasoning, credentials, or raw message bodies. Record run status, lifecycle score, quality scoring status, model/profile, dataset/manifest digests, Task identity, timing, usage when safely available, and the exact unverified boundary.
- Stop only the isolated server created by this run, retain the evidence needed for review, run focused verification and documentation checks, obtain independent read-only review, then commit only this record and its two index entries and push through the repository-required upstream merge flow.

## Execution evidence

### Frozen input and isolated authority

- The official encrypted BrowseComp CSV contained 1,266 rows. Its SHA-256 was
  `7b24471cd5b3eb2a46830a14802b5c029ea62f488ff75a0f88af7923d1454abf`.
- The one-row transformed JSONL SHA-256 was
  `f1e6eecf349039ff75b49bcea3da8c83a73bcedfae2d07a512cbf71e61defb37`;
  the exact one-ID manifest SHA-256 was
  `1a00ff24f26eae80496fdd53608cc7ca4f77af6ffc64bd47d49b40d220295a41`.
  The public record identifies the row only as `browsecomp-0788`; it does not
  reproduce the problem, answer, or canary.
- The isolated runtime copied both Provider authority files. Source and target
  digests matched for each file. The copied content and digests are deliberately
  absent from this record.
- The isolated model catalog projected exact model
  `openai/gpt-5.6-luna`. A real
  `POST /global/providers/openai/test` preflight returned `connected` for that
  exact Provider/model pair before the benchmark Task was created.
- No process, user, or machine `JUDGE_API_KEY` or `OPENAI_API_KEY` was present.
  The system Provider credential was not copied into the independent judge
  boundary. Therefore this smoke can establish execution/lifecycle evidence but
  cannot produce a BrowseComp quality score.

### First real Inspect execution and observed failure

- Inspect AI 0.3.259 loaded the registered
  `apodex/browsecomp@3364b7a` suite in comparable mode with one sample, one
  epoch, one connection, `sample_epoch` isolation, the `base` prompt profile,
  and exact system model `openai/gpt-5.6-luna`.
- Inspect wrote
  `2026-08-27T16-30-46-00-00_opencorvus-suite_c2t6Qs94RVc56wKyfXaHFK.eval`
  under the temporary evidence root. The sample errored after approximately 30
  seconds with an unavailable `POST /task` observation.
- OpenCorvus had nevertheless durably created real Task
  `tsk_g00VTW171500NIogz8Cb` for request
  `inspect:NWQhGZog5fxbWEuyanBM4J` and continued its real Luna execution. This
  separates the observable Inspect failure from Provider, model projection,
  dataset loading, or Task persistence failures.

### Root cause and framework repair

- `OpenCorvusClient` used one hard-coded HTTPX 30-second request timeout for
  every public API call. The OpenCorvus `POST /task` route persists the Task and
  then awaits the control plane's owner first pass before returning its durable
  receipt. A real Provider/tool turn may validly exceed 30 seconds, so the
  adapter lost observation of a Task that the product still owned.
- The adapter now starts one configured end-to-end deadline before Task
  creation, wall-clock bounds `POST /task` with the remaining duration in
  addition to HTTPX's per-network-stage timeouts, and carries the same deadline
  through terminal polling and final Task/conversation projection. The focused
  positive tests capture the actual HTTPX read timeout and verify that a
  delayed creation request maps to the typed pre-acceptance API observation
  failure at the wall-clock deadline.
- Focused verification after the repair: 28 Pytest tests passed; Ruff check and
  format check passed; strict MyPy passed. Root `bun run docs:check` passed with
  337 operations in 25 groups.

### Retry incident and evidence boundary

- A direct `inspect eval-retry` attempt with an absolute Windows log path failed
  before network access because Inspect converted the drive path into a
  Unix-shaped path. Retrying from the log directory opened the prior eval but
  generated a new sample UUID and therefore a second OpenCorvus request and
  Task, `tsk_g00VTW39BA00LpL5q8f5`.
- This violated the planned one-real-Task bound. The duplicate was immediately
  excluded from benchmark evidence and cancelled through the canonical public
  Task cancellation API with `surface=api`; it reached durable `cancelled` and
  the retry process exited normally. The original Task was not cancelled.
- Inspect's `eval-retry` is therefore not a same-occurrence recovery primitive
  for this adapter. The repaired in-process end-to-end deadline is the root fix
  for the observed 30-second split. A future explicit cross-process resume
  feature would require a stable operator run identity rather than Inspect's
  per-attempt sample UUID; it is not silently inferred here.

## Result status

The framework exercised official data, exact Luna system identity, a real
OpenCorvus Task, streaming Provider/tool execution, persistence, and canonical
cancellation. The original Task remained active beyond the configured
900-second observation budget. After the failure and repair evidence had been
captured, the operator cancelled it through the same public Task API to stop an
unbounded paid run; it reached durable `cancelled`. The final isolated usage
snapshot covered 146 Provider calls, 690,535 uncached input tokens, 8,259,584
cached-input tokens, 25,338 output tokens, and 5,520 reasoning tokens. Its
local cost field was `$0`, so it is not treated as billing evidence. This is an
isolated-runtime aggregate: the original Task accounts for 128 calls, the
excluded duplicate for 17, and Provider preflight for one. Applying the
published Luna text-token rates gives approximately `$0.34` in aggregate
(`$0.30` original Task and `$0.032` duplicate Task, rounded) before any
per-request long-context multiplier or tool fee.

This is a valid negative smoke result, not a model-quality result:

- dataset loading, suite composition, exact model preflight, real Task
  creation, persistence, and sustained Luna/tool execution worked;
- Inspect lost the original Task receipt at 30 seconds because of the adapter
  request-timeout defect;
- the framework defect is repaired and deterministic verification is green;
- after the excluded duplicate was cancelled, no third paid Provider-backed
  run was started; the repaired framework therefore does not yet have a clean
  Provider-backed rerun, because the two Tasks had already consumed 145 calls
  and the independent judge authority was absent;
- no BrowseComp accuracy number or official-result comparison is claimed.

After both test-owned Tasks were terminal, the isolated service accepted
`POST /global/dispose`. Its verified Bun parent/child process pair exited and
the loopback listener on port 55404 disappeared. No user-owned runtime or
window was stopped or restarted. The two copied Provider authority files were
then removed from the temporary runtime and their absence was verified; the
source authority was not modified.

## Independent review

The first uninvolved read-only review found three valid issues: the new record
needed explicit inclusion despite the repository's ignored `specs/` default;
HTTPX's network-stage timeout alone did not prove the documented wall-clock
deadline; and the isolated usage aggregate had been attributed entirely to the
original Task despite including the duplicate and preflight. The owned diff,
tests, and record were corrected accordingly.

The second read-only review confirmed the wall-clock creation bound and typed
error mapping, the positive delayed-creation test, the corrected call/cost
provenance, explicit staged inclusion of this record, and the absence of
question, answer, canary, credential, or Provider-configuration leakage. It
reported no unresolved P0-P3 finding. Neither review modified repository files
or delegated further.
