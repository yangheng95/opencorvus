# AutomationBench round 1 · OpenCorvus self-owned leaderboard

This board contains only `openai/gpt-5.6-luna` runs made through the OpenCorvus harness. Every attempt is retained below; only a clean-source, natural OpenCorvus `completed` terminal state followed by the official AutomationBench scorer is leaderboard-eligible.

## Eligible scores

| Profile | Task | Strict | Partial | Total tokens | Output | Model calls | Tool calls | Duration | Agents |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |

## All attempts (paper evidence index)

| Started | Profile | Status | Reason | Task ID | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-08-20T05:00:22.814Z | base | invalid | task_execution:TypeError | tsk_g00VSoHa0600BVcVZjqJ | [manifest](sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:02:51.442Z | base | invalid | lifecycle_cancelled | tsk_g00VSoIBun00CIAC5dgf | [manifest](sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:26:18.689Z | base | invalid | task_create:TimeoutError | — | [manifest](natural/sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:35:06.218Z | base | development_scored | uncommitted_or_unrecorded_source_state | tsk_g00VSoQJY400fFxc1VKk | [manifest](natural-v2/sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:53:07.680Z | advanced | development_scored | uncommitted_or_unrecorded_source_state | tsk_g00VSoUqhN00d015zA3K | [manifest](natural-v2/sales-sales-multi_hop_lookup-advanced/evidence-manifest.json) |

## Public leaderboard context (not numerically comparable)

The official AutomationBench board uses a private held-out set, while this first round uses one public task. `gpt-5.6-luna` is not listed publicly. These rows are context only; no rank or delta against our one-task scores is computed.

| Official row | Strict success rate |
| --- | ---: |
| Gemini 3.7 Flash High | 30.44% |
| Claude Opus 5 Max | 26.94% |
| GPT-5.6 Terra Max | 21.00% |
| GPT-5.6 Sol Max | 19.63% |

Snapshot: [AutomationBench official leaderboard](https://zapier.com/benchmarks), 2026-08-20.
