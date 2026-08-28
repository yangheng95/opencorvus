# Extensible Inspect AI Benchmark Framework

## Recall

| Item | Record |
| --- | --- |
| User requirements | Investigate Apodex's published benchmark framework and technical report, select difficult low-cost benchmarks, decide whether to build or reuse the framework, then “设计方案，先实现这个评测框架，注意要面向未来且可扩展”. |
| Acceptance | The independent `packages/inspect-benchmark` distribution exposes one versioned benchmark registry; loads declared JSON or JSON Lines datasets into ordinary Inspect AI Samples; builds an OpenCorvus-backed Inspect Task from a registered benchmark; supports deterministic sample-ID manifests; executes benchmark-specific model judges through one Inspect-owned judge boundary; records exact benchmark, dataset, scorer, judge, adapter, and source provenance; and ships the first Apodex-derived BrowseComp, FrontierScience Research, and FrontierScience Olympiad definitions with focused positive tests and package validation. |
| Hard constraints | Inspect AI remains the sole evaluation control plane. OpenCorvus remains the sole Provider, Agent, tool, streaming, persistence, and Task-acceptance authority for the system under test. Do not import Apodex's runner, Agent runtime, sandbox, retry lifecycle, result store, or Provider client. Do not copy credentials or run a real Provider benchmark without explicit authorization. A judge failure is unavailable evidence, not zero, fallback scoring, or permission to switch judge model. No User Interface work or automation is in scope. Preserve unrelated dirty-worktree changes. |
| Repository sources read | `AGENTS.md`; `specs/current/architecture/01-agents.md`, `02-data.md`, and `03-control.md`; the existing `2026-08-26-inspect-ai-benchmark-adapter.md`; all source, tests, packaging metadata, and documentation under `packages/inspect-benchmark`; the root package scripts and spec indexes. |
| Whole-repository search | Searches covered `inspect-ai`, registered Tasks/Solvers/Scorers, OpenCorvus Task completion metadata, benchmark/scorer contracts, dataset/scorer IDs, and existing experiment architecture. The only reusable general Inspect integration is `packages/inspect-benchmark`; current benchmark selection is a caller-provided JSON/JSONL path and scoring is hard-coded to `task_completed`, `includes`, or `exact`. No second generic Python benchmark registry exists in the repository. |
| External sources read | Inspect AI 0.3.259 Tasks, Solvers, Scorers, extension components, model-graded scoring, datasets, logs, and model APIs; ApodexAI/FrontierAgent commit `3364b7a51b5b235d6de10f692160980bfb7544e9`, especially `benchmarks/public/core`, the BrowseComp and FrontierScience family modules and judges, `docs/eval.md`, and the Apache-2.0 license; Apodex's public benchmark dataset bundle and technical report. |
| Independent agent feedback | No feedback before implementation. The first post-implementation read-only review found no P0, but found three P1 and five P2 issues: scorer failures were errors instead of unscored observations; string-only judge overrides retained incompatible transport settings; effective system configuration was not frozen; comparability naming ignored effective route and the intentional no-retry policy divergence; catalog scorer references were fail-late; empty targets were admitted; the built-in OpenCorvus suite lacked per-occurrence project isolation; and the wheel omitted the package's MIT text. The second review confirmed all eight repairs and no P0/P1, then found two residual P2 contract gaps: public post-import registration could still create a dangling scorer reference, and arbitrary transport values were copied into provenance. Both are accepted for an atomic/bound registration contract and secret-safe transport metadata, followed by a third independent review. |

## Observable State And Root Analysis

The existing adapter is production-shaped at the system-under-test boundary: one Inspect Sample creates one public OpenCorvus Task, observes the durable lifecycle, and returns the exact Completion Decision Message. Its limitation is above that boundary:

1. `task.py` accepts an arbitrary dataset path and selects one of three string-named generic scorers.
2. Dataset field names, benchmark identity, upstream revision, data license, scorer revision, judge model, threshold, and sample selection are not one declarative object.
3. There is no reusable loader for the standardized Apodex text-family rows (`task_id`, `task_question`, `ground_truth`).
4. There is no deterministic manifest that can select exact IDs independently of source row order.
5. There is no Inspect-native model-judge boundary for rubric or semantic-equivalence benchmarks.
6. The current Task metadata identifies only the OpenCorvus adapter schema, so two runs can silently differ in benchmark/scorer/judge inputs while looking structurally similar.

The direct trigger is the hard-coded `_scorers(name)` branch and ordinary `json_dataset(dataset)` construction. The root cause is not missing OpenCorvus runtime behavior; it is the absence of a benchmark-definition layer between dataset storage and the already-correct OpenCorvus Solver.

