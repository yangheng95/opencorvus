# Browser Preview runtime and PRD execution fidelity

## Recall

- User request: Mission follow-up failed with `Host Session MCP Catalog could not inspect browser`; check whether the Task Browser MCP works, repair, rebuild and start. After the affected Mission later failed, the user clarified the repair order and scope: “先从mcp修，然后修prd读取与执行链路，其他都是表象问题”.
- Latest steering: “修复后编译，然后重新起一个新的case”. Create a fresh isolated project and Mission after compiling, using the same three original PRD/reference attachments and real Browser MCP/Preview use; preserve the failed Task's history. Starting the full implementation case is required; its eventual game acceptance must be reported separately from the repair's focused checks.
- Acceptance:
  - a Task-native Browser Preview liveness probe uses the packaged Browser Node sidecar rather than the compiled OpenCorvus executable and returns actionable sidecar diagnostics;
  - the same repair covers implementation, test and interface-review Browser Preview callers because they share one liveness owner;
  - original Task-input PRD attachments are automatically and completely projected to intent analysis, requirements, architecture and physical Build execution; scheduler-selected attachment lists cannot silently omit the source material;
  - focused positive tests, type checks, documentation checks, packaged build, restart and a real non-destructive runtime check complete before delivery.
- Hard constraints: repair root mechanisms rather than the game output; preserve streaming LLM calls, visible participant messages, the canonical attachment store and Task process authority; introduce no fallback runtime, parallel attachment source, UI automation, provider credential logging, release or destructive workspace operation. Do not wake the failed Mission for validation.
- Sources read: `AGENTS.md`; the prior MCP recovery record; current architecture for MCP, Browser Preview, Task ingress, attachment selection, dispatch recovery and Build; Browser Preview liveness and Node-sidecar runtime; Task execution-capsule binding and process supervisor; intent/requirements/architect input projection; dispatch-adapter schemas; Orchestrator Build adapter; Build attachment staging; Task attachment persistence and existing focused tests.
- Whole-repository searches: Browser Preview liveness callers and tests; Node sidecar users; `attachment_refs` schemas/callers; Task attachment definitions and projections; Build `attachmentRefs`; affected production task/session/tool outcomes; relevant architecture and September records.
- Delegation: none; the user did not request multiple agents.

## Observed failure and evidence

The affected Task `tsk_g00VVg4xDd00yd4VfnWf` retained all three original PRD inputs in its Task row. Intent/requirements/architecture workers sometimes received them because the Orchestrator model happened to enumerate their URLs. Every Build dispatch, however, crossed `orchestrator/build-tool.ts` with `message.attachmentRefs: []`. Implementation therefore received the terse Task request, downstream summaries and Artifact discovery guidance, but not the immutable PRD bytes that BuildAgent already knows how to validate and stage under `references/`.

The same Task's Browser Preview calls used explicit project/worktree directories and several independent ports. Every implementation, test and interface-review call reached the shared liveness probe and failed with `Task ... Browser preview liveness exited 1`. In `browser-preview/liveness.ts`, Task-native execution selected `process.execPath`; in a packaged build that path is `opencorvus.exe`, not Node. The probe consequently invoked `opencorvus.exe -e <JavaScript>`, discarded stderr and reported only exit code 1. Capsule execution did not share this exact mistake because it selected the capsule's Node path.

## Root cause and why the old paths did not cure it

Browser MCP connection recovery and Browser Preview process execution are adjacent but distinct layers. The earlier scoped-MCP close-handler repair restored Browser MCP catalog connection ownership, but Browser Preview liveness retained a second runtime-selection implementation instead of the canonical `runTaskBrowserNodeSidecar` primitive used by the rest of Browser evidence capture. Development runs masked the defect because their executable can evaluate JavaScript; packaging changed that executable identity.

PRD ingestion persisted correctly, and semantic stages could read the source when the scheduler supplied exact refs. That conditional selection is the defect: source completeness became a model decision at every adapter boundary. Build had no input field at all and hard-coded the empty set, so later requirement/goal Artifacts could only provide lossy summaries. Retrying the same implementation node or asking reviewers for more detail could not recover exact source fidelity.

