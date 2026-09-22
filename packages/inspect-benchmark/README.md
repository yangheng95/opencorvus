# OpenCorvus Inspect benchmark

This package connects [Inspect AI](https://inspect.aisi.org.uk/) to the real
OpenCorvus Task lifecycle. Inspect owns datasets, sample concurrency, scoring,
logs, and the log viewer. OpenCorvus continues to own Provider selection,
streaming model calls, Agents, tools, persistence, and terminal acceptance.

It has three benchmark entry points:

- `opencorvus_benchmark` loads an ordinary JSON or JSON Lines dataset with a
  generic completion scorer.
- `opencorvus_suite` resolves a versioned benchmark definition, validates its
  declared dataset schema and optional exact-ID manifest, and runs its frozen
  quality scorer alongside the durable Task-completed scorer.
- `opencorvus_automationbench` runs an exact official AutomationBench case manifest
  with a fresh simulated world, project, and API-only expert squad per occurrence.

The integration is an Inspect solver rather than a model provider. One Inspect
sample creates one OpenCorvus Task through `POST /task`, observes its public
status snapshots, and resolves the completed Task's exact Completion Decision
Tool summary from the exact public Session Part endpoint, binding Session, Message,
Tool Part and call identities. Free-text narration is not required.

## Install

From this directory, create a Python environment and install the package:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"  # Windows
```

On macOS or Linux, use `.venv/bin/python` instead.

## Prepare OpenCorvus

Start an isolated OpenCorvus service yourself. The adapter never starts,
restarts, or stops it and never copies Provider credentials.

```bash
opencorvus serve --hostname 127.0.0.1 --port 7878 --project-dir /absolute/benchmark/project
```

Configure the benchmark process with the exact service and project identity:

```bash
export OPENCORVUS_INSPECT_BASE_URL=http://127.0.0.1:7878
export OPENCORVUS_INSPECT_PROJECT_DIR=/absolute/benchmark/project
export OPENCORVUS_INSPECT_MODEL=provider/model
export OPENCORVUS_INSPECT_PROMPT_PROFILE=base
```

PowerShell equivalents:

```powershell
$env:OPENCORVUS_INSPECT_BASE_URL = "http://127.0.0.1:7878"
$env:OPENCORVUS_INSPECT_PROJECT_DIR = "D:\bench\project"
$env:OPENCORVUS_INSPECT_MODEL = "provider/model"
$env:OPENCORVUS_INSPECT_PROMPT_PROFILE = "base"
```

If the OpenCorvus server uses Basic Authentication, the adapter reads the
existing `OPENCORVUS_SERVER_USERNAME` and `OPENCORVUS_SERVER_PASSWORD`
environment values. It does not put either value into the Task or Inspect log.

## Dataset

Inspect's ordinary JSON or JSON Lines format is supported:

```json
{ "id": "smoke-1", "input": "Return the exact token OPENCORVUS_INSPECT_OK.", "target": "OPENCORVUS_INSPECT_OK" }
```

The adapter forwards `input` unchanged as the Task request. Optional sample
metadata does not gain control over Task lineage, tools, workflows, or
attachments. A string `opencorvus_title` metadata field may customize the Task
title.

## Versioned benchmark suites

The initial catalog contains these definitions, derived from
ApodexAI/FrontierAgent commit
`3364b7a51b5b235d6de10f692160980bfb7544e9`:

- `apodex/frontier-science-research@3364b7a`
- `apodex/frontier-science-olympiad@3364b7a`
- `apodex/browsecomp@3364b7a`

They expect the standardized text-family fields `task_id`, `task_question`,
and `ground_truth`. Declared `subject` and `category` values are retained as
sample metadata when present. Dataset files and third-party licenses remain
operator-managed and are not bundled with this package.

Run a registered suite with an exact dataset path:

```bash
inspect eval opencorvus_inspect/opencorvus_suite \
  -T benchmark=apodex/frontier-science-research@3364b7a \
  -T dataset=/absolute/FrontierScience-Research/standardized_data.jsonl \
  -T project_dir=/absolute/benchmark/project \
  --model none
```

An optional manifest freezes sample membership and order independently of the
source file's row order:

```json
{
  "schema_version": 1,
  "benchmark": "apodex/frontier-science-research@3364b7a",
  "sample_ids": ["physics-01", "chemistry-04", "biology-09"]
}
```

Pass it as `-T manifest=/absolute/hard-15.json`. The Inspect Task and every
Sample record the dataset digest, manifest digest, benchmark/scorer revision,
upstream source revision, selected judge model, model-pin match, route-pin
match, and scorer execution-policy revision. The Task and Samples also record
the resolved non-secret OpenCorvus model, prompt profile, product pillar,
timeouts, endpoint/project digests, and isolation strategy.

The suite judge runs through Inspect's model API. `-T judge_model=...` is an
explicit experimental override restricted to the same
`openai-api/judge/...` transport. A different Provider or service requires a
new versioned definition with a complete `JudgePolicy`; the framework never
switches models or scoring methods automatically. Empty, failed, or
unparsable judge output is retained as Inspect's unscored value and excluded
from metrics, not counted as zero and not replaced by exact matching.

Official Apodex judge models use Inspect's OpenAI-compatible streaming route
`openai-api/judge/<model>` with `stream=true`, a frozen explicit service URL,
and `JUDGE_API_KEY`. The explicit URL prevents `JUDGE_BASE_URL` from silently
changing an existing definition. Judge credentials are therefore not borrowed
from the OpenCorvus Provider configuration.

The scorer prompt, parser, threshold, token ceiling, and official model pins
derive from Apodex, but OpenCorvus intentionally fails closed without Apodex's
request retries, BrowseComp judge retries, or reasoning-effort cascade. This
policy has its own `opencorvus-inspect` scorer revision. Scored coverage can be
compared using the same grading semantics; complete protocol parity with the
Apodex report must not be claimed, and unscored coverage must be published.

For a comparable OpenCorvus run, make all effective system choices explicit,
freeze the sample set, and enable per-sample-occurrence project isolation:

```bash
inspect eval opencorvus_inspect/opencorvus_suite \
  -T benchmark=apodex/browsecomp@3364b7a \
  -T dataset=/absolute/data/browsecomp.jsonl \
  -T manifest=/absolute/manifests/hard-15.json \
  -T project_dir=/absolute/run-project-root \
  -T model=provider/model \
  -T prompt_profile=benchmark-v1 \
  -T project_isolation=sample_epoch \
  -T comparable=true \
  --model none
```

Comparable mode rejects an implicit model or prompt profile, a missing
manifest, shared project state, and dataset/manifest paths inside the
agent-readable project root. `sample_epoch` derives a distinct project from
the Inspect sample occurrence, epoch, and Solver attempt and forces Git
initialization.

## Run

The default scorer checks the durable OpenCorvus completion contract:

```bash
inspect eval opencorvus_inspect/opencorvus_benchmark \
  -T dataset=src/opencorvus_inspect/examples/smoke.jsonl \
  --model none
```

To also compare the final accepted Message with each sample target:

```bash
inspect eval opencorvus_inspect/opencorvus_benchmark \
  -T dataset=src/opencorvus_inspect/examples/smoke.jsonl \
  -T scorer=includes \
  --model none
```

Supported scorer modes are `task_completed`, `includes`, and `exact`. The last
two always retain the Task-completed scorer as a separate result.

Task arguments override environment defaults:

```bash
inspect eval opencorvus_inspect/opencorvus_benchmark \
  -T dataset=/absolute/cases.jsonl \
  -T base_url=http://127.0.0.1:7878 \
  -T project_dir=/absolute/benchmark/project \
  -T model=provider/model \
  -T prompt_profile=advanced \
  -T timeout_seconds=3600 \
  -T poll_seconds=5 \
  --model none
```

`init_git` defaults to `false`; the selected directory must already be a Git
repository. Set `-T init_git=true` only when creating and initializing the
directory is an intentional part of the run.

The adapter records `task_id`, `project_id`, request identity, lifecycle,
terminal reason, exact completion Message identity, package revision binding,
and Completion Decision locator under `opencorvus_result` in Inspect sample
metadata. It does not copy reasoning, Tool bodies, credentials, or database
rows.

## Reuse the solver

Existing Inspect tasks can select the registered solver directly:

```bash
inspect eval your_eval.py \
  --solver opencorvus_inspect/opencorvus_task \
  -S project_dir=/absolute/benchmark/project \
  --model none
```

## Operational boundaries

- Adapter timeout stops observing the sample; it does not cancel or delete the
  still-owned OpenCorvus Task.
- `timeout_seconds` is an inactivity window. Changes in durable Task/Session
  execution facts or real transcript content renew it. Successful polling,
  observation timestamps and an unchanged running flag do not. Task acceptance
  and final projection each have a separate bounded window; network operations
  also retain stage timeouts. Timeout is an observation error, not a business zero.
- `poll_seconds` must be smaller than `timeout_seconds`. The observer reads the
  latest unfinished assistant Message in each Session through its canonical
  endpoint, so persisted reasoning activity counts even when display projections
  omit it. Reasoning is observed for activity only and is not logged as result text.
- Inspect sample concurrency is real OpenCorvus/Provider concurrency. Set
  Inspect's connection limit to a value the service and Provider can sustain.
- `project_isolation=shared` implies shared mutable state and is never accepted
  by comparable mode. Use `sample_epoch` for concurrent samples, retries, or
  multiple epochs.
- Every solver attempt gets a fresh request identity. `sample_epoch` also creates
  a fresh project occurrence, including after Inspect retries or resumes an evaluation.
- `src/opencorvus_inspect/examples/smoke.jsonl` proves adapter wiring only. Its result is not a
  capability benchmark.
- A real quality run requires explicit dataset, model, Provider credential,
  concurrency, project, and cleanup authorization.
- Comparable benchmark data and ground truth must remain outside the
  system-under-test's readable project or sandbox. Recorded provenance cannot
  by itself prove operating-system isolation.

## AutomationBench

Use Python 3.13 or newer and install `.[dev,automation]`. The optional extra pins
the official Zapier source to commit `4a8e1061254004d9dac807054eed33fad7d1ff14`
(version 1.0.6), MCP 1.30.0, Uvicorn 0.53.0 and JSON5 0.12.1 for squad JSONC manifests.
Installation identity is checked
against the immutable source revision; mutable source-tree hashes are not used
as acceptance criteria. Official world models, APIs and rubric functions remain
the sole owners of business semantics.

From this package directory, run the model-free local checker:

```powershell
.venv/Scripts/python -m inspect_ai eval opencorvus_inspect/automationbench_local_check --model none --ctl-server false --max-samples 3 --log-dir logs/local-check
```

The three independent scenarios use the official `finance.wave_freelance_invoice`
case: zero, one and two billed clients yield `(strict, partial)` of `(0, 0)`,
`(0, 0.5)` and `(1, 1)`. All three `checker_contract` checks must pass. This runs
actual loopback MCP requests, official mutations, scoring and snapshot restoration;
it does not call a model or execute the expert squad. Its aggregate business score
is not a model capability result. On Windows, `--ctl-server false` disables Inspect's
optional Unix-only control endpoint; evaluation and normal Inspect log viewing work.

After separately authorizing a Provider run and starting a co-located isolated
OpenCorvus service, run the actual squad:

```powershell
.venv/Scripts/python -m inspect_ai eval opencorvus_inspect/opencorvus_automationbench --model none --ctl-server false --max-samples 1 -T manifest=src/opencorvus_inspect/examples/automationbench-smoke.json -T squad=../../expert-squads/builtin/automationbench -T project_dir=D:/bench/inspect-projects -T model=provider/model -T base_url=http://127.0.0.1:7878 -T timeout_seconds=300 --log-dir logs/automationbench
```

The manifest contains exact case identities across finance, sales and marketing.
It controls membership and order; no case is silently substituted. Each sample
installs the canonical squad into its fresh project configuration and exposes
only the official `api_search`, `api_fetch` and `base64_encode` business tools
through its own MCP endpoint. MCP query/body objects are serialized to the
official API's JSON-string parameters. The executor handles mutations and the
verifier independently checks records and receipts. The host adds no workflow
state machine or case-specific routing.

The single project config is `.opencorvus/opencorvus.jsonc`. Squad bytes are frozen
when the solver is constructed, so editing its source while an evaluation runs
does not silently change subsequent samples. The loaded official rubric must use
strict assertions (`AUTOMATIONBENCH_STRICT_ASSERTIONS=1`, upstream's default);
disabling them is an explicit configuration/scoring error. Every run records the
`official-strict-assertions-v1` policy. Checker exceptions are never business zeroes.

To verify the Python-generated project with the actual product configuration
loader, squad resolver and live official MCP service, run this additional local
check from the repository root (it does not invoke a model):

```powershell
$env:OPENCORVUS_INSPECT_TEST_PYTHON = (Resolve-Path packages/inspect-benchmark/.venv/Scripts/python.exe).Path
cd packages/opencorvus
bun test test/automationbench-project-admission.test.ts test/automationbench-expert-squad.test.ts
```

The cross-language test requires that explicitly selected Python environment and
is skipped in ordinary Bun-only unit runs. Benchmark acceptance must enable it.

Inspect logs record the exact request/project occurrence, Task terminal evidence,
squad version, ordered tool inputs and outputs, official final world snapshot,
Google Sheets row-write tracking, and strict/partial rubric results. Offline
`inspect score` recomputes the official rubric from that snapshot and checks its
identity and recorded score. It does not re-execute mutations: official record IDs
and timestamps are nondeterministic. The logs contain simulated business records
and belong outside agent-readable projects. Failed/cancelled observations preserve
diagnostics; infrastructure errors and cancellation are unscored. A normally
settled failed Task still receives its actual official business score.

Specify the fully qualified scorer when re-scoring a packaged task (Inspect
0.3.259 stores unqualified scorer names in logs):

```powershell
.venv/Scripts/python -m inspect_ai score logs/run.eval --scorer opencorvus_inspect/automationbench_strict --action append --model none --output-file logs/rescored.eval
```

Use `opencorvus_inspect/automationbench_partial` for the partial metric. Both
scorers recompute and validate the complete official strict/partial result.

The harness closes its own MCP endpoint on success, failure or cancellation,
preserves project files and does not cancel the OpenCorvus Task. A timed-out Task
may remain owned by the service but can no longer mutate that closed world.
Starting/stopping services, copying credentials, selecting another model and
cleaning old projects remain explicit operator actions.

This harness requires the same host/filesystem as the loopback OpenCorvus service.
Distinct projects and in-memory worlds provide sample isolation, not an operating-
system sandbox. The results explicitly record `comparable=false`; unrestricted
host tools or global capabilities require separate isolation review before a
leaderboard-comparable experiment. Model-driven execution is separate from local
checker acceptance.

## Extending the catalog

A new benchmark contributes one immutable `BenchmarkDefinition`: stable ID,
dataset field schema, exact source provenance, scorer revision, frozen judge
policy, and scorer key. Its implementation is registered separately under that
stable scorer key, so new dataset revisions can reuse a scorer without copying
it. New definition/scorer pairs use the single `register_benchmark` operation;
the bound definition registry rejects every missing scorer reference, including
post-import mutation. Duplicate benchmark IDs and scorer keys fail. Upstream
semantic changes receive a new ID or revision instead of changing historical
meaning.

Runtime judge arguments and persisted provenance are separate contracts.
Provenance records transport argument names and a URL digest, never raw
argument values. Service URLs containing user information, query parameters,
or fragments are rejected so credentials cannot enter Inspect logs through an
otherwise innocuous `base_url` field.

Inspect remains the only owner of dataset execution, concurrency, epochs,
scoring, logs, and re-scoring. A benchmark integration must not add another
runner, Provider client, result store, or OpenCorvus lifecycle path.
`build_benchmark_task` composes the same registered dataset and quality scorer
with another explicit Inspect Solver and its lifecycle scorers, so future
system adapters do not need to duplicate benchmark semantics.

Apodex-derived prompts and parsing rules are used under Apache-2.0; see
`THIRD_PARTY_NOTICES.md` and `LICENSES/Apache-2.0.txt`. Dataset licenses are
separate from the source-code license and must be audited before redistribution.
