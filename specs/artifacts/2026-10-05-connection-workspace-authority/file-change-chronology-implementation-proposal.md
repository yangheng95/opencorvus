# Minimal file-change chronology implementation proposal

## Recall

Root requests an implementable, honest-incomplete design after the continuation source audit. Fix serial Edit stale endpoints without promoting Part creation order to mutation chronology, inventing Tool/Patch links or mixing live activity with persisted net observations. Preserve current single Parts/tree and exact group resolution authority. Only this proposal is added; no source/test/shared index/Git or runtime/Provider/UI/credential operation. Read continuation review, current panel diff architecture, FileChange/ChangeGroup, shared collector/group merge, resolveDiff/revision key, FileChangesView/DiffPreviewPanel/ConversationArtifactSummary/TaskDirBar, canonical Tool/Patch and timeline/step producers.

## Decision

Implement one shared pure **qualified endpoint reducer** with an explicit incomplete outcome. Do not patch mergeFileChange with unconditional last-after or infer chronology from sorted orderKey. Completed single Tool receipts can be shown exactly. Multiple same-file receipts become a complete net body only when actual existing scope/causal facts and content continuity establish a unique sequence. Otherwise retain an honest incomplete row whose original receipts remain inspectable in their existing Tool cards; do not pretend its first body is a net result. Persisted session/build snapshots retain their own interval contract and never become extra Tool events.

This requires a small public data/presentation change for incomplete counts/body, rather than hiding incomplete data behind zeros or a generic empty preview. It is the necessary boundary of a correct repair; a helper-only change that leaves downstream “undefined means empty text” behavior would remain misleading.

## Normalized transient input: existing facts only

Within file-change-summary, carry a transient observation containing sessionID/messageID/Part.id/callID/file-entry-index, existing agent identity, actual source path, target path/move type, completed before/after and start/end interval, canonical Part/message keys and available step membership. Deduplicate repeated delivery by exact receipt/file-entry identity. Two distinct tool receipts with equal bodies remain distinct activity facts. A changed current Part version is the tree owner's canonical projection, not another edit event.

Scope is actual Session/agent under the current tree's existing connection owner; Session fixes project/directory in the current public contract. Different Sessions remain different scopes even if agent label/path matches. Do not derive project authority from display base, role label or path string. If a relevant input cannot be associated with its actual existing Session/project owner, return incomplete scope rather than reuse the current selector directory. No separate per-file store, shadow selector revision, disk access or network lookup is introduced.

Normalize canonical PatchPart as its actual path-coverage/hash observation only. Its files are string[] and contain neither before/after nor tool predecessor. Remove the unsupported assumption that object-shaped Patch files represent a current producer protocol; do not build a parallel compatibility decoder. Patch coverage can be disclosed as existing activity, but cannot enter full-body serial reduction, source count or Tool dedup. The existing completed Tool metadata.files/filediff path remains the one body-observation implementation.

## Causal rule that can actually be implemented

Use stable orderKey to reconstruct the real message/Part sequence and determine step boundary membership, **only as display/step identity**. Prefer an existing completed step barrier: in one real Session/assistant message, a Tool observation belongs to a completed step before the next step starts; the next model step consumes the prior step's real results. Existing processor step-start/step-finish Parts provide that boundary. Validate each tool completion lies within the asserted step; missing/inconsistent boundary evidence is incomplete. Across messages, only use a real accepted-input/parent frontier already present in the canonical owner if it proves predecessor consumption; do not derive it from adjacent cards.

Concrete source availability check: Message.VisiblePart includes StepStartPart/StepFinishPart with required orderKey (message.ts:657–658), so this proposed same-message boundary extractor uses current persisted visible protocol rather than inventing a field. The actual Card tree projection/selected runtime must still retain the relevant Parts and match the completed Tool step before qualification. Source inclusion alone is not real chronology evidence.

For ordered receipts, require exact previous after == next before plus consistent operation/path/existence lineage. Numeric lifecycle intervals support validation; strictly separated intervals do not by themselves invent cross-process causality. Equal timestamps and creation keys do not create a causal edge. Parallel same-step tools without explicit serial producer relation are incomplete even if their before/after strings happen to form a unique chain. This may conservatively leave truly serial-but-unproved activity incomplete; that is preferable to false exact net endpoints. Root's first real serial acceptance must obtain step/frontier evidence, not provide fixture-only order assertions.

