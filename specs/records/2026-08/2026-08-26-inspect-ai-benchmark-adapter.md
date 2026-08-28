# Inspect AI Benchmark Platform And OpenCorvus Adapter

## Recall

| Item | Record |
| --- | --- |
| User requirement | “帮我基于 inpsect ai 搭建一个给 opencorvus benchmark 的平台，为 opencorvus 加一层简单的 adapter”。`inpsect ai` is interpreted as the UK AI Security Institute's Inspect AI project. |
| Acceptance | A locally installable Inspect AI extension can load an ordinary JSON/JSONL dataset, submit every sample through the real OpenCorvus public Task API, wait for the durable Task terminal projection, place the canonical completion text and trace identifiers into the Inspect sample log, score at least the positive Task-completed contract, and run from the Inspect command line without an Inspect-side model. |
| Hard constraints | Preserve the existing OpenCorvus Task/Session/Agent/Artifact authorities; no benchmark-only scheduler, hidden message, direct database mutation, Provider credential copy, service restart, task cancellation on adapter timeout, non-streaming Large Language Model path, or user interface automation. The adapter must use explicit project and server identity and must not create a Git repository unless the operator explicitly opts in. |
| Repository sources read | `AGENTS.md`; `CODEBASE_STRUCTURE.md`; `specs/current/architecture/01-agents.md`, `02-data.md`, and `03-control.md`; bilingual `packages/web/src/content/docs/**/operations/benchmark.mdx`; `packages/opencorvus/src/server/server.ts`; `server/routes/orchestrator.ts`; `engine/model.ts`; `status/task-status-snapshot.ts`; `conversation/view.ts`; generated JavaScript Software Development Kit task types; root and package manifests. |
| Whole-repository search | Searches covered `benchmark`, `eval`, `adapter`, `task.create`, `/task/:taskID/status`, `/task/:taskID/conversation`, Task terminal and Completion Decision fields, project-directory routing, server authentication, existing external-agent benchmark code, Python manifests, and package/test/documentation indexes. The current delivery branch contains no Inspect AI integration or Python benchmark package. The separate AutomationBench worktree is an experiment-specific harness and is not modified or imported as a second authority. |
| External sources read | Inspect AI 0.3.259 official task, solver, scorer, dataset, model-free evaluation, component-extension, Agent Bridge, and Model API documentation; PyPI release metadata; installed 0.3.259 runtime signatures for `Task`, `TaskState`, `ModelOutput.from_content`, `@solver`, and standard scorers. |
| Independent agent feedback | None before implementation. The required post-implementation reviewer will be recorded below. |

## Decision

Implement a separate Python distribution under `packages/inspect-benchmark` and register it as an Inspect AI extension. Its adapter is an Inspect custom solver, not an Inspect `ModelAPI` and not an Agent Bridge.

That placement is deliberate:

- Inspect owns dataset loading, sample concurrency, retries, scoring, logs, and the log viewer.
- OpenCorvus owns model selection, streaming Large Language Model calls, Agent collaboration, tools, Task lifecycle, persistence, and terminal acceptance.
- The adapter owns only translation between one Inspect `TaskState` and one public OpenCorvus Task plus terminal-result projection back into the same Inspect sample.

An Inspect custom model provider would benchmark a single generation boundary and bypass the Agent system the user asked to measure. Inspect's Agent Bridge routes a third-party agent's native model calls through Inspect's current model; it is also the inverse of this requirement because OpenCorvus already owns its Provider and runtime. A custom solver is Inspect's documented extension point for an arbitrary agent scaffold or external system.

## Current Observable State

