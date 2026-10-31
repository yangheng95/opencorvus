# Reproduction and operational handoff

Everything below runs on native Windows. No container, WSL, browser, Provider, credentials or UI automation is used. Work within this submission directory. The actor needs only standard-library Python; CP-SAT optimization and scientific rendering use the isolated Python3.12 environment and bundled wheels.

## File entry points

- `submission.json`, `actor.py`, `policy.json`: root submission entry and declared full policy.
- `programme/`: compact source-only deployable actor project, with its own `submission.json`, policy and five unchanged public business modules. Use this folder as `--project`; do not point the public exercise at the entire submission folder with its evidence/environment inside.
- `source/optimize.py`: complete history-node optimization model; no actual future input.
- `outputs/weekly-ledger.csv`, `commitment-policy.csv`, `summary.json`, `receivables.json`, `detailed-ledger.json`, `normalized-input.json`, `information-nodes.json`, `information-relaxation.json`: complete exact outputs.
- `REPORT.md`, `source-map.json`, `figures/`: readable study, raw-source mapping and inspected PNG/SVG figures.
- `evidence/native-policy-01/`: successful actual public candidate exercise, including sealed source, PIDs, argv, transcripts, SQLite databases, original commit-loss snapshot and receipt recovery.
- `evidence/native-spot-01/`: executed canonical comparison; preserved wrapper exit1/checker exit2 after business success, solely because70640 exceeds the candidate-quality limit60044.
- `evidence/contracts-01/`, `delivery-cross-check.json`, `handoff-recovery-01/`: focused exact contracts, action/ledger-to-native comparison and tested standalone restore demonstration.
- `requirements-lock.txt`, `dependencies/wheels/`: exact local solver/plot dependencies for Windows64-bit Python3.12. The delivered actor has no third-party dependency.

## Reproduce the delivered policy and comparison

From PowerShell in this submission folder:

```powershell
$taskRoot = (Get-Location).Path
$publicFacts = 'D:/opencorvus-benchmark-runs/l06-v03-codex-fresh-native-20261031/public'
& ./reproduce.ps1 -PublicRoot $publicFacts -RunName 'my-fresh-run' -RunSpot
```

The script creates only a new directory under `evidence/`. It runs focused current-packet/receipt tests, then the actual eight-path public exercise. `-RunSpot` additionally executes the canonical alternative. Its wrapper is expected to exit1 at the final improvement check after all real business commits; the script explicitly requires the exact70640 business-valid result and retains the original failure. A different error is not accepted. Always use a fresh RunName; do not overwrite original failed or completed evidence.

The exact primary exercise command used for the retained successful run was:

```powershell
& C:/Python314/python.exe -B "$publicFacts/exercise.py" `
  --project "$taskRoot/programme" `
  --policy "$taskRoot/policy.json" `
  --out "$taskRoot/evidence/native-policy-new"
```

This reads the public support, not a reference actor. The public controller keeps the selected events on controller stdin and supplies only one complete current packet at a time to the worker. The path order is random and is reported only after termination. Final actions/costs remain deterministic for each observation prefix.

If the original public directory is unavailable, its actual original corpus/tools are included in the preserved exercise archive. Restore **inside a fresh directory in this submission**, then use that as PublicRoot:

```powershell
Expand-Archive -LiteralPath "$taskRoot/evidence/native-policy-01/public-originals.zip" `
  -DestinationPath "$taskRoot/restored-public"
& ./reproduce.ps1 -PublicRoot "$taskRoot/restored-public" -RunName 'restored-corpus-run'
```

## Regenerate optimization and figures offline

The delivered `.venv` is local to this task. For a fresh Python3.12 environment, without touching global packages:

```powershell
& C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe `
  -m venv "$taskRoot/.venv-rebuild"
& "$taskRoot/.venv-rebuild/Scripts/python.exe" -m pip --cache-dir "$taskRoot/.cache/pip" install --no-index `
  --find-links "$taskRoot/dependencies/wheels" -r "$taskRoot/requirements-lock.txt"
& "$taskRoot/.venv-rebuild/Scripts/python.exe" -B "$taskRoot/source/optimize.py" `
  --public $publicFacts --out "$taskRoot/outputs/solve-new" --seconds 120 --workers 8
```

The saved run used CP-SAT seed41031, eight workers and120 seconds, returned FEASIBLE and is preserved in `outputs/solve-causal-01/` with complete model, log, native bound and physical/causal audit. Multiworker search may produce a different incumbent; the supplied policy is the pinned reproducible execution artifact. A new FEASIBLE result must be audited and meet the60044 limit before replacing any deployment policy. Do not silently replace evidence or claim exact optimality from a time limit. The optional `--perfect-information` flag removes action sharing and must never be deployed as a causal policy.

Regenerate exact tables from the existing declared policy, then regenerate the report/figures:

```powershell
& C:/Python314/python.exe -B "$taskRoot/source/deliver.py" --public $publicFacts `
  --policy "$taskRoot/policy.json" --solve "$taskRoot/outputs/solve-causal-01" `
  --out "$taskRoot/outputs" --exercise "$taskRoot/evidence/native-policy-01"