Importing Apodex's complete `benchmarks/public` package would not fix that root cleanly. Its registry imports FrontierAgent configuration, its runner owns subprocesses, sandbox profiles, pipeline selection, retries, judge preflight, and result directories, and its judges own a separate OpenAI client. Retaining that control plane beside Inspect would create duplicate lifecycle, configuration, Provider, and result authorities. The reusable semantic assets are narrower: field mappings, exact prompts, parsing rules, thresholds, model pins, and source provenance.

No OpenCorvus route, schema, generated Software Development Kit, database, scheduler, Session occurrence, Mission, or User Interface path is changed. Benchmark sample concurrency continues to enter the existing public Task ingress and therefore does not introduce a new product queue, wake, recovery, or terminal path. Attachments, sandboxes, file benchmarks, and cross-query scorers are explicitly deferred because the first selected suite is text-only.

## Architecture Decision

The benchmark platform has four single-owner layers:

```text
Experiment invocation
  -> Benchmark registry + exact definition revision
  -> Dataset loader + optional exact-ID manifest
  -> Inspect Task
       -> selected system Solver (OpenCorvus now; other systems later)
       -> selected benchmark Scorer
            -> one frozen Inspect judge model when required
  -> Inspect log and metrics with provenance
```

### 1. Inspect AI control plane

Inspect owns Task construction, Samples, epochs, concurrency, scoring execution, logs, re-scoring, and result viewing. The package pins the validated Inspect release. The framework must not reproduce those primitives.

### 2. System adapter

`opencorvus_task` remains the only OpenCorvus adapter. Benchmark definitions cannot select OpenCorvus Agents, tools, lineage, workflow, Provider credentials, or lifecycle behavior through sample metadata. Future systems under test may add their own Solver, but they consume the same registered dataset and scorer.

### 3. Benchmark definition registry

Each immutable definition declares:

- stable benchmark ID and human-readable name;
- definition schema version and scorer revision;
- exact source project, source revision, source path, and code license;
- dataset schema and supported source formats;
- scorer kind and one frozen judge policy when model grading is required;
- public metadata fields that may be copied into Inspect Sample metadata.

Registration fails on duplicate IDs. The global definition registry is bound to the scorer registry and rejects every dangling scorer key, including post-import mutation; new definition/scorer pairs use one public atomic registration operation. Lookup fails closed and lists available IDs. Definitions are immutable values, not mutable global configuration records.

Scorer implementations have a separate unique-key registry. A definition stores only its stable scorer key, so a new dataset revision can reuse one scorer implementation while a scoring-semantic change receives a new scorer revision. Inspect logs receive only serializable benchmark/scorer IDs, never Python callables or runtime objects.

### 4. Data and scorer adapters

The generic loader accepts JSON or JSON Lines, validates every selected row, stringifies structured targets deterministically, rejects duplicate IDs, and preserves only declared metadata. A manifest is a JSON object with a schema version, exact benchmark ID, and unique ordered sample IDs. Selection follows manifest order and fails if an ID is missing, so source reordering cannot change an experiment.

The shared model-judge runner uses the definition's one selected model and generation configuration through Inspect's model API. Every policy must declare its Provider-specific streaming argument; the initial definitions use `openai-api/judge/<model>` with `stream=true`, an explicit frozen `base_url`, and `JUDGE_API_KEY`, keeping judge credentials separate from OpenCorvus Provider configuration while preventing `JUDGE_BASE_URL` from silently changing the route. Runtime arguments and persisted provenance are separate: logs contain transport argument names and a URL digest, never raw argument values, and service URLs with user information, query parameters, or fragments are rejected. The upstream official model name, model-pin match, route-pin match, OpenCorvus execution-policy revision, and intentional upstream retry-policy mismatch are recorded separately. The convenience string override is restricted to the definition's existing Provider/service route; a different transport requires a new full `JudgePolicy` in a separately versioned definition. Empty, failed, or unparsable judge output becomes a provenance-complete Inspect `Score.unscored()` observation and is excluded from metrics rather than silently counted as incorrect. An unsupported streaming argument fails closed. No non-streaming call, alternative model, lower reasoning effort, or exact-match fallback exists.

`opencorvus_suite` resolves the non-secret adapter configuration exactly once and gives the same value to the Solver and provenance metadata. It records model, prompt profile, product pillar, adapter distribution revision, timeout, polling interval, initialization behavior, endpoint digest, project-root digest, and isolation strategy on the Task and each Sample. Its comparable mode requires an explicit model, prompt profile, exact manifest, and `sample_epoch` project isolation. That isolation derives a fresh project directory from Inspect's unique sample occurrence, epoch, and Solver attempt and forces Git initialization, preventing samples, retries, epochs, and concurrent workers from sharing mutable project state. Dataset and manifest files must be outside the agent-readable project root.