1. The repository documents real benchmark topology but has no reusable Inspect package.
2. `POST /task` is the canonical public Task ingress. It requires a project `directory`, accepts an optional exact `model` and `promptProfile`, and returns HTTP 202 with `task_id`, `project_id`, and the resolved directory.
3. `GET /task/:taskID/status` exposes normalized activity plus the durable `lifecycleStatus` union `active | completed | failed | cancelled`.
4. `GET /task/:taskID` exposes the terminal reason, error, package revision binding, and canonical Completion Decision. For completed Tasks, `completionDecision.orchestratorMessageID` names the exact visible assistant Message that accepted delivery.
5. `GET /task/:taskID/conversation` exposes the persisted conversation transcript. Text extraction can therefore bind to the exact Completion Decision message instead of guessing from the last string or an Agent self-report.
6. Project-scoped routes require `?directory=` or `x-opencorvus-directory`. `POST /task` defaults `init-git=true`, so a benchmark adapter must explicitly send `init-git=false` unless the operator opts in.
7. Server Basic Authentication is optional and configured through existing server environment values. Adapter credentials must remain process-only and must never enter Task metadata or Inspect logs.

## Root And Control Flow Analysis

There is no defect to patch in the OpenCorvus runtime. The missing capability is an integration boundary:

```text
Inspect Sample
  -> OpenCorvus Inspect solver
  -> POST /task?directory=...&init-git=false
  -> existing Task ingress / Orchestrator / Agents / tools / persistence
  -> timed GET /task/:id/status snapshots
  -> GET /task/:id + GET /task/:id/conversation
  -> exact Completion Decision Message text
  -> Inspect ModelOutput + assistant Message + sample metadata
  -> Inspect scorer / log / viewer
```

The old paths do not solve this general integration:

- The retired historical Mission benchmark wrappers and the current AutomationBench experimental branch bind one benchmark's world, restricted shell, evidence leases, and Provider projection. Reusing them would turn a generic platform into an AutomationBench-specific second orchestration system.
- The web documentation's metric examples report manually supplied measurements; they do not execute an Inspect dataset.
- The plugin metric hook observes values but does not create or settle real Tasks.
- A raw script could call the API, but it would duplicate Inspect's dataset, concurrency, retry, logging, and scoring responsibilities.

## Adapter Contract

### Configuration

The solver accepts explicit arguments and equivalent environment defaults:

| Field | Environment | Default | Contract |
| --- | --- | --- | --- |
| `base_url` | `OPENCORVUS_INSPECT_BASE_URL` | `http://127.0.0.1:7878` | HTTP(S) OpenCorvus server root. |
| `project_dir` | `OPENCORVUS_INSPECT_PROJECT_DIR` | none | Required exact benchmark project directory. |
| `model` | `OPENCORVUS_INSPECT_MODEL` | none | Optional exact OpenCorvus `provider/model`; omission uses normal project resolution. |
| `prompt_profile` | `OPENCORVUS_INSPECT_PROMPT_PROFILE` | none | Optional exact installed Expert Squad selection. |
| `product_pillar` | `OPENCORVUS_INSPECT_PRODUCT_PILLAR` | `code` | Existing `code | work` Task contract. |
| `timeout` | `OPENCORVUS_INSPECT_TIMEOUT_SECONDS` | `1800` | Maximum end-to-end adapter observation time beginning before Task creation. It does not cancel the product Task. |
| `poll_interval` | `OPENCORVUS_INSPECT_POLL_SECONDS` | `2` | Timed public status snapshot cadence. |
| `init_git` | `OPENCORVUS_INSPECT_INIT_GIT` | `false` | Explicit opt-in to OpenCorvus project initialization. |

Existing `OPENCORVUS_SERVER_USERNAME` and `OPENCORVUS_SERVER_PASSWORD` values provide optional Basic Authentication. The password is read only while constructing the HTTP client and is excluded from result objects, exceptions, metadata, and documentation examples.

### Input mapping

- `TaskState.input_text` becomes `CreateTaskInput.request` without prompt rewriting.
- `TaskState.uuid` produces one stable `requestID` for the sample attempt so request replay is idempotent inside the selected project.
- `sample_id`, `sample_uuid`, and epoch enter bounded Task metadata for trace correlation.
- The adapter sets `source=inspect-ai` and a concise title. It does not synthesize Goal, workflow, Agent, tool, attachment, Artifact, or acceptance state.

