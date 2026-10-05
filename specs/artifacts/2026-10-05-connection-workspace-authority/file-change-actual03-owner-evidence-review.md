# Actual03 physical owner evidence review

## Recall and correction

Root requested a read-only follow-up using the existing sanitized runtime log/tail, full step facts/messages, preflight/launch owner, public shutdown, process chain, durable before/after and final audit receipts. Only this review is added; prior committed review, source/tests/index/Git and runtime are untouched. Root owns indexing and checks. Output is confined to safe identity/time/status facts; no prompt, arguments, raw schemas, command line, auth/catalog or private values are reproduced.

The earlier actual03 qualification considered messages and source but had not examined these owner receipts. Its statement that physical owner evidence was missing must now be narrowed: **actual03 does have direct durable acquisition identity and corroborating same-process continuity evidence**. It does not require a newly invented owner trace to qualify the two normal Edit steps. This document supersedes that particular evidence limitation, without expanding qualification to arbitrary recovery or concurrent writers.

## Joined actual facts

| Evidence | Safe actual facts |
| --- | --- |
| preflight-ready | PID 17008; processInstanceID `win32:639268277001064857`; process occurrence `6e0717fe-057b-429b-b401-56ec4137d4ff`; run occurrence `live-sol-edit-03-78c8e204-2c8a-49b4-8a47-e75148132f3d` |
| launch-owner | Observed 2026-10-05T20:08:20.4704251Z; PID 17008, parent PID 30712, creation 2026-10-06T04:08:20.106485+08:00 |
| durable-before-shutdown | Observed 2026-10-05T20:22:02.933Z; target Session `ses_-zUSn3IzNzzdZ2AxFWCU` has generation `cal_g0VXCwhBP00Zbxa96L3O`, acquisition 1791230991615, and exactly the preflight PID/process instance/process occurrence |
| before-shutdown-chain | Observed 2026-10-05T20:26:14.8172609Z; same PID, parent and creation time; listed additional conhost child is not a second Session owner |
| root-public-shutdown | 2026-10-05T20:26:16.092059Z; HTTP status 200; response exposes ok/occurrenceID; same run occurrence |
| durable-after-shutdown | Observed 2026-10-05T20:28:41.343Z; owners array count zero, versus three before (target plus other Sessions). This is the actual durable release observation, not a claim that all work belonged to one Session |
| final-provider-audit | PID 17008, gpt-6.1-sol, 12 requests / budget 12, all streaming true, all status 200, exhausted false. Request count does not by itself assign calls to Edit steps |

The durable runtime_process lease `act_g0VXCwKrB00IbsiltQrG` records the same three-part process identity, activated 1791230905792, ordinal 1. Both snapshots retain that lease and grant, with expires_at 9007199254740991. This is a retained activation receipt, **not evidence of heartbeat renewals or continued physical liveness after shutdown**. No Session-target lease was selected from these arrays; prompt owner identity comes from the separate owners table.

Safe JSON projection of the runtime log finds 16924 records with processOccurrenceID, all that same process occurrence, from 20:08:23.366Z to 20:25:20.497Z. The terminal tail has 862 such records, same occurrence, 20:25:20.759Z–20:26:16.199Z. These counts include diagnostics, not just target Session execution. Target Session diagnostic records inside its turn carry that same occurrence. This is corroboration alongside the durable acquisition and operating-system creation identity, not a proof inferred from the absence of a string.

## Actual normal continuation

Target Session session.prompt loop records are step 0 at 20:09:51.618Z, step 1 at 20:09:57.994Z, 2 at 20:10:07.308Z, 3 at 20:10:12.694Z, 4 at 20:10:18.220Z, 5 at 20:10:24.500Z, 6 at 20:10:30.000Z, 7 at 20:10:41.306Z; entering standby follows at 20:10:41.328Z. Durable owner acquisition 20:09:51.615Z precedes this sequence and the same generation remains in the later before snapshot. Generation time is an explicit acquisition fact, not an ordering interpretation of its ID.

Both full messages and durable message projection show seven completed assistants with accepted batch exactly `[msg_99148640-43a1-41e8-a80a-3b4ca2f64b62]`; first six finish tool-calls, final finish stop, error_name null. Full step facts attach committed step-start/step-finish and exactly one completed Tool to each of the first six, which are Write/Read/Edit/Read/Edit/Read. The two Edit metadata bodies are initial→middle and middle→final with exact continuity. Intermediate/final Reads observe middle/final. These facts agree with the normal loop rather than an errored retry reconstruction.

## Producer relation that licenses composition

`session/prompt/owner.ts:281–365` acquires authority transactionally against the actual Session project/directory and current runtime identity. A live foreign owner is returned as acquired false; a replacement acquisition writes a new generation/time. Exact authority comparison includes generation/process instance/occurrence (`:114–117`); release checks generation (`:369–379`). Thus a retained generation acquired before the turn, same operating-system process instance and occurrence, later durable ownership and actual loop progression corroborate this actual normal ownership interval. They are not merely equal PID or parentID.

`prompt/state.ts:231,489–491` and `loop.ts:2878–2902` admit one prompt owner and handle peer ownership separately. `loop.ts:2384` awaits processor.process; `:3046` retains accepted batch within runActiveTurn; `:3051` reloads durable MessageStore each iteration; `:3093` advances step; `:3286–3298` reuses the actual accepted batch and awaits processTurn. Processor commits/binds step-start and step-finish (`processor.ts:925,1262,1297`). This awaited, single-owner, durable-result-consuming continuation is the causal producer relation. Actual normal barriers and accepted input identify its boundaries; Part orderKey only locates persisted boundaries and does not become a mutation clock.

Together, the joined actual ownership facts, normal continuation facts and exact endpoint continuity are sufficient to qualify **the observed modified→modified Edit interval initial→final across these distinct assistants**. Qualification does not require Tool and Edit to share one assistant. It does not establish absent→final creation: Write still lacks filediff endpoints. Reads are corroborating result observations, not mutation receipts. Canonical PatchPart path coverage still has no Tool predecessor link and cannot become another body or deduplicated mutation.

## Implementation and honest incomplete boundary

Root can admit the bounded shared reducer from the prior proposal with cross-assistant normal continuation explicitly supported. Existing tree-writer live/history must retain real accepted-input batch plus completed/finish/error and actual step facts; parent-derived occurrence alone is insufficient. Preserve one canonical projected owner and reducer. Do not add process checks to the UI or use these historical log files as a new runtime data source. These receipts qualify this actual reproduction; a generic reducer must return explicit incomplete wherever its current canonical input cannot establish the admitted producer relation.

Genuine errored or unfinished steps, recovery/takeover across authority generations, changed accepted batch, missing committed boundaries, parked/resumed/compacted branches without admitted predecessor-consumption semantics, multiple potentially concurrent tools in a step, broken endpoint lineage and concurrent other Session/project writers are outside this normal relation. Same process or accepted singleton alone cannot license those cases. An otherwise serial-looking content chain cannot repair missing causal input. Keep them incomplete until their existing producer contracts and actual inputs prove a unique sequence; do not sort by clock/creation keys or invent links. If the selected current frontend protocol cannot distinguish a normal continuation from a relevant recovery case, that input remains incomplete and requires a separately scoped producer projection decision.

Root's source implementation still needs equal-stat endpoint revision invalidation, exact live-versus-persisted observation scope, and honest incomplete body/count propagation through the existing list/preview. Physical-final and saved screenshots remain acceptance evidence, not resolver fallbacks. No new UI state/cache, backend mutation writer or universal lifecycle reconstruction follows from this owner review.