## Initial Definitions

All three definitions derive their evaluation semantics from ApodexAI/FrontierAgent commit `3364b7a51b5b235d6de10f692160980bfb7544e9` and use Apache-2.0 attribution. Dataset rights remain owned by the respective upstream datasets and are not implied by the code license.

| ID | Dataset mapping | Scoring contract | Frozen official judge |
| --- | --- | --- | --- |
| `apodex/frontier-science-research@3364b7a` | `task_id`, `task_question`, `ground_truth`; declared `subject` metadata | Apodex FrontierScience rubric prompt; parse final `VERDICT: number`; correct at `>= 7.0`; preserve raw points | Official `openai/gpt-5`; Inspect streaming route `openai-api/judge/gpt-5`; high reasoning effort |
| `apodex/frontier-science-olympiad@3364b7a` | same standard schema; declared `subject` metadata | Apodex equivalence prompt; parse final `VERDICT: CORRECT|INCORRECT` | Official `openai/gpt-5`; Inspect streaming route `openai-api/judge/gpt-5`; high reasoning effort |
| `apodex/browsecomp@3364b7a` | same standard schema; declared `category` metadata | Published BrowseComp judge prompt; parse `correct: yes|no` | Official `gpt-4.1-2025-04-14`; Inspect streaming route `openai-api/judge/gpt-4.1-2025-04-14` |

The registry ID contains a short upstream revision and each definition also stores the full commit. Scorer revisions use an `opencorvus-inspect` revision prefix because successful first-attempt parsing matches Apodex while failure handling intentionally does not reproduce Apodex's retry and reasoning-effort cascade. Therefore these runs can compare answer-quality semantics on scored coverage, but must publish unscored coverage and must not claim complete protocol parity with the Apodex report. Updating an upstream scorer means registering a new definition ID or revision, never mutating historical meaning in place.

## Public API And File Plan

```text
packages/inspect-benchmark/src/opencorvus_inspect/
  benchmark/
    definition.py       # immutable contracts and registry
    dataset.py          # validated JSON/JSONL and manifest loading
    judge.py            # Inspect model judge boundary and typed errors
    scoring.py          # scorer implementation registry + Inspect scorer
    task.py             # registered benchmark + explicit Solver composition
    apodex.py           # attributed definitions, prompts, parsers, scorers
  task.py               # retain generic JSON/JSONL Task; expose suite Task
  _registry.py          # discover new Tasks and Scorers
```

The existing `opencorvus_benchmark` remains the generic low-level entry point. The new `opencorvus_suite` is the canonical OpenCorvus benchmark-family entry point and accepts `benchmark`, `dataset`, optional `manifest`, and explicit judge override. It delegates shared composition to `build_benchmark_task`, which accepts one explicit system Solver, adapter identity, and lifecycle scorers; a future FrontierAgent or other system adapter therefore reuses the same dataset and quality scorer without copying benchmark semantics. There is no compatibility alias or second implementation of the same operation.

## Positive Verification Matrix

| Layer | Required evidence |
| --- | --- |
| Registry | The three exact IDs resolve to immutable definitions with full upstream provenance and stable scorer keys; the separate definition and scorer registries accept new unique entries. |
| Dataset | Valid standardized JSONL becomes ordered Inspect Samples with exact prompt, target, declared metadata, and provenance; an exact-ID manifest deterministically produces its declared order. |
| Parser | Representative valid Apodex judge outputs produce the expected rubric points or binary verdict. |
| Scorer | A deterministic judge transport produces correct Inspect scores, raw rubric metadata, exact judge/scorer provenance, and explicit official-comparability state. |
| Task composition | A registered benchmark produces a model-free OpenCorvus Task with the shared Solver, registered scorer, selected sample set, and complete benchmark metadata. |
| Existing adapter | Existing Task lifecycle, timeout, Completion Decision, generic dataset, packaging, and full Inspect eval tests remain green. |
| Package | Ruff format/lint, strict mypy, pytest, extension discovery, zero-sample CLI load, and wheel construction pass. |
| Repository docs | `specs/README.md`, monthly index, package README, `docs:check`, and `git diff --check` pass. |

No real judge or OpenCorvus Provider call is needed for framework acceptance. A later quality run requires explicit dataset, model, credential, project, concurrency, budget, cleanup, and external-write authorization.