### Terminal mapping

- `active` remains observable only and is never reported as success.
- `completed`, `failed`, and `cancelled` are terminal.
- A completed Task must expose a Completion Decision and its exact `orchestratorMessageID`; the adapter reads that Message's visible text Parts from the public conversation payload.
- A failed or cancelled Task returns its truthful final visible assistant text when present, otherwise the durable Task error/terminal reason. The lifecycle scorer remains incorrect.
- Adapter metadata records the Task, Project, request, package revision, lifecycle, terminal reason, error, Completion Decision locator, and final Message identity. It does not copy transcript reasoning, tool bodies, credentials, or database rows.

### Timeout and interruption

- Network/protocol errors raise typed adapter errors containing method, path, HTTP status, and OpenCorvus request ID where available.
- The observation deadline begins before `POST /task`; Task creation receives
  the remaining budget and is bounded by that wall-clock duration rather than
  relying only on per-network-stage timeouts. The public route may await the
  control plane's first owner turn before returning its durable receipt. After
  acceptance, deadline exhaustion raises a typed timeout containing the Task ID
  and last lifecycle snapshot. Pre-acceptance deadline exhaustion remains a
  typed API observation failure because no Task receipt is yet available to the
  adapter.
- Timeout, Inspect cancellation, or process interruption never calls the OpenCorvus cancellation or deletion route. The product Task remains owned by OpenCorvus and can be inspected or cancelled explicitly by its operator.

## Package And Files

```text
packages/inspect-benchmark/
  pyproject.toml
  README.md
  src/opencorvus_inspect/
    __init__.py
    _registry.py
    adapter.py
    examples/smoke.jsonl
    py.typed
    scorer.py
    solver.py
    task.py
  tests/
    test_adapter.py
    test_inspect_eval.py
    test_solver.py
    test_task.py
```

The package pins the validated Inspect AI release family and exposes an `inspect_ai` entry point so the CLI discovers the Task, solver, and scorer without repository path tricks.

## Verification Matrix

| Layer | Positive proof |
| --- | --- |
| Request mapping | A Sample produces one Task request with exact prompt, directory, source, model/profile options, trace metadata, idempotent request ID, and explicit Git-init choice. |
| Terminal client | Timed status reads settle a completed Task, then retrieve the exact Task and conversation projections. |
| Completion extraction | The Completion Decision's `orchestratorMessageID` resolves to its visible assistant text, even when a later unrelated message exists. |
| Inspect solver | The solver appends one real assistant Message, sets `ModelOutput`, preserves trace metadata, and marks the sample completed. |
| Scorer | A durable completed Task with a Completion Decision produces the positive score and metrics. |
| Packaging | Editable installation succeeds; Inspect lists the registered Task/solver/scorer; `inspect eval ... --model none` loads the smoke dataset. |
| Real API | An operator-provided or isolated local OpenCorvus service receives the actual public Task request and exposes its terminal/result routes. A contract-only HTTP transport test is supporting evidence, not this row's proof. |
| Repository | Python tests, formatter/linter/type checker, `docs:check`, route check where generated contracts are untouched, and `git diff --check` pass. |

The smoke dataset proves wiring only. It is not a product-quality benchmark and its score must never be presented as OpenCorvus capability evidence.

## Delivery And Risk

- The package is outside the Bun runtime and does not change OpenCorvus route schemas, generated Software Development Kit output, application startup, database schema, or user interface.
- Inspect can run samples concurrently. Operators must size `--max-connections` against OpenCorvus and Provider limits; the adapter adds no hidden global queue.
- `project_dir` identifies mutable benchmark state. Repeated samples can interfere if the dataset shares mutable files. Benchmark authors must provide isolated projects/sandboxes or deliberately accept shared-state semantics.
- This delivery does not start a Provider-credentialed benchmark. A later real quality run needs explicit model, credential, data, project, concurrency, and cleanup authorization.
- The current branch already contains one user-existing ahead commit (`a88f8e7e8`). It is outside this implementation. Before push, the complete `upstream..HEAD` set must be classified and satisfy the repository's review/verification rule; the adapter change will not rewrite or absorb it.

