# Autonomous Visual Review Dispatch

## Recall

### User requirements

- Visual Reviewer must not be a mandatory blocker for a greenfield web interface merely because the deliverable contains a User Interface (UI).
- Either reserve Visual Reviewer for reference/replica work or remove the hard routing so the Orchestrator can decide from the actual task contract.
- The active DeBERTa Aspect-Based Sentiment Analysis (ABSA) Mission must remain agent-executed; host work is limited to environment preparation, scheduling, and infrastructure debugging.

### Acceptance criteria

1. A greenfield Advanced interface delivery has a complete workflow that does not require a Visual Reviewer.
2. Advanced still exposes an explicit greenfield workflow with independent rendered review when the request or repository contract requires it.
3. Reference-interface delivery continues to require Visual Reviewer evidence because source-reference fidelity is part of that workflow's product contract.
4. Base selects its visual workflow only for an explicit independent rendered-review requirement; the presence of UI, layout, or interaction work alone does not force that workflow.
5. Shared Orchestrator guidance treats Visual QA as a projected capability, not an automatic lifecycle gate inferred from the deliverable category.
6. Focused non-UI tests load the real built-in package and prove the exact workflow projections.
7. Documentation and package revisions match the changed workflow contracts.

### Hard constraints

- Do not add, modify, or run UI automation tests.
- Do not add a Host routing gate, workflow state machine, fallback, or compatibility path.
- Keep fixed selected-workflow node semantics: after the Orchestrator selects a workflow, every declared node remains mandatory.
- Do not weaken reference-parity evidence validation or VisualReview's internal evidence consistency contract.
- Preserve unrelated provider and local ABSA worktree changes.

### Materials read

- `AGENTS.md`
- `packages/opencorvus/src/prompt/core/orchestrator-core.txt`
- `packages/opencorvus/src/expert-squad/builtin/advanced/expert-squad.jsonc`
- `packages/opencorvus/src/expert-squad/builtin/advanced/agents/orchestrator/system.md`
- `packages/opencorvus/src/expert-squad/builtin/advanced/README.md`
- `packages/opencorvus/src/expert-squad/builtin/base/expert-squad.jsonc`
- `packages/opencorvus/src/expert-squad/builtin/base/agents/orchestrator/system.md`
- `packages/opencorvus/src/expert-squad/builtin/base/README.md`
- `packages/opencorvus/src/expert-squad/builtin/base/selector.md`
- `packages/opencorvus/src/orchestrator/visual-qa-stage.ts`
- `packages/opencorvus/src/visual-qa/output-tools.ts`
- `packages/opencorvus/src/visual-qa/evidence.ts`
- `packages/opencorvus/src/prompt/core/visual-qa-core.txt`
- `specs/records/2026-08/2026-08-09-deberta-absa-mission-e2e.md`

### Full-repository search results

- The blanket dispatch rule is in `orchestrator-core.txt`: any visual, GUI, layout, interaction, screenshot, responsive, or reference-parity request is currently treated as requiring the projected visual-review worker.
- Advanced's `greenfield-interface-delivery` graph declares `visual-reviewer` as a mandatory node, so the Orchestrator has no legal greenfield interface path without it.
- Advanced's `reference-interface-delivery` also declares `visual-reviewer`; that dependency is valid because the workflow owns supplied-reference fidelity.
- Base already has separate `composite-delivery` and `visual-verified-delivery` graphs, but its overlay and selector currently infer the visual graph from broad UI categories.
- `update_visual_qa_judgment` records rather than finalizes a judgment. Its registered-check/evidence-locator consistency findings are internal VisualReview facts. The observed ABSA loop occurred because the selected workflow made that reviewer mandatory, not because the product required reference fidelity.
- No focused Advanced built-in package workflow projection test currently locks this selection boundary.

### Independent agent feedback

