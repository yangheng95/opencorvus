# OpenCorvus Inspect benchmark

This package connects [Inspect AI](https://inspect.aisi.org.uk/) to the real
OpenCorvus Task lifecycle. Inspect owns datasets, sample concurrency, scoring,
logs, and the log viewer. OpenCorvus continues to own Provider selection,
streaming model calls, Agents, tools, persistence, and terminal acceptance.

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
- Shared project directories imply shared mutable state. Use isolated project
  directories when samples must not influence one another.
- `src/opencorvus_inspect/examples/smoke.jsonl` proves adapter wiring only. Its result is not a
  capability benchmark.
- A real quality run requires explicit dataset, model, Provider credential,
  concurrency, project, and cleanup authorization.