The initial implementation may restrict complete composition to same-Session actual step-separated Tool receipts, which is enough for the model's natural sequential Edit/result/next-Edit loop. Do not broaden to same-step parallel, multi-process clocks or unlinked messages until canonical facts support it. No new backend mutation-order writer is part of this bounded proposal. If actual desired serial scenario has no such facts, the reducer correctly reports incomplete and Root must separately decide whether producer evidence needs improvement.

Once qualified, compute earliest before/latest after and net additions/deletions with the current diffLines library. Preserve completed receipt count separately as activity metadata. The resulting body/stats are derived together from the same reduction; cumulative old operation stats never stand in for net values.

## One output contract

Extend current FileChange with an explicit evidence state, adapted at every current producer:

```text
complete:
  actual subject/source identity; existing added/deleted/modified status;
  known before/after or immutable observed side references;
  numeric net additions/deletions;
  optional observed operation IDs/count for live qualified Tool net

incomplete:
  actual subject/source identity and display path;
  explicit reason: missing-scope | missing-endpoint | unlinked-order |
                   concurrent | broken-lineage | conflicting-observation;
  exact existing receipt identifiers for navigation;
  additions/deletions = null, before/after unset, immutable side refs unset
```

This is one discriminated contract, not a fallback mode. Use a separate evidence-state discriminant rather than pretend incomplete is one of the three physical change statuses. Incomplete rows preserve the observed operation status only as activity context, not a net existence claim. A proven absent→absent create/delete or present→same-text revert yields complete no-net-change evidence with numeric zero stats and explicit net-change kind; its actual operations remain inspectable. Do not infer existence from empty text. Initial complete lifecycle composition can be restricted to modified→modified until explicit producer existence/move facts are fully reviewed; unsupported lifecycle combinations return the defined incomplete contract.

Complete persisted interval adapters explicitly declare session-net/artifact-net origin; live reducer declares tool-net origin. Their actual identity includes existing session/artifact/base/head fields where available. ChangeGroup merge key must include this contract/source kind so same session/agent does not silently collapse different coverage. Same exact immutable observation can be deduplicated by its real identity; conflicting endpoints for the same immutable identity return conflicting-observation rather than left/right priority. No new replacement/supersedes link is invented between live Tool set and persisted summary lacking coverage receipts.

If both live and persisted groups are shown, label them as different observation scopes and retain exact groupID. Their group-level numbers are interval-specific; a mixed-source overall total must report incomplete/overlapping scope rather than add them into a claimed unique net total. Existing complete persisted-source precedence in ConversationArtifactSummary may remain where it truly selects that source; do not change it to a live-current-disk path. The reducer remains sole live endpoint authority, while actual persisted snapshots remain sole saved interval authority—different real contracts, not duplicate implementations of one fact.

## Exact resolver and revision implications

resolveDiff must inspect evidence state first. A complete body is returned as now; complete immutable side refs use the existing observed artifact read. An incomplete row returns that exact reason/receipt metadata and must never invoke an artifact/current-disk substitute. DiffPreviewPanel shows the existing shared inline information/Disclosure treatment for incomplete evidence, and points to the original Tool cards through existing identity navigation. Do not render unset bodies as empty strings: current DiffView does so, and would falsely show a zero/full-add/delete diff.

FileChangesView shows “unresolved” counts rather than +0/-0 for null. Shared summary functions propagate whether counts are complete; mixed incomplete/overlapping observation sets retain known group facts and an honest incomplete total. TaskDirBar/ConversationArtifactSummary must use that same result, not build another readiness/statistics cache. Keep exact groupID/path selection; one incomplete row per qualified subject/path avoids same-group duplicate-path ambiguity.