& C:/Python314/python.exe -B "$taskRoot/source/source_map.py" --public $publicFacts --out "$taskRoot/outputs"
& C:/Python314/python.exe -B "$taskRoot/source/verify_evidence.py" --public $publicFacts
& "$taskRoot/.venv/Scripts/python.exe" -B "$taskRoot/source/figures.py"
& C:/Python314/python.exe -B "$taskRoot/source/report.py"
```

These overwrite only reproducible derived report/table files, not original execution evidence. A fresh environment may substitute `.venv-rebuild` for `.venv`. Open all four generated PNGs for actual visual review. Build/status/text checks are not visual inspection.

## Tested checkpoint restore command

The first candidate loss episode is recorded in `evidence/native-policy-01/episodes.json`. The following PowerShell selects that retained checkpoint, copies it via SQLite's read-only backup API into a new output folder and actually resumes the declared actor from the original8-row cut:

```powershell
$episodes = Get-Content -Raw "$taskRoot/evidence/native-policy-01/episodes.json" | ConvertFrom-Json
$fault = $episodes | Where-Object has_real_commit_loss | Select-Object -First 1
$checkpoint = Join-Path "$taskRoot/evidence/native-policy-01" "$($fault.directory)/after-commit-original.sqlite3"
& C:/Python314/python.exe -B "$taskRoot/source/recover_demo.py" --public $publicFacts `
  --checkpoint $checkpoint --path $fault.path --out "$taskRoot/evidence/recovery-demo-new"
```

The actual executed demonstration is in `evidence/handoff-recovery-01/`:8 original rows unchanged, original week7 cost3989/cash8475 receipt recovered,16 total commits, final cash36624/cost48806. `--path` selects a publicly recorded fixture path **in the controller** after the original run; neither that argument nor the future sequence reaches actor argv/env. The resume tool sends future fixtures to controller stdin only. It does not amend the original checkpoint or make a generic power-loss guarantee.

## Daily operation and recovery desk procedure

1. Retain the original committed journal, immutable public facts and every submitted request/response. Before each action the host replays original event/action/receipt rows, then presents the current week with complete history, post-week state and decision view. Historical arrivals and receipts are applied exactly once by the recurrence. The actor verifies all three views agree.
2. Review the current complete action in explicit supplier/raw and plant/product index order. Orders are pack lots, not units. Check current supplier volume/MOQ, arrival due-week, routes/shared hours, raw pre-consumption peak and finished pre-dispatch peak. All current demand is delivered. Pay purchase/freight/production/holding now; record the current sales receivable at its original absolute lag-four due week.
3. Commit the complete event/action/receipt atomically before advancing the week. Next packet acknowledges that commit. If acknowledgement is lost, recover from the database and ask for the original request receipt. Identical ID and payload return the original receipt; a changed payload under an old ID yields `idempotency_payload_conflict`. Never resubmit a completed week under a new ID or edit a completed row.
4. After process loss, preserve source, stdout/stderr, SQLite DB plus its live WAL/SHM sidecars where applicable, original request and receipts. Use SQLite backup to capture a coherent copy; do not copy only a live main DB while discarding WAL. Replay first and obtain the original receipt before sending the next current packet. Restart the stateless actor with the complete authoritative prefix, not a speculative optimizer checkpoint.
5. If the packet fails `packet_replay_mismatch`, `receipt_state_mismatch`, `public_facts_changed_on_resume`, `committed_policy_conflict` or `observation_not_supported`, preserve the input/diagnostic and investigate actual authoritative facts. Do not repair stock/cash by declaration, replace completed rows, retry with invented events, or treat an actor error as approval. New facts need a revised remaining-horizon solution with all original commitments fixed; this delivered policy covers only the supplied support and its own actual committed actions.

## Crisis and credit advice

- **Supplier restriction:** current capacity limits new dispatches. Earlier A/B orders still arrive on their original due weeks. Continue the supported-history action and preserve their arrival queue. Do not cancel historical commitments to free storage. C recourse is already part of the policy; independently switching to spot midstream is not certified from a forward-stocked state.
- **Warehouse pressure:** the worst raw peak239 leaves one unit of volume. Account for all historical due arrivals before production, including arrivals from now-restricted suppliers. Do not consume first to hide the specified stage peak. Any unscheduled arrival or changed pack/volume needs a new feasibility assessment before an additional unplaced order.
- **Credit pressure:** week3 requires3116 of the declared9000 credit line. The model leaves5884 of line headroom, assuming the exact original facts and receipt timing. Retain the9000 availability rather than treating3116 as a safe real-world limit. All terminal cash is positive, but that says nothing about unmodeled interest, taxes, default or lead-time slippage. Seek actual authorized financing if reality breaches those assumptions; no financing is preapproved here.
- **Delayed customer receipt:** weeks12..15 sales yield24150 or25230 of assets due16..19. They cannot fund a week15 order. If actual receipts are delayed beyond the declared lag, diagnose the scope break and recalculate cash from real receipts. Never accelerate a receivable in a checkpoint or offset it against operating cost.
- **Terminal week:** complete all demand, retain zero finished goods, keep raw residue/holding without salvage, and place no positive order due16+. Empty trucks still pay freight. Final cash must meet0 separately from the intermediate-9000 floor.

## Evidence limits and retained issues

The public exercise is actual Windows-native source execution and one controlled after-commit loss. It is not operating-system confinement, arbitrary-fault/power-loss testing, a real-world supplier/credit approval, effective-hours certification or an exact-optimum proof. Independent whole-case review remains pending. The canonical comparison's expected quality rejection, fixed local source-map syntax error and initial incidental bytecode-cache writes in the public exercise-tools tree are disclosed in `evidence/local-issues.json`. Public source, tables and contracts were not edited; the cache creation still breached the strict read-only-public scope. See REPORT for precise numeric and process evidence.
