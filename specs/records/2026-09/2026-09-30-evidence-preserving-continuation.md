# Evidence-preserving worker continuation

## Recall

- User asks to improve coordination's interception of unfinished/abnormal execution, after an independent ten-trace audit, and authorizes implementation with “开始改”. Implement and push a bounded change; no new Release or benchmark sample is authorized by this turn.
- Read `AGENTS.md`, the current Task control-plane and extensions contracts, the independent audit record/findings/comparison, current Orchestrator/delegated-worker prompts, dispatch-turn projection/adapters, evidence-locator validation, shared participant reader, worker runner and streamed dispatch/owner tests.
- Searches cover all `dispatchAdapterContinuationPrompt` callers (delegated worker, workload, build, intent, frontend design, fact check, exploration and Orchestrator tools), `renderDispatchContinuationTurn`, `readAgentMessages`, evidence locator definitions, worker materialization and immutable input authority. There is one worker runner and one authenticated participant reader.
- No implementation delegation. The earlier independently delegated ten-trace audit is complete. Its useful finding is that a podcast continuation repeats discovery despite an already found subscriber table. Its pricing finding limits causality: the reviewer omitted base/tier before later coordinator candidate-answer exposure.
- Preserve closed runs, frozen packages/world/scorer, original outcomes, other workspace changes and current Task/Session lineage. No new Provider call, credentials, branch/worktree, business ledger, Host semantic gate, UI test or automatic retry.
- Acceptance: selected authentic terminal participant reports reach the successor's persisted visible input and actual streamed model request, with source identity, bounded/redacted text and explicit full-read reference. Same physical Session and original Task authority survive preparation recovery. Original requirements retain authority over guidance/report claims. Positive production-path checks and typed scope-error checks must pass; this cannot prove real-model business improvement.

## Investigation and impact

The observed podcast handoff carries authentic executor/reviewer `session_message` locators but not their text; guidance asks for an explicit opt-in shape. The reviewer had already found `ss_subs` and its actual schema. Access was available, and existing prompts already require original authority and independent review. Therefore absence of access or an entirely missing review instruction is not an established cause. The directly observable input-design weakness is that the incremental visible Message makes current guidance immediate while selected reports require another read. Wrong criteria and failure to use accessible evidence remain separate model behaviors; no universal causal claim follows.

Current flow: `dispatch_agent` resolves/validates canonical locators → immutable dispatch Turn → synchronous adapter continuation rendering → `runAgentSession` builds one real user text Part → immutable worker descriptor and actual streaming Session request. The renderer prints locators and guidance. The shared `read_agent_message` validates terminal dispatch reports against the same Task and reads actual MessageStore content. We will reuse its source selection and redaction, not introduce another storage or permission path.

Affected public behavior is the contents of an existing continuation Message, across every worker adapter using the central runner. Initial dispatches, schemas, workflow topology, tool permissions, artifact contents, lifecycle reducers, Mission policy, package versions and business mutations remain outside this change. Non-terminal messages and other locator kinds retain their canonical reference contracts; they are not reclassified as settled reports. Selected report quotations are historical participant claims, not new original authority or independent proof of current business state.

The five observed scheduler runtime-contract errors and the unscored cancellation/transport stall are separately documented in the benchmark record. Their horizontal shared-entry audit and remaining stack/interleaving unknowns stand. This evidence-input change does not alter scheduling/ownership and cannot be called a fix for those errors.

## Implementation

1. Extract the shared authenticated source selection inside the existing participant reader. Add a bounded selected-report projection using that same selection, existing redaction and existing eight-source / 8000-default / 30000-total character limits. Preserve caller order. Expose explicitly deferred report identities when more than eight are selected. Validate selected Session/Message identity; use terminal settlement identity to distinguish report quotation from other legal message references.
2. The central worker runner adds this projection to its existing single visible continuation Part before attachments and before its input authority is bound. No new Message, hidden input, artifact body, automatic latest-report selection, Tool payload or reasoning copy. Full reports and causal Tool evidence remain available through `read_agent_message`.
3. Refine the existing repair guidance in Core prompts: specify original obligation, discovered source identity, actual unresolved distinction and effects to preserve; coordinator candidates remain hypotheses. A reviewer tests the required business fact against original authority and supported evidence, rather than making an arbitrary evidence shape mandatory. No new Host adjudication.
4. Update current architecture and focused tests. The real streamed dispatch checker must assert actual persisted text, actual request content, original lineage and preparation-failure recovery. Reader tests cover bounds/redaction and exact typed ownership errors. Scripted streaming model assertions are transport/runtime evidence, not new business-model observations.

## Delivery and limitations

Run focused tests through the existing isolated runner, package typecheck, current docs checker and normal pre-push checks. Review the full diff; scope commit; pull/merge upstream; inspect all outgoing commits; normal push. Do not change version or publish an installer/site in this turn.

Real-model efficacy, sufficient source discovery, rejection quality and avoidance of harmful repair remain unverified by these checks. A new causal comparison needs separate complete preregistration, including unchanged producer/reviewer treatment boundaries and all cost accounting. Existing evidence and scores are not rerun or amended.

## State

Implementation completed in the central runner/shared reader and existing Core repair paragraphs. Current workspace was clean at investigation start. The existing authenticated source selector now serves both the public reader and selected report quotation; the actual continuation Part is still the sole persisted model input. Initial dispatch, tool authority, package version and lifecycle implementation were not changed.

Verification completed:

- `bun run --cwd packages/opencorvus test test/orchestrator-streamed-dispatch-settlement.test.ts test/read-agent-message-evidence-contract.test.ts test/task-owner-direct-delivery.test.ts`: 23 tests / 329 assertions pass. Log `.tmp/evidence-continuation-tests.log`.
- `bun run --cwd packages/opencorvus test test/selected-dispatch-report-quotes.test.ts`: 1 test / 10 assertions pass. Actual persisted cross-Session report/settlement facts prove caller order, 30000-character total, eight-quote/deferred-source boundary, exact full report availability, short complete text and typed wrong-Session rejection. This is a storage/reader contract check; the separate streamed checker proves runtime transport. Log `.tmp/selected-dispatch-report-quotes-tests.log`.
- The streamed checker proves long selected source/schema text reaches actual model requests and persisted single-Part input, redacts a synthetic secret, labels candidate answers as hypotheses and preserves Task/Session/dispatch authority after an injected preparation failure. Scripted model choices cannot establish better business reasoning.
- Package TypeScript check exit 0, log `.tmp/evidence-continuation-typecheck.log`; `bun run docs:check` passes 344 operations / 25 groups, log `.tmp/evidence-continuation-docs.log`; `git diff --check` passes.
- The new storage-check fixture initially omitted the default browser capability configuration, creator metadata and frozen root package overlay. Those setup inputs were corrected to the existing production contracts; no product validator was weakened. All current acceptance commands pass.

Delivery uses a scoped commit and normal pull/merge/outgoing review/push; the actual Git result and `.tmp/evidence-continuation-push.log` own publication evidence. Added quotation context is bounded but may increase per-Turn input size; elapsed-time or token savings have not been measured. Real-model business efficacy and the separate runtime-contract/cancellation incidents remain unresolved.
