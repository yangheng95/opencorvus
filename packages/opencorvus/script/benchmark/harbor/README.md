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

Generate the first task with the pinned AutomationBench Python environment:

```sh
/path/to/automationbench/python generate_automationbench_tasks.py \
  --output /var/lib/opencorvus-benchmark/harbor-automationbench-v1/tasks \
  --domain finance --task wave_freelance_invoice
```

Build the current Linux x64 OpenCorvus binary in a clean Linux checkout, then assemble
the upload payload with `prepare_opencorvus_bundle.py --binary <binary> --output <bundle>`.
The bundle manifest fixes the binary, runtime helper, and mounted Skill bytes. Pass the
current OpenCorvus `data/auth.json` and matching `data/models.json` as separate Agent
kwargs; Harbor uploads them privately during `install()` and removes the incoming copies.

Run it from the Harbor environment after mounting the immutable OpenCorvus payload and
the private `auth.json` plus `models.json` files at the paths declared by the Agent.
The job must use `opencorvus_agent:OpenCorvusAgent`; no Harbor source patch is required.
`harbor run -c job-base-case2.yaml --print-config` validates the declarative job before
Docker startup. `harbor view <jobs-dir>` serves Harbor's own local result viewer.
