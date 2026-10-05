# Actual03 causal qualification and bounded implementation

## Recall

Root requests read-only qualification of the previous implementation proposal against actual Sol03, where six tools belong to six distinct assistant messages. Read the continuation review/proposal, actual03 step facts and complete messages, physical-final receipt, and saved wide Review screenshot; inspect Session loop/processor/prompt ownership and current tree projection. Only this document is added. No source/test/shared index/Git/runtime/Provider/credential operation. Root owns implementation, indexing, checks and actual visual acceptance.

## Finding

The saved `live-sol-edit-03-ui-07-before-review-wide.png` shows Review initial→middle while the visible transcript includes middle→final and final Read. `live-sol-edit-03-physical-final.json` reports 58 bytes, terminal LF, state final and exact expected bytes. These are distinct observations: the physical receipt corroborates the final result; it is not a proposed resolver input or current-disk fallback.

The prior proposal's same-assistant-message-only first implementation **does not cover actual03**. Its cross-message frontier clause needs an explicit adapter contract. Current projected parent/occurrence identity alone does not implement that clause. This is a correction to the proposed scope, not evidence that the current collector already knows causality.

## Actual evidence and production causal contract

Session is `ses_-zUSn3IzNzzdZ2AxFWCU`; every assistant's actual acceptedInputMessageIDs is the singleton `msg_99148640-43a1-41e8-a80a-3b4ca2f64b62`. The first six have completed Tool, committed step-start/step-finish and finish tool-calls; the final assistant has finish stop. None of the captured assistants has an error. Tool sequence is Write, Read, Edit, Read, Edit, Read. The two body receipts are:

| Actual message / Tool Part | Exact body transition |
| --- | --- |
| `msg_g0VXCwlHh00ge118UqXM` / `prt_g0VXCwmEn00vqqimiM7C` | initial→middle |
| `msg_g0VXCwo6y00aLuV7Li9V` / `prt_g0VXCwpGL00Hz7OjHJt5` | middle→final |

The first Edit's after equals the second Edit's before byte-for-byte in the captured metadata. The intervening Read observes middle, and final Read observes final. Write has no complete filediff endpoints; therefore these facts qualify an **observed Edit interval initial→final**, not absent→final creation or a complete six-tool lifecycle net. Reads validate observed states but are not change events.

Source establishes why normal continuation steps in this Session consume earlier completed results: `session/loop.ts:1854,1861` persists the actual accepted batch on the assistant; `:2384` awaits processor.process; `:3046` retains the accepted batch within runActiveTurn; `:3051` reloads durable MessageStore messages each iteration; `:3093` advances the step; `:3286–3298` reuses that batch and awaits processTurn. The next iteration cannot run concurrently with the awaited previous processTurn in this owner. At terminal stop the batch resets only for new attached work (`:3316`). `session/prompt/state.ts:231,489–491` acquires durable authority and returns peerOwner instead of admitting a second owner; `loop.ts:2878–2902` handles that peer separately. Processor commits step-start (`processor.ts:925`), binds provider start-step to the prepared committed boundary (`:1262`) and persists step-finish (`:1297`).

This is a source-backed normal single-owner continuation contract combined with the real completed step/accepted-batch facts. It is stronger than parentID, timestamps or adjacent creation keys. Stable orderKey identifies persisted message/Part placement and boundary membership; it does not itself assert mutation order. Content continuity validates the candidate interval; it cannot license concurrent tools on its own.

The supplied artifacts do not contain an explicit runtime owner-acquisition trace/controller identity or a predecessor-message field. Thus absence of takeover/restart is not independently forensically established. Do not claim such a trace exists. Qualification is bounded to this production normal continuation contract. If implementation requires independently attested physical-owner continuity across restarts, current evidence is **explicit incomplete** and that wider qualification is excluded. Recovery, compaction, errors, parked steps, multiple tools in a step, changed accepted batches and concurrent/multi-session writers must return incomplete until their actual producer relations are admitted.

## Required canonical input and minimal scope

The existing canonical tree writer discards acceptedInputMessageIDs in both live and history adapters: its MessageInfo has parentMessageID but no accepted batch (`tree-writer.ts:314–335`); constructors `:1053–1057` and `:3351–3355` retain parent/settlement only. occurrenceInputMessageID derived from parent is not a substitute. Extend those **same existing adapters/map**, not a new selector/store, with actual accepted batch and the completion/finish/error facts needed to qualify normal completed continuation boundaries. Retain actual step Parts. Missing input must produce unlinked-order/incomplete, including old history lacking these fields.

Then the sole reducer in `utils/file-change-summary.ts` can qualify modified→modified receipts across distinct assistant messages under the same real Session/accepted batch and completed normal step boundaries; require unique nonconcurrent step membership and exact endpoint continuity. Do not compose Write's unknown endpoints into this interval. Canonical PatchPart files remain paths-only coverage with no invented Tool association. Equal-looking Patch/Tool observations cannot be deduplicated as one causal event without an actual link. Parallel/same-step, lifecycle/move and multi-project reconstruction remain explicitly incomplete. This first scope needs no backend processor, Snapshot, persistence or mutation-clock changes.

Necessary production scope is tree-writer's two existing message adapters/type, the shared file-change-summary reducer, public FileChange evidence contract, and `services/diff.ts` exact-source/resolver/revision adaptation. Its current `changeGroupsRevisionKey` (`:58`) contains path/status/stats but excludes body; equal-stat actual03 edits therefore require structured current endpoint/evidence identity in that existing key. No hash acceptance, generation cache or disk read is needed.

Root must also propagate the one evidence contract to FileChangesView and DiffPreviewPanel: distinguish complete observed interval from incomplete, show unknown counts honestly, and never coerce missing endpoints to empty strings. Preserve exact selected group/source. ChangesPanel must carry that source metadata; ConversationArtifactSummary/shared summary consumers must disclose incomplete/overlapping live versus persisted coverage instead of adding it into a unique net claim. TaskDirBar requires changes only if its actual input includes this changed summary; its unrelated artifact-only presentation is not a reason to expand scope. Localized wording belongs to existing dictionaries. Root must search final type callers to determine mechanical adaptations, then manually inspect live Review and saved/history Review separately. A completed live Edit interval must not masquerade as a persisted whole-session creation interval.

## Positive qualification and actual acceptance

Pure contracts should reproduce the actual six distinct assistant messages, singleton accepted batch and real committed boundary shapes; the two Edit receipts yield initial→final and net counts from those endpoints regardless of collection traversal order. Preserve the observed Edit interval/source identity. Also verify explicit incomplete for missing accepted batch, unfinished/error boundary, concurrent same-step receipts, broken endpoint lineage, unknown Write endpoint and unlinked Patch coverage. Verify exact separate Session/project groups; live and saved observation contracts remain distinct; equal-stat endpoint replacement produces current revision and exact resolver output. These are pure data contracts, not UI tests or claimed runtime ownership traces.

Root's next actual acceptance must select the same live source during both Edit completions, save the Review initial→final screenshot and final Read/physical receipt, then reopen history and inspect its exact observation scope. Original Tool receipts remain naturally visible. Creation/move/recovery/parallel behavior is outside this actual03 qualification and requires its own real evidence. No new diff cache, shadow owner, current-disk fallback, clock-only sorting or fabricated Tool↔Patch relationship is authorized by this review.
