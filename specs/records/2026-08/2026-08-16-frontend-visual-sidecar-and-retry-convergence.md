# Frontend visual sidecar and retry convergence

## Recall

- User request: investigate and fix the Task incident where `interface-designer` was held open by the broken `capture_frontend_visual_evidence` toolchain and did not converge after repeated identical failures.
- Acceptance:
  - the canonical Frontend Design visual-evidence renderer receives the exact payload and Playwright module authority supplied by the shared Browser Node sidecar;
  - the same shared protocol is used by every affected production visual renderer/checker, with no environment-variable fallback or parallel payload source;
  - a visual-evidence infrastructure failure returns one stable, explicit failure contract that tells the Frontend Design agent when a retry is justified;
  - an identical failure may not cause unbounded unchanged retries, project-local dependency installation, or private Host-binary investigation; the agent preserves its accumulated design facts and finishes visibly so the existing partial/domain-incomplete settlement can close the worker occurrence;
  - focused non-UI tests, TypeScript checking, documentation checking, and a real Node/Playwright sidecar render verify the repair.
- Hard constraints:
  - preserve unrelated Task-control and shared-database changes already present in the dirty worktree;
  - do not add, modify, or run UI automation, DOM assertion, snapshot, screenshot-baseline, or pixel-difference tests;
  - use the existing Browser Node sidecar, Frontend Design output Tool, partial Artifact writer, and `domain_incomplete` settlement; do not add a fallback renderer, a Host workflow gate, or a second completion authority;
  - do not write credentials or private environment values to logs, this record, or the commit.
- Read sources:
  - repository `AGENTS.md`;
  - the supplied `opencorvus.debug.v2` bundle for Task `tsk_g00VSOKPKQ00XAdxa2tQ` plus read-only SQLite Session/Tool facts;
  - `specs/current/architecture/02-data.md` and `task-control-plane.md`;
  - `specs/records/2026-08/2026-08-12-cs047-frontend-design-domain-incomplete-settlement.md`;
  - `packages/opencorvus/src/browser/runtime/node-executor.ts` and `node-sidecar.ts`;
  - `packages/opencorvus/src/frontend-design/output-tools.ts`, `agent.ts`, `partial-artifact.ts`, and the Frontend Design core/Advanced prompts;
  - `packages/opencorvus/src/runtime/visual-page.ts` and `packages/opencorvus/src/acceptance/checks/walkthrough/run.ts`;
  - existing process-authority and Frontend Design settlement tests.
- Full-repository search:
  - `runBrowserNodeSidecar` serializes the sole payload as base64 and passes it as `process.argv[2]`; the resolved Playwright module path is `process.argv[3]`.
- Browser webpage extract/render/runtime-state consumed the intended argument positions but retained dependency/empty-input fallbacks.
- seven production render paths diverged: Frontend Design static render, runtime visual-page render, acceptance walkthrough, and Browser Preview evidence/region comparison/layout geometry/scroll-slice comparison read `OPENCORVUS_PLAYWRIGHT_REQUIRE_PATH`; every path also read its own nonexistent payload environment variable.
  - Browser webpage extract/render/runtime-state used the correct argv positions but retained `argv[3] || "playwright"` and `argv[2] || ""` fallbacks. Those are a second dependency authority and an invalid empty-input path, so the shared-protocol audit also removes them.
- neither Host nor Task sidecar launch writes those environment variables. Supplying them as another source would create a dual protocol; all seven divergent scripts and three fallback-bearing Browser webpage consumers must use the existing argv authority exclusively.
  - Frontend Design already persists the accumulated fact snapshot as one partial Artifact and returns `domain_incomplete` when the model Turn ends without complete evidence. No new lifecycle or workflow mechanism is needed; the missing behavior is a bounded model-facing failure contract that allows the Turn to end.
- Observed incident facts:
  - the first canonical capture attempts failed with `Cannot find module 'playwright'` from the project-root `[stdin]` script;
  - after the agent installed Playwright into the user project, later attempts failed at `decodePayload` with `Unexpected end of JSON input` because the environment payload was empty;
  - the persisted Tool requests themselves contained complete valid inputs, proving the loss occurred between the Tool renderer and its Node script rather than in model argument construction;
  - the agent retried the same deterministic failure repeatedly, inspected Host temporary/runtime internals, remained streaming, left `node_modules/` untracked in the delivery project, and never produced a terminal worker settlement in the captured interval.
- Direct trigger: the Frontend Design static-render script consumed environment variables that its sole shared launcher never sets.
- Data/control-flow root cause: the generic sidecar transport and seven visual consumers disagreed about the payload/module channel, while three Browser webpage consumers retained fallback authorities. Tool errors were then exposed only as generic execution failures, while the Frontend Design prompt had no bounded identical-failure rule, so the model treated infrastructure diagnosis as open-ended work instead of finishing with the existing partial contract.
- Why existing paths did not cure it:
  - local `npm install` happened to satisfy the incorrect default `require("playwright")`, but could not create the missing payload environment variable;
  - task lifecycle and detached dispatch recovery correctly considered the child live because its Provider Turn was still running; they cannot infer that repeated model-directed Tool calls are semantically futile;
  - `domain_incomplete` can close the workflow node only after the model finishes its Turn, so it cannot help an unbounded retry loop by itself.
