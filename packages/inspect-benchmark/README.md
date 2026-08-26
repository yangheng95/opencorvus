# OpenCorvus Inspect benchmark

This package connects [Inspect AI](https://inspect.aisi.org.uk/) to the real
OpenCorvus Task lifecycle. Inspect owns datasets, sample concurrency, scoring,
logs, and the log viewer. OpenCorvus continues to own Provider selection,
streaming model calls, Agents, tools, persistence, and terminal acceptance.

It has two entry points:

- `opencorvus_benchmark` loads an ordinary JSON or JSON Lines dataset with a
  generic completion scorer.
- `opencorvus_suite` resolves a versioned benchmark definition, validates its
  declared dataset schema and optional exact-ID manifest, and runs its frozen
  quality scorer alongside the durable Task-completed scorer.

The integration is an Inspect solver rather than a model provider. One Inspect
sample creates one OpenCorvus Task through `POST /task`, observes its public
status snapshots, and resolves the completed Task's exact Completion Decision
Message from the public conversation payload.

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
- Inspect sample concurrency is real OpenCorvus/Provider concurrency. Set
  Inspect's connection limit to a value the service and Provider can sustain.
- `project_isolation=shared` implies shared mutable state and is never accepted
  by comparable mode. Use `sample_epoch` for concurrent samples, retries, or
  multiple epochs.
- `src/opencorvus_inspect/examples/smoke.jsonl` proves adapter wiring only. Its result is not a
  capability benchmark.
- A real quality run requires explicit dataset, model, Provider credential,
  concurrency, project, and cleanup authorization.
- Comparable benchmark data and ground truth must remain outside the
  system-under-test's readable project or sandbox. Recorded provenance cannot
  by itself prove operating-system isolation.

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
