# Normalized Tool Part bridge and diagnostic-copy repair

## Recall

- User request: investigate and completely repair the database-backed conversation shown in the supplied screenshot. The reported symptoms are that diagnostic/error text cannot be copied, the user's sent message cannot be seen reliably, and an apparent scheduler failure aborts the work.
- Incident locator: local production database `C:/Users/hengu/AppData/Local/opencorvus/data/opencorvus.db`, Session `ses_-zUXf0s7uzzAMGUpdMcX`, assistant Message `msg_g0VSKzKNn00up7Yh7nEC`, Tool request Part `prt_g0VSKzLTH007Zdm4RsMI`, and log `2026-08-15T044453-14312-1.log` at 04:46:09 UTC.
- Acceptance:
  - the exact normalized Tool request and outcome hydrate through the canonical public Session projection without an exception;
  - the persisted user Message `msg_21d12b0a-674d-45c7-b101-1a9ff2e642cd` and text `帮我我写一个推箱子的网页游戏` remain visible through the raw GET history contract, while normalized Tool facts project successfully in live events and the POST prompt response;
  - a live `message.part.updated` event for a normalized Tool request obtains its order identity from the canonical Tool request fact and does not enter `ProcessorUnsafeRetryError`;
  - error-reason and whole-conversation diagnostic copy use the existing HostTransport clipboard authority in native Tauri and browser hosts, with visible success/failure feedback and a bounded, redacted preview of persisted user text;
  - focused positive tests, typecheck, builds, real isolated page interaction, documentation checks, and an uninvolved read-only review pass.
- Hard constraints: do not edit the user's production database; do not restart, refresh, close, or otherwise operate the user's running OpenCorvus window; do not reintroduce Tool state into the generic `part` table or add a fallback/dual reader; do not weaken the unsafe-retry guard; do not create, modify, or run UI automation tests; preserve unrelated `.gitattributes`, release-record, and worktree changes.
- Read material: the supplied screenshot; production database rows and runtime log; `specs/current/architecture/task-control-plane.md`; `2026-08-15-task-root-fact-reduction-kernel.md`; `2026-08-15-task-root-ingress-decision-convergence.md`; Session message/Tool fact storage; protocol message bridge; Session route hydration; Overlay card-error and diagnostic-copy paths; HostTransport and Tauri clipboard command changes already present in the shared worktree.
- Repository search: `MessageStore` correctly merges generic `part` rows with normalized `tool_part_request`/`tool_part_outcome` facts. The only public projection break is `partOrderKeysForEvent`, which still queries only `PartTable`. Both live bridging and persisted Session/Task hydration call this function. Clipboard search shows whole-chat debug copy already being moved to HostTransport in preserved worktree changes, while `CardErrorReasonIndicator` still calls `navigator.clipboard` directly.
- Independent agent feedback: none before implementation. The post-validation reviewer found that the first draft incorrectly attributed raw GET history to the bridge and lacked executed native clipboard mapping tests. Both findings were accepted: the data-flow conclusion and spec were corrected, bounded/redacted user text was added to diagnostics, and browser/Tauri HostTransport branches gained focused positive tests.

## Evidence and root cause

The database contains the user's Message and text Part, so user input was not lost. It also contains the Tool request only in `tool_part_request` and its failure receipt in `tool_part_outcome`, exactly as the zero-redundancy schema requires. There is no `engine_task`, Task-root ingress, Task lifecycle Protocol Event, or Session control row for this Session. The incident is therefore an ordinary right-sidebar Work Session, not a scheduler-owned Task failure.

At 04:46:09 UTC the Session writer committed Tool request `prt_g0VSKzLTH007Zdm4RsMI`. It then published `message.part.updated`. `partOrderKeysForEvent` looked up the ID only in generic `part`, reported a false missing-row integrity error, and caused the Tool execution to append a failed outcome. Because a Tool had begun, `SessionProcessor` correctly refused to retry inside the same assistant Message. Finally, the POST prompt response called the same broken bridge over the persisted Tool Part and returned 500. This one stale storage assumption explains the apparent scheduling error and failed prompt response, but it does not own raw GET history.

The persisted GET route returns `Session.messages` directly and does not call the bridge. Both the screenshot and database show the original user Message, and an isolated GET/UI replay confirms a user card remains visible. The exact claim that the bridge hid GET history is therefore rejected. The remaining diagnostic gap was real: copied chat diagnostics reported only Message identities/counts, so they could not show what the user sent. The repair now includes a bounded and secret-redacted preview of user-authored text in the ephemeral clipboard bundle without creating another durable Message copy.