- Definitions/callers/contracts/data/tests/documentation/delivery risk:
  - definitions: shared sidecar argv contract and the Frontend Design capture failure result;
  - production callers: Frontend Design capture, runtime visual-page, acceptance walkthrough, and all callers of those functions;
  - public/API/schema: no HTTP, database, Artifact, SDK, or generated schema change;
  - data: successful evidence rows and screenshot hashes are unchanged; failure gains a stable model-visible code/signature/retry disposition without persistence duplication;
  - tests: add focused non-UI protocol/error-contract coverage only; real browser rendering is a manual checker, not a retained UI test;
  - delivery risk: a malformed injected Node script fails immediately instead of reaching Chromium; the real checker must exercise the exact production Frontend Design renderer with the configured Node/Playwright/browser runtime.
- Independent agent feedback before implementation: none. The mandatory independent delivery review will run after the first complete implementation and verification pass.

## Plan

1. Converge every divergent visual script on the Browser Node sidecar's existing `argv[2]` payload and `argv[3]` Playwright module authority; retain no environment fallback.
2. Convert Frontend Design capture transport/toolchain failures into one stable model-visible `frontend_visual_evidence_toolchain_unavailable` result with a deterministic signature and an explicit retry disposition, while preserving page validation failures as actionable page defects.
3. Add a Frontend Design prompt contract: retry an infrastructure failure only once and only after a concrete correction; on the same signature, preserve current structured facts, record the blocker, avoid project-local toolchain installation/Host-internal probing, and finish so partial/domain-incomplete settlement can occur naturally.
4. Add focused positive non-UI coverage for the shared argv protocol and stable failure result. Run focused tests, package typecheck, docs check, diff checks, and one real production renderer invocation against an isolated static page.
5. Obtain an independent read-only review of the complete diff and evidence, fix every valid finding, repeat affected checks/review until clear, then commit only this task's files, merge upstream normally, verify the outgoing commit set, and push.

## Implementation verification

- Frontend Design static render, runtime visual-page render, acceptance walkthrough, Browser webpage extract/render/runtime-state, and Browser Preview evidence/region/layout/scroll render now consume the Browser Node sidecar's sole `argv[2]` payload and `argv[3]` Playwright module path. Obsolete environment-variable reads plus project-local/empty argv fallbacks are removed from every production script found by the repository-wide audit.
- `capture_frontend_visual_evidence` catches renderer/toolchain failure before screenshot publication and returns a stable `frontend_visual_evidence_toolchain_unavailable` result containing a deterministic 16-hex signature and `retry_once_after_concrete_correction` disposition. Page request/runtime validation failures retain the separate `frontend_visual_evidence_page_validation_failed` / `correct_page_then_retry` contract.
- The shared Frontend Design prompt now treats infrastructure failure as bounded evidence: after the same code/signature recurs, the agent preserves current facts, records the blocker, finishes the Turn, and leaves the existing partial Artifact / `domain_incomplete` settlement as the only workflow authority. It explicitly excludes project-local renderer installation and private Host-binary investigation.
- Focused verification:
  - `bun test --timeout=0 test/frontend-visual-sidecar-contract.test.ts test/frontend-design-domain-incomplete-settlement.test.ts test/process-authority-runtime.test.ts`: passed, 6 tests / 21 assertions before the production-Tool failure-path assertion was added.
  - Final `bun test --timeout=0 test/frontend-visual-sidecar-contract.test.ts test/frontend-design-domain-incomplete-settlement.test.ts test/process-authority-runtime.test.ts`: passed, 8 tests / 24 assertions, including the real materialized Tool execute-path failure contract and the distinct actionable page-validation contract.
  - Direct imports of all changed Frontend Design, Browser Preview, runtime visual-page, and acceptance walkthrough modules: passed.
  - Final `bun run typecheck`: passed.
  - `bun run docs:check`: passed (`333` operations, `25` groups).
  - Real production renderer checker, using Task `tsk_g00VSOKPKQ00XAdxa2tQ`, its original visual skeleton, native Task process authority, the configured Node/Playwright sidecar, and a `1440x900` full-page capture: passed; returned an `87,283`-byte PNG with signature `89504e470d0a1a0a` and SHA-256 `603ba28ecd4a331fc13c3154e9596256f128c6ebd0181729de32e878bfd20090`.
- The first standalone checker invocation was rejected before sidecar entry because it omitted the required `OPENCORVUS_TASK_PROCESS_MODE`; rerunning with the Task's actual `native` execution mode passed. This was a checker setup error, not a product failure, and no fallback was added.

## Independent-review correction

- The first independent read-only review found one P1: Browser webpage extract/render/runtime-state still retained project-local Playwright and empty-payload fallbacks even though they used the correct argv positions.
- The fallback branches were removed and these consumers were added explicitly to the shared architecture/audit scope; follow-up verification and read-only review confirmed the repository-wide sidecar scan is clean.
- Follow-up review found that the first catch boundary classified page request/runtime validation defects as toolchain outages. The sidecar result now distinguishes `page_validation` from `toolchain`, and the capture Tool keeps page defects actionable instead of applying infrastructure retry convergence to them.
- Final independent read-only review: PASS, with no unresolved findings after the fallback and failure-classification corrections.
