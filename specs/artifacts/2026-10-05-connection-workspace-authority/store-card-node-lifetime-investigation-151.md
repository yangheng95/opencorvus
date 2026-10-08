#151 StoreCardNode reader lifetime — read-only audit

## Recall

Root identifies a candidate between main StoreCardNode and direct sideDock ConversationCard during147 observed main-text recreation. Need actual compiled Solid semantics and all canonical write callers, not JSX guess.149 parent/text/epoch/viewport trace is still required before a product cause claim. Only source/generated-code inspection and this report; no code/tests/UI/native/model/DB/Git/delegation. Root147 docs baebb push23213 pending at instruction time is not requalified here.

## All definitions and consumers

StoreCardNode.tsx5 storeCardNode reads actual cardTreeStore.cards[id], throws precise missing-card error including optional ownerID, returns canonical node. Component14–15 accepts children(node:CardNode) and fragment expression invokes it. Only TWO component sites found in all Overlay src/tests: Conversation.tsx151 main VirtualizedConversationItem calls children(node)→ConversationCard; Card.tsx243 recursive child calls children(node)→Card. ChatBubble.tsx124 uses plain storeCardNode in a child accessor, not the component. SideDock SubagentConversationScroll passes node() accessor to direct ConversationCard under truthy Show, not StoreCardNode.

Current generated main-BIRZ-Mrx.js semantic excerpt is `function Y2(e){return q(()=>e.children(J2(e.id,e.ownerID)))}`; J2 is exact canonical card lookup/missing error. q imports helper m from native-menu-surface-contract-b_vimv-0.js; m export is gn, defined `gn=e=>N(()=>e())`, a reactive JSX memo wrapper, not direct one-time invocation. No generated app runtime was executed, no digest/checksum acceptance. A source-only inspection command initially had one extra closing brace (Node SyntaxError), corrected read-only extraction completed; that was tooling text extraction, not product failure.

Installed solid-js createComponent1274+ calls component under untrack. Therefore current StoreCardNode children factory is re-evaluated when dependencies of the fragment memo change (canonical card slot/id/owner props), and it may instantiate new Card/ConversationCard on that recomputation. Nested component property reads execute under component's own reactive owners, not necessarily tracked in StoreCardNode's memo. Object field mutation is NOT automatically whole-card replacement or new factory invocation.

## Canonical store write distinctions

Installed solid-js/store dist/store.js97–114 tracks property-specific getters; updatePath176–222 merges existing wrappable object values via mergeStoreNode151–159 and only sets parent property for actual replacement/nonwrappable value. Thus `setCardTreeStore('cards',id,{...existing,status,...})` normally MERGES fields into existing object; it must not be described as object replacement from JavaScript literal syntax alone. Raw delta tree-writer1588–1607 changes exact nested Part field; status1909+ changes exact card fields; upsertPart3727 merges actual existing Part object; none inherently notifies cards[id] slot as new card.

Source search of `cards[...] =` in tree-writer finds actual direct assignment only migrateLifecycleCardToTurnCard2736 to NEW cardID, deleting old2734+; full reset592+/616 deletes cards and increments canonical epoch628; removeCardReferences1630/other actual pruning3914 deletes real cards. Card-tree prune uses reconcile(survivors,{merge:false}), whose keyed identity must be separately respected. These are genuine canonical ownership/collection changes, not proven routine same-id replacement on every delta. Actual initial materialization on previously absent slot also assigns card. No source-proven normal stream path repeatedly overwrites SAME cards[id] with new object was found in these current production definitions.

Consequently StoreCardNode is a genuine rematerialization boundary IF card slot/id changes, but current source does not establish that as147 repetitive same-Part root cause. Main virtual item buffer disposal/epoch retirement/CardParts branch changes remain candidates. Root sideDock difference is consistent with several boundaries; it does not isolate this component by itself.

## Minimum possible accessor contract, only after cause admission

If actual parent-row stable/epoch stable and card-slot replacement re-executes factory for same canonical card is proved, smallest single-owner contract: StoreCardNode children accepts Accessor<CardNode>; create one canonical accessor `() => storeCardNode(props.id,props.ownerID)` and invoke children once, passing accessor. Both existing component consumers use node() in their component props; error source remains same canonical lookup, no caching/dedup map/fallback. Update all two consumers and type together, preserving child store updates and exact genuine missing-card failure. Plain storeCardNode/ChatBubble accessor unchanged.

This would prevent callback rematerialization for ordinary accessor-value changes, while actual enclosing row removal/source switch/collapse still retires children. It is a proposed contract improvement, NOT currently authorized repair and NOT proof it fixes current main churn. Accessor also moves timing of missing-card read into consumer reactive use, so error-boundary behavior/all selected lifecycle paths require source review and actual positive acceptance. Do not reserve model identities, pin all rows or add snapshot owner.

## Next exact evidence

149 actual row mount/cleanup/current canonical epoch/order/viewport and TextPart DOM region first. If parent virtual item itself cleans up, StoreCardNode factory change is downstream and accessor won't preserve removed subtree. If parent survives but callback/card subtree rematerializes, minimal temporary existing-boundary metadata could record factory invocation + actual cardID/slot identity relation without raw content/new registry; Root must separately admit it, no current added effect/trace here. Child tuple and new owner count alone cannot determine which boundary fired. Model input flags/equal lengths cannot prove unchanged text across owners.

No UI tests or module/component mock/render tests permitted. Configured types/modules/build are prerequisites if contract changes later; current scoped nonUI data tests cannot prove DOM owner persistence. Root actual main/dock before/after pixels and natural inputs required, preserving147 main-recreation facts and sideDock nonreproduction. SourceKey143 untouched. Root chooses whether any accessor change is justified after evidence, no code modification performed.
