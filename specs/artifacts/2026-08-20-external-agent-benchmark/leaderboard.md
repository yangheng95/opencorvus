# AutomationBench round 1 · OpenCorvus self-owned leaderboard

This board contains only `openai/gpt-5.6-luna` runs made through the OpenCorvus harness. Every attempt is retained below; only a clean-source, natural OpenCorvus `completed` terminal state followed by the official AutomationBench scorer is leaderboard-eligible.

## Paired 50-case profile summary

| Internal rank | Profile | Coverage | Strict | Partial mean | Total tokens | Output tokens | Model calls | API attempts | Failed API | Mean duration |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| — | base | 0/50 | 0/0 (—) | — | 0 | 0 | 0 | 0 | 0 | — |
| — | advanced | 0/50 | 0/0 (—) | — | 0 | 0 | 0 | 0 | 0 | — |

## Eligible per-case scores

| Case | Batch | Profile | Task | Strict | Partial | Total tokens | Model calls | API attempts | API failures | Duration |
| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |

## All attempts (paper evidence index)

| Started | Profile | Status | Reason | Task ID | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-08-20T05:00:22.814Z | base | invalid_bug | multiple_terminal_records | tsk_g00VSoHa0600BVcVZjqJ | [manifest](sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:26:18.689Z | base | invalid | task_create:TimeoutError | — | [manifest](natural/sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:35:06.218Z | base | development_scored | uncommitted_or_unrecorded_source_state | tsk_g00VSoQJY400fFxc1VKk | [manifest](natural-v2/sales-sales-multi_hop_lookup-base/evidence-manifest.json) |
| 2026-08-20T05:53:07.680Z | advanced | development_scored | uncommitted_or_unrecorded_source_state | tsk_g00VSoUqhN00d015zA3K | [manifest](natural-v2/sales-sales-multi_hop_lookup-advanced/evidence-manifest.json) |
| 2026-08-20T06:49:43.541Z | base | invalid_bug | post_seal_secret_redaction | tsk_g00VSoj8eI00Zj7en48x | [manifest](round-1-final/sales-sales-multi_hop_lookup-base/2026-08-20T06-49-43.541Z-4c5b4573-8b2d-4e0e-ad0f-b37634c68487/evidence-manifest.json) |
| 2026-08-20T07:12:42.684Z | advanced | invalid_bug | post_seal_secret_redaction | tsk_g00VSooxCr007s9Jf570 | [manifest](round-1-final/sales-sales-multi_hop_lookup-advanced/2026-08-20T07-12-42.684Z-3949b727-816d-482b-8a25-42e3f19293dc/evidence-manifest.json) |

## Public leaderboard context (not numerically comparable)

The official AutomationBench board uses a private held-out set, while this round uses a deterministic 50-case public set. `gpt-5.6-luna` is not listed publicly. No cross-dataset position, rank, slot, statistical estimate, or numeric delta is computed.

| Official row | Strict success rate |
| --- | ---: |
| Gemini 3.7 Flash High | 30.44% |
| Claude Opus 5 Max | 26.94% |
| GPT-5.6 Terra Max | 21.00% |
| GPT-5.6 Sol Max | 19.63% |

Snapshot: [AutomationBench official leaderboard](https://zapier.com/benchmarks), 2026-08-20.