## Delivery Risks

- Inspect model-generation signatures are pinned to 0.3.259 and must be verified against that installed runtime rather than inferred from newer documentation.
- Judge outputs are probabilistic. Parser tests prove the published response contract; they do not prove judge quality. Comparable live runs must freeze model route, configuration, scorer revision, and dataset manifest.
- Apache-2.0 permits adapting Apodex code, but modified files need attribution and license compliance. Third-party dataset licenses require separate audit before redistribution.
- A dataset path may contain ground truth. It must live outside the agent-readable project/sandbox for a comparable run. This framework records provenance but cannot attest operating-system isolation by metadata alone.
- The shared worktree contains unrelated active TypeScript changes. This delivery stages and commits only the Python package and exact spec/index files it owns.

## Implementation Progress

- [x] Repository, architecture, current adapter, Inspect extension, and Apodex fixed-revision analysis complete.
- [x] Architecture and acceptance plan frozen before source edits.
- [x] Extensible definition/scorer registries, dataset, manifest, judge, generic Solver composition, and OpenCorvus suite implemented.
- [x] Initial Apodex-derived definitions, prompts, parsers, provenance, Apache-2.0 attribution, and distributable license files implemented.
- [x] Focused tests and first package/repository checks pass.
- [x] First independent post-implementation review completed; all three P1 and five P2 findings accepted for repair.
- [x] Second independent post-repair review confirmed the first eight repairs and found two residual P2 contract gaps.
- [x] Bound/atomic registry mutation and secret-safe judge transport provenance implemented for the two residual P2 findings.
- [x] Third independent post-repair review found no P0, P1, or P2 issues; the independent agent reran all 27 focused tests and verified the final wheel digest.
- [ ] Scoped commit merged with latest upstream state and pushed.

## Validation Evidence

- `ruff format --check src tests` — 24 Python source/test files formatted.
- `ruff check .` — all selected lint rules passed; the one per-file line-length exception is limited to exact attributed Apodex judge prompt text.
- `mypy src tests` — strict mode found no issues in 24 source/test files.
- `pytest -q -p no:cacheprovider` — 27 focused tests passed, including bound and atomic catalog/scorer registration, secret-safe transport provenance and credential-bearing URL rejection, deterministic manifest order and digests, JSON and structured targets, explicit empty-target permission, three official parser contracts, rubric raw points and provenance, same-transport judge override, cross-transport rejection, frozen streaming route despite `JUDGE_BASE_URL`, typed judge failures, exact resolved system metadata, comparable-mode constraints, sample/epoch/attempt project isolation, OpenCorvus suite composition, and full deterministic Inspect eval for both scored and unscored judge outcomes. The unscored eval remains successful, reports zero scored and one unscored quality observation, and emits NaN accuracy instead of zero.
- `inspect eval opencorvus_inspect/opencorvus_suite ... --model none --limit 0` — the installed 0.2.0 extension loaded the registered BrowseComp suite without a Provider or judge call. Inspect emitted its known Windows `socket.AF_UNIX` control-surface warning and completed the eval successfully without that optional surface.
- A local no-network construction of `openai-api/judge/gpt-4.1-2025-04-14` resolved Inspect's `OpenAICompatibleAPI`, retained the official service model and explicit official URL even with a conflicting `JUDGE_BASE_URL`, and exposed `stream=True`; the production dependency on the matching OpenAI client is declared explicitly.
- `pip wheel --no-deps .` — built `opencorvus_inspect-0.2.0-py3-none-any.whl` with SHA-256 `4cdb19f6a565d44ac4fba9e8cc997d739467ab6586454b5faa32f3c631fe241a`; archive inspection found the benchmark modules, synthetic loader-only sample, `py.typed`, entry point, OpenAI dependency metadata, third-party notice, Apache-2.0 license, and the package's own MIT license.
- The first wheel attempt exposed that setuptools' current license-file schema requires the main `project.license` as an SPDX string. The equivalent MIT declaration now uses `license = "MIT"`; editable installation and wheel construction passed after the metadata repair.
- Inspect's NumPy dependency was constrained only in the development extra to `<2.3`: the installed Python 3.12 runtime otherwise selected newer stubs using Python 3.12-only syntax that strict mypy was asked to parse under the package's supported Python 3.10 target. This repairs the checker environment without weakening checks or changing production dependencies.
- `bun run docs:check` — 338 operations across 25 groups clean in the concurrent worktree.
- `git diff --check` — clean.
- No real OpenCorvus Provider or judge model was called. No dataset answer corpus or credential entered the repository, logs, spec, or wheel.
