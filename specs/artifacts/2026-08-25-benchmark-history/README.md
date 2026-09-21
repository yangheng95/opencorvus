# Historical benchmark source archive

These are the exact committed files from `4e02bc63d1cb1415e0ce89c422d365251d915847`, imported during the September 21 consolidation. `manifest.json` records their original paths, lengths and SHA-256 identities. The original commits are ancestors of main.

This directory is an archival artifact, **not a current runnable benchmark entry point or installed Skill**. Its source, configs and tests describe the August experiment and retain that experiment's original assumptions. Do not use its instructions to change the current checkout or credentials.

The WorkBuddy preparation entry pins runtime `e8cdd1be4d280399bbb953562000b430f4e59fe7`; its terminal checker and isolated test fixture use `engine_workflow_node_occurrence`, a table retired from current main. Reusing this checker on current main fails with a missing-table error. Current WorkBuddy support would require a separate migration against current production contracts and real Linux/Harbor acceptance. The partial Windows fixture checks performed during consolidation do not establish that support.

The three fixed AutomationBench round launchers use the old coordinator flags and branch assumptions. Current AutomationBench execution belongs to `packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts` and `packages/opencorvus/script/benchmark/harbor/`; use their explicit current inputs. The archived duplicate TypeScript configuration is likewise historical; the current checker is `packages/opencorvus/script/benchmark/tsconfig.json`.

Preserving this history does not claim that a new paid experiment ran or passed. No Docker or Provider benchmark was run for this consolidation.
