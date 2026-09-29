# AutomationBench on Harbor

The control plane is pinned to open-source Harbor `0.23.0`. Install it in an isolated
Python 3.13 environment with `python -m pip install harbor==0.23.0`.

This adapter makes Harbor the owner of task selection, attempts, concurrency, timeout,
container lifecycle, artifacts, results, and viewing. The pinned AutomationBench package
remains the sole owner of the simulated world, API behavior, assertions, and strict/partial
scores. OpenCorvus is loaded through Harbor's public custom installed-Agent interface.

The OpenCorvus Agent and runtime helper are derived from the reviewed Harbor adapter on
`origin/codex/automation-workbuddy-benchmark` (`d1167c0d..4e02bc63`). Benchmark-specific
world transport is a UID-scoped Unix socket. Only Harbor's root verifier can reach the
admin scoring socket.

Harbor's Docker environment on Windows does not implement its phase-level `allowlist`
network mode. The task therefore gives the container public networking and applies one
network-namespace policy during Agent installation: IPv4 and IPv6 output from the sole
model-visible UID 60001 is rejected, while the root OpenCorvus Server retains Provider
network access. Docker adds `NET_ADMIN` for that owner rule and retains `SYS_ADMIN` for
the existing restricted-shell mount namespace. The generated trial evidence includes
`network-isolation.json` after both rules have been read back successfully.

Generate the first task with the pinned AutomationBench Python environment:

```sh
/path/to/automationbench/python generate_automationbench_tasks.py \
  --output /var/lib/opencorvus-benchmark/harbor-automationbench-v1/tasks \
  --domain finance --task wave_freelance_invoice
```

Build the current Linux x64 OpenCorvus release runtime in a clean Linux checkout, then
assemble the upload payload with
`prepare_opencorvus_bundle.py --runtime-dir <dist/runtime> --output <bundle>`. The complete
runtime directory is required because the executable resolves its pinned native packages
beside itself. The bundle manifest fixes the executable, runtime packages, helper, and
mounted Skill bytes. Pass the
current OpenCorvus `data/auth.json` and matching `data/models.json` as separate Agent
kwargs; Harbor uploads them privately during `install()` and removes the incoming copies.

Run it from the Harbor environment after mounting the immutable OpenCorvus payload and
the private `auth.json` plus `models.json` files at the paths declared by the Agent.
The job must use `opencorvus_agent:OpenCorvusAgent`; no Harbor source patch is required.
`harbor run -c job-base-case2.yaml --print-config` validates the declarative job before
Docker startup. `harbor view <jobs-dir>` serves Harbor's own local result viewer.

The generated main image contains a committed Git workspace owned by the root Host because
Task creation enumerates source with a private Git environment. The isolated tool group
60001 has filesystem access; installation validates Host source enumeration with system
Git configuration disabled. Docker Compose waits for the bridge's native socket healthcheck
before starting the main service. The verifier always seals the official
world and score, but emits Harbor `reward.json` only when the Agent's durable disposition is
`agent_settled`; an adapter timeout therefore remains an exception rather than a displayed
business zero.

The helper captures the current public Mission/Task evidence whenever observed activity
changes, before waiting for a terminal outcome. Inactivity or a later API read error keeps
that last complete observation for diagnosis; reasoning parts and raw Provider requests
are not exported. This evidence does not confer scoring eligibility. Usage exports include
connectivity preflight calls as well as Session calls; a missing cost on any row keeps the
aggregate cost unknown. Generated tasks use the helper's actual-inactivity deadline rather
than an additional absolute Agent runtime deadline.

For the Task/Mission × static/evolved comparison, use four Agent configurations with
`OPENCORVUS_ENTRYPOINT` set to `task` or `mission`, `OPENCORVUS_PROFILE=automationbench`,
`OPENCORVUS_WORKFLOW=execute-verify`, and `OPENCORVUS_SQUAD_PATH` pointing to the exact
static or production-authored evolved package directory. Both evolved arms share one
frozen package. The helper installs it using the public package API and records its
returned immutable identity. These arms use the existing four AutomationBench MCP tools
through SDK stdio under UID 60001; their definitions/catalog projection are shared with
the earlier integration, while Harbor owns their execution queue and world lifecycle.
The Agent image installs MCP SDK 1.30.0 but does not install the dataset/scorer package.

Task arms enter through `/task`; Mission arms enter through `/mission/wake`. Explicit
Mission accepted/blocked receipts (including legitimate zero-child outcomes) settle the
Mission arm. Inactivity alone does not. Mission retains its authorized artifact-publication
tool required by its completion contract. A Task's completed/failed lifecycle and physical
settlement are recorded separately from its official business score.