## Implementation Progress

- [x] Repository/API/Inspect research complete.
- [x] Adapter boundary and contracts frozen before source changes.
- [x] Python package implemented.
- [x] Focused contract and packaging checks pass.
- [x] Real Provider-backed public-API run explicitly remains outside this delivery: no Provider credential/model execution was authorized. The public route contract is covered by the adapter transport test; full Inspect execution is covered with the same solver and a deterministic client replacement, and neither is presented as real OpenCorvus Task quality evidence.
- [x] Independent post-implementation review complete with no unresolved findings.
- [x] Scoped commit contents isolated; final commit identity and push disposition are recorded in the delivery handoff.

## Validation Evidence

- `ruff format --check .` — 11 Python files already formatted.
- `ruff check .` — all checks passed.
- `mypy` — strict mode found no issues in ten source and test files.
- `python -m pytest -q` — six tests passed: public request/terminal mapping, exact Completion Decision Message selection, hanging-status deadline, terminal-projection deadline, solver state projection, and a complete Inspect eval/log/two-scorer run.
- `inspect eval opencorvus_inspect/opencorvus_benchmark ... --model none --limit 0` — the installed extension resolved by package registry name, loaded the packaged smoke JSON Lines dataset, and completed a zero-sample CLI wiring run. Inspect 0.3.259 emitted its Windows control-surface `socket.AF_UNIX` warning and explicitly continued without that optional surface; the eval itself succeeded.
- `pip wheel --no-deps .` — rebuilt `opencorvus_inspect-0.1.0-py3-none-any.whl` after review repair; archive inspection confirmed `inspect_ai` entry-point metadata, `py.typed`, and `opencorvus_inspect/examples/smoke.jsonl`.
- `bun run docs:check` — 332 operations across 25 groups clean.
- `bun run api:routes-check` passed before unrelated concurrent route edits entered the shared worktree and passed again in the final pre-push hook. One intermediate rerun correctly reported those unstaged edits before their generated OpenAPI closure existed; this package does not modify a route or generated Software Development Kit file, and those concurrent paths are excluded from its commits.
- The normal pre-push hook passed Software Development Kit imports, Artificial Intelligence runtime compatibility, Expert Squad types, eight Turbo typecheck tasks, route inventory, documentation generation, control-lease ownership, and the tracked-source secret scan before updating the upstream branch.
- Prettier checks for the touched Markdown files and `git diff --check` passed.

No OpenCorvus service was started, stopped, restarted, or written through during validation. No Provider credential was read, copied, logged, or used.

## Review Record

The first independent read-only review found one P2: the configured observation timeout bounded polling intervals but not a hanging status request or the terminal Task/Conversation projection. The adapter now creates one post-acceptance deadline, applies its remaining budget to every status and terminal-projection request, and maps deadline exhaustion to `OpenCorvusTaskTimeout` with the accepted Task ID and last observed lifecycle. Parameterized tests cover both previously unbounded stages. No reviewer modified implementation files.

The second independent read-only review confirmed the shared deadline coverage, then found one Python 3.10 compatibility P2: `asyncio.wait_for` raises `asyncio.TimeoutError` on the package's minimum supported Python, while the initial repair caught only the built-in alias used by Python 3.11 and newer. The handler now catches `asyncio.TimeoutError`, which is valid across the supported versions.

The final independent read-only review found no unresolved P0-P3 issues. It confirmed the shared post-acceptance deadline across status and terminal projections, Python 3.10+ timeout mapping, external cancellation propagation, absence of product Task cancel/delete calls, focused timeout coverage, and the honest boundary that deterministic HTTP/Inspect tests are not a Provider-backed OpenCorvus end-to-end run.
