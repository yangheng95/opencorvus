# AutomationBench automatic revision experiment

[Plan and Recall](../../records/2026-09/2026-09-24-automationbench-self-evolution.md).

Ten fixed development cases, fresh incumbent and model-authored candidate runs through Inspect and the official AutomationBench snapshot scorer. Actual results and candidate provenance will be added as each stage settles. This experiment uses the production feedback-revision path; full Evolution Lab Campaign integration is not established by it.

Runtime/evidence utilities reuse [the prior Luna experiment](../2026-09-24-inspect-automationbench-luna/README.md). Mutable runtime state lives under `.tmp/inspect-evolution-20260924`, never in the committed candidate package.

Current status: **blocked before the baseline by expired Provider authorization**. The first startup projected `openai/gpt-5.6-luna` correctly, but refresh returned an uncertain exchange. The repaired host returns an explicit copied-access expiry error before provisioning; credential copies are cleaned. No benchmark case or candidate-authoring request has run, so there is no new performance or improvement estimate.

`probe-manifest.json` freezes exactly ten official case identities. Domain counts: finance 2, sales 2, marketing 1, operations 2, support 1, HR 2. The four additions were sampled with seed 2026092410 from sorted task pools after excluding the previous three calibration and six pilot members. All ten must run fresh for both arms.

After the original OpenAI Provider connection has fresh authorization, start the existing `host.ts` with new evidence storage and `INSPECT_LUNA_MAX_REQUESTS=3000`. Run the registered `opencorvus_inspect/opencorvus_automationbench` Inspect task with this manifest, model `openai/gpt-5.6-luna`, incumbent package `expert-squads/builtin/automationbench`, a fresh sample-project root, host URL, `timeout_seconds=300`, `--max-samples 2`, `--no-fail-on-error`, `--ctl-server false` and `--model none`. Use the real production `evolve_expert_squad_from_feedback` Tool to produce the candidate after the full baseline; retain its Tool input/output and immutable candidate Artifact. Then run the same ten cases against that exact candidate in new projects.
