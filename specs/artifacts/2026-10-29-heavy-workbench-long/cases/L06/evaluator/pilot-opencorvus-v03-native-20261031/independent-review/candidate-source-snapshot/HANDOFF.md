# Reproduction and operations handoff

## Exact delivered paths

Project root: `D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031/project`.
Run commands below from that root in Git Bash on native Windows (no Docker/WSL).

- `policy.json`: complete eight-path `l06-tree-policy/1` integer action policy.
- `actor/submission.json`, `actor/actor.py`, `actor/policy.json`: self-contained online programme. Public code is read from the supplied `{public}` placeholder; standard-library Python only. No optimizer at runtime.
- `tools/solve.py`, `tools/common.py`: model source and public loader.
- `tools/deliver.py`, `tools/verify.py`, `tools/test_actor.py`: output construction, independent scalar reconciliation and actor tests.
- `results/weekly-ledger.csv`: 128 rows, all eight paths and weeks0..15.
- `results/commitment-policy.csv`: 2944 coordinates including zero orders/trucks/production.
- `results/summary.json`, `results/receivables.json`, `results/source-map.json`: exact financial values and input/output mapping.
- `results/optimization.json`, `results/information-relaxation.json`, `results/policy-audit.json`, `results/canonical-alternative.json`, `results/canonical-audit.json`: optimization and exact replay evidence.
- `REPORT.pdf`, `REPORT.md`: usable report and editable source; `figures/*.png`: actual scientific plots.
- `exercise/run-001/`: original successful real public exercise, including the deliberately induced controller exit73 and restart. Its original failure boundary is preserved, not overwritten.
- `diagnostic-evidence.zip`: original full exercise directory and derived results, including actual controller source, sealed actor, raw public originals, transcripts, SQLite databases, recovery receipt and diagnostics.
- `delivery-source.zip`: reusable source, policy, outputs, report, figures and handoff, plus the 25 authorized public inputs. No virtual environment or runtime metadata is needed to execute the actor.
- `results/self-check.json` and `results/negative-packet-diagnostic.json`: independent numeric checks and intentionally rejected forged packet, respectively.

## Reproduce actual execution (no installation required)

Use an output directory that does not already exist; preserve `exercise/run-001`.

```bash
"C:/Python314/python.exe" -B public/exercise.py --project "D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031/project/actor" --policy "D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031/project/policy.json" --out "D:/opencorvus-benchmark-runs/l06-v03-opencorvus-native-20261031/project/exercise/reproduction-001"
"C:/Python314/python.exe" -B tools/test_actor.py
"C:/Python314/python.exe" -B tools/verify.py
```

The last two commands inspect the preserved `run-001`; the first creates a new independent native exercise. Check its `owner-terminal.json` and `logical-and-journal-assessment.json`. The private path order and directory names are randomized by the public controller, so use its `episodes.json`, not hard-coded episode names. The controller records real PID/argv/exit. It uses SQLite schema2 and verifies all committed actions against the supplied policy. No UI automation, user-process actions or external services are involved.

## Rebuild reports / optionally optimize

The tested build runtime is Python3.12 at the declared base location. Dependencies and pip cache belong inside this project only. Existing `.venv` and `.cache` are local, not global installations. Exact direct versions are in `requirements.txt`; `requirements-lock.txt` records the complete tested dependency set. The actor does not need these packages.

```bash
"C:/Users/hengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" -m venv .venv
".venv/Scripts/python.exe" -m pip install --cache-dir .cache/pip -r requirements-lock.txt
".venv/Scripts/python.exe" -B tools/deliver.py
"C:/Python314/python.exe" -B tools/verify.py
"C:/Python314/python.exe" -B tools/package.py
```

Optional new optimization (run in a copy of the delivered source tree to preserve the executed policy and diagnostics):

```bash
".venv/Scripts/python.exe" -B tools/solve.py --seconds 120
".venv/Scripts/python.exe" -B tools/solve.py --perfect-information --seconds 120
```

The causal solve is time-limited; a different machine may find a different incumbent. Reusing the delivered exact policy reproduces the delivered business result without a solver. Re-solving overwrites `policy.json`, `actor/policy.json`, optimization diagnostics and the policy audit; therefore a new public exercise is mandatory before claiming that new policy executed. `tools/deliver.py` is intentionally bound to the delivered original `exercise/run-001`; change its run coordinate only in a separately preserved reproduction. Never combine old journals with new policy. Verify any new output against its actual programme and journals. Figures must be opened and inspected, not just generated.

## Operational sequencing and recovery

1. Read the next current packet and the COMPLETE original committed history. Recompute raw/finished/cash and arrival/receipt queues; current `decision_view` is only a projection, not an alternate checkpoint.
2. Select the complete observed-prefix action, check capacities/pack counts/MOQ/positive-order due<16, raw availability, routes/shared hours and BOTH pre-consumption/pre-dispatch peaks.
3. Fulfil all current demand; charge purchase/freight/production and end-stock holding now. Cash uses only sales receipts already due at their original absolute week. Intermediate floor is -9000, terminal floor0. Raw leftovers have no salvage; terminal finished stock must be zero.
4. Keep the controller-owned original SQLite database, its WAL files and full receipts. After acknowledgement loss reopen the same database with the same public facts and private current event stream. Use the same original request and payload for receipt recovery; never repeat a completed week with a new ID or edit committed rows. The actor resumes from the returned prefix and needs no local optimizer checkpoint.
5. The actual fault episode is located by `has_real_commit_loss` in `exercise/run-001/episodes.json`. Compare `after-commit-original.sqlite3` with the first8 rows of `journal.sqlite3`, and inspect `before-loss/crash-after-commit.json` and `completed/resume-receipt.json`. Original cut length8 and next week8 prove this controlled case, not arbitrary failure safety.
6. On unsupported current observation, altered receipt, different public facts, changed historical action, infeasibility or credit breach: stop and preserve the packet/database/diagnostic. Obtain a new authorized continuation; do not invent stock, cancel irrevocable arrivals, bring forward receivables, issue an unvalidated emergency order or assert a financial approval. The canonical spot programme is a comparison, not a validated mid-policy rescue.

## Interpretation and limits

`REPORT.pdf` distinguishes exact finite validity, actual source execution and bounded recovery from optimization quality. The perfect-information continuous relaxation drops causality AND integrality and is not an executable policy or exact integer optimum. Solver numerical bounds are diagnostic; the report also gives a weaker exact analytic bound. Native same-user execution does not certify OS filesystem/memory/side-channel confinement or power-loss behavior. No real procurement, credit approval, currency guarantee, independent acceptance, score or hours-of-work claim is made.

All 25 public files remain untouched. Historical draft text in those files does not weaken the task. No evaluator, weights, private answers, credentials, other project or benchmark directories were used. Preserve original diagnostics and all failed attempts; negative tests intentionally reject malformed data and must not be presented as operational failures or silently removed.
