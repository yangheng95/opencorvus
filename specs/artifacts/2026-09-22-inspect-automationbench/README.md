# Inspect AutomationBench local acceptance

## Scope

User authorized implementation and local acceptance only, explicitly excluding real
model calls. The native Inspect log and re-scored log in this directory record
`execution_mode=local-checker-validation`. They exercise actual loopback Model
Context Protocol requests, official AutomationBench API mutations and official
rubrics for known empty, partial and complete invoice states. These are checker
contracts, not model or expert-squad capability results.

Expected `(strict, partial)` values are `(0, 0)`, `(0, 0.5)` and `(1, 1)`.
All three `checker_contract` scores must equal `C`. The full-state sample bills
the two completed projects in the official `finance.wave_freelance_invoice` case.

The saved simulated world includes private row-write tracking. Offline re-scoring
restores the world and recomputes the official rubric; it does not replay writes
with new random record identifiers. The logs include original simulated business
records and tool receipts, without Provider credentials or a model conversation.

Implementation and verification details are in the
[task record](../../records/2026-09/2026-09-22-inspect-automationbench-engine.md).

## Evidence

- [Machine-readable result summary](summary.json).
- [Native Inspect run](local-check.eval): 3/3 checker contracts passed, with the exact expected official strict/partial values.
- [Independent offline re-scoring](rescored.eval): fully qualified `opencorvus_inspect/automationbench_strict` recomputed the complete official result for every stored snapshot and matched all original values.

Commands (from the repository root):

```powershell
packages/inspect-benchmark/.venv/Scripts/python -m inspect_ai eval opencorvus_inspect/automationbench_local_check --model none --ctl-server false --max-samples 3 --log-dir .tmp/inspect-automationbench/final --display plain
packages/inspect-benchmark/.venv/Scripts/python -m inspect_ai score specs/artifacts/2026-09-22-inspect-automationbench/local-check.eval --scorer opencorvus_inspect/automationbench_strict --action append --model none --output-file specs/artifacts/2026-09-22-inspect-automationbench/rescored.eval --display plain
```