changeGroupsRevisionKey currently ignores body. Replace its hand-assembled statistics-only identity with an exact structured serialization of the existing observation/evidence fields that materially affect resolution: group subject/source/refs, row evidence state/reason, actual before/after or object identity, path/status/stats and participating real Part identities. This key is request invalidation from current data, not a hash acceptance gate or an added cached owner. Equal-stat before/after updates must create a distinct current revision and refresh the already-existing resource. Do not concatenate arbitrary body delimiters without structural encoding or introduce a monotonically incremented shadow generation.

## Scoped implementation impact

Necessary production files: shared file-change-summary; FileChange public type in DiffView or its existing canonical type home; services/diff contract/summary/revision/resolver; FileChangesView and DiffPreviewPanel incomplete presentation; ConversationArtifactSummary and TaskDirBar only where they consume changed count/source results. ChangesPanel must preserve exact group/source metadata. Existing Tool result rendering, processor/Snapshot producers, session summary persistence, model policy, files/transport and selector owners remain untouched in this first scope. Root must search all FileChange/ChangeGroup/summary/revision callers and review the full selected diff before implementation; previous collector APIs that return AgentFileChange must use the same discriminated output rather than retain a second old reducer.

Introducing honest incomplete presentation requires new localized messages in the existing single locale dictionaries and real desktop screenshot qualification. No new Review renderer, file cache, transitional compatibility branch or automated UI test. Changes to pure adapters/reducer/resolver/count/revision receive focused positive contracts only; render/layout gets actual manual page interaction.

## Positive pure contracts

1. Completed Tool shapes with real session/message/Part/call identities and step-separated0→1→2 compose to before0/after2/netstats/source2, independent of tree traversal input order. Canonical keys alone with absent causal barrier produce unlinked-order, not the same net.
2. Repeated exact Part delivery produces the same one-operation result; distinct equal-body calls produce two actual activity identities. Invalid duplicate immutable identity yields conflicting-observation with its exact subject.
3. Same-step overlapping receipts return concurrent and null net counts, preserving original navigable identities; unique-looking endpoint matches do not override this result.
4. Broken before/after chain yields broken-lineage; missing endpoint/scope yields the corresponding explicit reason. Two Session/project/agent owners retain independent exact groups.
5. Explicit existence lifecycle fixtures qualify create→modify, modify→delete, create→delete no-net and actual move→B-edit only once their producer semantics are admitted. Until then, those inputs have exact incomplete results. Revert with causal barriers proves equal endpoints and zero net stats without losing operation identities.
6. Canonical PatchPart path strings map to path-coverage facts and are not full-body reducer inputs. This asserts the positive actual protocol shape, not a negative legacy absence check.
7. Complete persisted interval remains exact after merging alongside live Tool observations under its distinct source identity. Conflicting same immutable identity maps to explicit incomplete; no last-wins output.
8. Equal-stat body change produces a distinct structured revision; resolveDiff returns the current complete body or exact incomplete metadata. A complete immutable artifact side uses its actual original side contract. Pure test doubles remain labelled resolver-local contracts, not real native/visual acceptance.

Use existing relevant pure service test owner or a focused shared reducer file. No component render, DOM/source wording, snapshot, screenshot-baseline or browser fixture tests. A test that merely compares version/source hashes or asserts old behavior absent is not acceptance.

## Root's real acceptance and decision boundary

After source/type/local contracts pass, naturally execute precise owned0→1→2 edits through the real product. Capture canonical complete Parts, actual step/accepted-input frontier, real per-tool bodies and final Read; inspect both Tool cards and Review selected live source, then persisted summary separately. Save desktop screenshots of final net body/stats and an actual incomplete scenario's explanation and original receipt navigation. Repeat reopen/history/scope switch with exact source identity. Equal-stat endpoint update must visibly refresh the same selected current observation. Distinguish live reducer use from persisted snapshot masking. Move/parallel/multi-project scenarios require their own actual evidence.

This is implementation-ready as a bounded **qualified serial/incomplete** contract, not a claim of universal file mutation reconstruction. Primary remaining implementation decisions are exact existing step/frontier availability and localized incomplete navigation/count presentation. Any inability to prove chronology returns the agreed incomplete fact; it does not trigger a fallback or request a new diff cache. Root owns permission, source freeze, implementation, manual visual acceptance and delivery. This proposal itself changes no source/test/runtime.