- No independent agent participated before implementation.
- The first post-verification read-only review found four valid issues: the Advanced implementation overlay still delegated rendered inspection, Base selector retained a broad rendered-evidence trigger, English and Chinese architecture docs omitted the new workflow, and this delivery ledger was stale. All four findings were accepted and repaired. Follow-up independent review is pending.
- The second read-only review confirmed the first three behavioral/documentation findings were resolved and found no new runtime-contract issue. It found one remaining stale verification-status line in this record; that ledger-only finding is repaired below. Final read-only confirmation is pending.
- The final read-only confirmation reported no unresolved findings. Residual risk is limited to model-owned workflow selection and immutable already-bound Task revisions, which do not migrate automatically.

## Problem analysis

### Observable symptom

The greenfield ABSA web product, runtime checks, screenshots, and independent product reviews were complete, but the Task remained active while Visual Reviewer repeatedly tried to reconcile screenshot resource locators with registered VisualReview evidence rows.

### Direct trigger

The Advanced Orchestrator selected `greenfield-interface-delivery`. That graph always includes `visual-reviewer`, and shared core guidance independently says any GUI-related request must dispatch the projected visual reviewer.

### Control-flow root cause

Visual review applicability is encoded twice as a category inference instead of being decided from the requested acceptance contract: once in shared Orchestrator prose and once as an unavoidable node in the only Advanced greenfield interface workflow. Because selected workflow nodes are mandatory, an evidence-recording disagreement in an otherwise unnecessary reviewer prevents Task closure.

### Why the old path did not resolve it

The prior design made Visual and Integrity identities "optional" only by placing them in different fixed Base workflows. Advanced retained a single greenfield interface graph with mandatory Visual Reviewer, and shared core guidance overrode practical autonomy by equating all UI work with independent visual-review applicability. Tightening VisualReview evidence schemas cannot solve the scheduling error; it only changes how the unnecessary mandatory node fails.

### Impact surface

- Advanced and Base built-in package prompts, manifests, versions, selectors, and READMEs.
- Shared Orchestrator pre-completion guidance.
- Package projection tests and spec indexes.
- Existing bound Task revisions remain immutable. New workflow semantics apply to new Tasks bound to the new package revisions; an already-bound Task must finish under its original graph or be superseded by a new authorized Task.

### Explicit exclusions

- VisualReview evidence schemas and browser evidence validators remain unchanged.
- Reference Interface, Frontend Replica, and explicitly visual-verified workflows remain unchanged in purpose.
- No product UI code, Browser Preview implementation, Mission database, provider credentials, or ABSA project files are modified by this repair.

## Design

1. Keep `greenfield-interface-delivery` as the standard original-interface contract and remove its independent Visual Reviewer node.
2. Add `greenfield-interface-visual-delivery` with the same production graph plus Visual Reviewer for explicit independent rendered-review acceptance.
3. Keep `reference-interface-delivery` visual review mandatory.
4. Rewrite Advanced overlay guidance so the Orchestrator chooses the visual variant from explicit task/repository acceptance requirements, not from the mere presence of UI work.
5. Rewrite Base guidance with the same selection boundary.
6. Rewrite shared core guidance so only an explicit task/repository contract or selected workflow makes independent visual review part of the acceptance floor. Implementation-owned real-page inspection remains required when applicable.
7. Bump changed built-in package versions and add a package-loading test that proves the exact standard, visual, and reference workflow graphs.

## Verification

- `bun test packages/opencorvus/test/expert-squad/advanced-package.test.ts`
- `bun test packages/opencorvus/test/orchestrator/verification-budget-policy.test.ts`
- `bun run docs:check`
- Load both changed built-in source packages and verify package manifests/digests through the real registry path.
- Independent read-only review of the complete scoped diff and verification evidence.

## Delivery status

- Implementation: complete; first-review findings repaired.
- Focused verification: post-repair workflow projection tests passed (2 tests, 9 assertions), verification-budget policy passed (1 test, 5 assertions), `docs:check` passed, `git diff --check` passed, and `packages/opencorvus` TypeScript check exited 0.
- Independent review: complete; all valid findings were repaired and final confirmation reported no unresolved findings.
- Commit: included in this scoped delivery. Push: pending upstream audit.