## Impact audit

- Browser Preview: all Task-native preview starts, explicit-URL checks and persisted-target visibility reads share the liveness function. Host-direct probes remain in-process fetches; Task-capsule probes remain capsule-owned. Evidence capture already uses the canonical sidecar runner.
- PRD flow: Task creation and follow-up attachment persistence remain authoritative. Intent, Requirements, Architect and Build are source-semantic consumers and must receive the complete Task-input set. Frontend-design binding remains an explicit semantic subset because screenshots have role/region intent. Artifact provenance remains separate from attachment identity.
- Scheduling and recovery: no queue, wake, retry, concurrency, multi-project or terminal-state mutation is required. Fresh and continuation dispatches both re-read the same Task row, so automatic attachment projection is stable across retries/restarts. The existing strict adapter-input validator continues to protect adapters that retain explicit attachment selection.
- Continuation audit found that `runAgentSession` uses only the incremental continuation prompt and skips initial prompt builders. It now appends the current canonical Task attachment inventory to that real visible message. General delegated workers (including test/review roles) receive the same input inventory on their initial Turn. Artifact and frontend role-selection semantics remain independent.
- Data/API: no database migration or attachment duplication. The adapter schemas for source-semantic stages stop advertising scheduler-owned attachment completeness; Task attachments remain the single source.
- UI: no component/layout change and no UI automation. Real Browser Preview/runtime evidence is required after rebuild.

## Implementation plan

1. Replace Task liveness's direct process spawn with `runTaskBrowserNodeSidecar`, using a bounded fetch script and structured JSON result. Preserve Task process authority and surface canonical sidecar errors with stdout/stderr context.
2. Add a focused Task-native liveness test using a real local HTTP endpoint and the canonical Node runtime path; verify reachable and unreachable positive results through the public wait function.
3. Add one canonical Task-input attachment projection helper. Remove scheduler-selected `attachment_refs` from intent, requirements and architect adapter contracts; each stage derives exact Task URLs from the current Task. Pass that same projection to BuildAgent so it stages the original PRD inputs.
4. Add focused positive contract tests proving semantic adapters and Build receive the complete persisted source set, including when no model-provided attachment list exists. Update current architecture and record indexes.
5. Run focused non-UI tests, typecheck, docs check, build and diff checks. Rebuild/restart the application only after the candidate passes static checks, then validate Browser MCP catalog and Browser Preview without resuming the failed Mission.
6. Commit the scoped change, fetch and merge upstream, inspect the complete outgoing commit set, rerun affected checks when the merge changes relevant code, and push with hooks enabled.

## Status

- Implemented sidecar-backed liveness, bounded output settlement, failed-cache eviction, source-semantic adapter projection, Build staging input and continuation/general-worker attachment inventory. Superseded attachment-selection recovery tests were removed with their old Intent contract.
- Real Task process-authority test passed (1 test, 13 expectations), including HTTP 200/404 probes, rejected-cache recovery and scoped MCP calls. Intent settlement passed 5/5, Requirements 10/10, Architect 5/5, Build 16/16, streamed dispatch 13/13, fresh worker authority 2/2, delegated source routing 1/1 and Engine interaction recovery 7/7: 60 focused tests total. Build verification uses the physical Build fixture and real attachment store/staging assertions. The canonical projection accepts nullable Task attachment rows; the package typecheck and documentation check passed.
- The first packaged build compiled the frontend, SDK and backend executable, then failed copying the installed WinGet ripgrep binary because the sandbox denied access. The same complete packaging command is being rerun with elevated filesystem access; this is a packaging permission failure, not acceptance success.
- Fresh-case operator driver: [original-input case](../../artifacts/2026-09-20-browser-prd-case/README.md). It checks the configured provider and exact Luna model, verifies the original attachment byte sizes and SHA-256 digests, then uses public project/Mission ingress routes. Production SQLite access is read-only evidence.