Diagnostic copy is a second concrete defect. A native WebView cannot be assumed to grant the browser Clipboard API. The title-level debug-copy repair already introduces `clipboard.writeText` in HostTransport and the registered Tauri command, but the error indicator bypasses that authority and still calls `navigator.clipboard.writeText` directly. The two diagnostic copy controls must share one host-owned write boundary.

## Design

1. The bridge resolves a visible Part's immutable creation time by its current storage owner: generic visible content from `part`, Tool call identity from `tool_part_request`. Exactly one owner may exist for an ID; no compatibility row or payload copy is created. A missing or multiply owned ID remains an integrity error.
2. Both live `message.part.updated` enrichment and persisted Session/Task projection use that one resolver, retaining one order-key formula and the existing drift checks.
3. The error-reason indicator calls the same HostTransport-backed clipboard writer as conversation diagnostics. Browser mode still uses `navigator.clipboard` inside the browser adapter; native mode uses the registered Tauri clipboard plugin command.
4. The persisted chat diagnostic projection reads only the exact `project_memory_user_input.literalText` authorship marker already owned by the user Message. It never guesses authorship from Text Parts because Host file and Model Context Protocol (MCP) resource context can also be materialized as Text Parts. The preview passes through the existing bounded secret-redaction utility before clipboard output and remains an ephemeral projection, not a persisted shadow message.
5. The unsafe retry contract remains unchanged. With the false bridge exception removed, normal Tool execution proceeds; genuine post-effect failures still cannot replay inside the same assistant Message.
6. No production data rewrite is required. Existing user, Tool request, and Tool outcome facts are already correct and become readable immediately after the fixed runtime is loaded.

## Positive verification

- Create a real Session, user Message/text Part, assistant Message, normalized Tool request and outcome through current writers; assert raw GET-source history retains the user text, then project the POST response and assert the user text plus Tool Part receive canonical message/part order keys.
- Publish/project the normalized Tool `message.part.updated` event and assert the exact request fact supplies its order key.
- Preserve integrity behavior for an actually absent Part and for an impossible duplicate Part owner through typed errors or the existing strict exception contract.
- Run the focused Session/message bridge test and affected Session processor/Tool fact tests, package typecheck, Overlay/transport typecheck and production builds, documentation checks, and `git diff --check`.
- Start an isolated real `/ui` instance, inspect the affected card/history visually, exercise diagnostic copy in the isolated host, and inspect a screenshot manually. Do not touch the user's running window.

## Delivery

After first validation, commission one uninvolved agent for a read-only review of the complete diff, incident evidence, tests, UI evidence, and preserved worktree scope. Repair every valid finding and repeat affected gates until no findings remain. Commit only this repair and the previously preserved clipboard implementation now brought into scope, pull/merge the upstream branch without rebasing, inspect the outgoing commit set, and push.

## Verification evidence

- `bun test packages/opencorvus/test/tool-part-fact-storage.test.ts packages/overlay/test/session-debug.test.ts packages/overlay/test/notification-host-transports.test.ts packages/transport-protocol/test/contract.test.ts`: 38 passed, 0 failed. This covers the Tool storage/bridge contract, raw Session history, exact authored-marker projection including attachment-only input, HostTransport clipboard branches, and transport protocol.
- `bun run typecheck`: 8 packages passed. A final Overlay-only typecheck also passed after clipboard import cleanup.
- `bun run docs:check`: passed with 332 operations in 25 groups.
- `bun run --cwd packages/overlay build:vite`: production build passed.
- `cargo fmt --manifest-path packages/overlay/src-tauri/Cargo.toml -- --check` and `cargo check --manifest-path packages/overlay/src-tauri/Cargo.toml`: passed; the native clipboard command compiled in the Tauri application.
- `git diff --check`: passed.
- Isolated real runtime: started a fresh server on `127.0.0.1:8793` with a dedicated runtime root and served the production-built `/ui/`. A real right-sidebar Work Session persisted `Build a Sokoban game` before an intentional missing-provider error; after a full page load, the user card remained visible. Manual screenshot inspection found the expected user card and no layout regression; the browser console reported no errors.
- Isolated clipboard interaction after final production rebuild: double-clicking the real chat title wrote a 3,230-character diagnostic bundle through HostTransport. The clipboard contained the exact Session identity, reported one persisted user Message, and included `user.text: Build a Sokoban game`. Post-review service tests execute both browser and Tauri mapping branches; Rust compilation verifies the registered native command without operating the user's active desktop window.
- Independent post-validation review: four read-only passes completed. The reviewer reported the GET/POST attribution, native clipboard execution coverage, Text Part provenance/privacy, and empty authored-marker handling findings; every finding was repaired. The fourth pass independently reran the focused gate at 38 passed, 0 failed and concluded with no unresolved findings.
- The isolated server was stopped after validation. The production database and active desktop application were not mutated or controlled.
