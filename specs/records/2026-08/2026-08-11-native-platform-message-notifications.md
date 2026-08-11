# Native Platform Message Notifications

## Recall

- User request: replace the hand-built top-right message-notification dot on every platform with the platform's native notification behavior; on macOS this specifically means a bouncing Dock icon plus the notification shown by Notification Center at the top right.
- Acceptance indicators:
  - a newly eligible Mailbox item still produces exactly one system notification through the existing notification permission and delivery setting;
  - the same accepted native desktop delivery requests informational user attention, which maps to a one-time Dock bounce on macOS, taskbar flashing on Windows, and window-manager urgency on Linux;
  - the Overlay titlebar Mailbox action has no unread-count dot, accent pulse, or parallel attention state;
  - the host no longer draws a taskbar overlay badge, writes a Dock badge count, or swaps/flashes a custom tray-attention icon;
  - native attention is cleared when the main window is explicitly shown or regains focus, including on Linux window managers that do not clear urgency automatically;
  - browser-host delivery remains the Web Notification API because browsers do not expose desktop window-attention primitives;
  - Mailbox storage, unread/read state, hover access, item presentation, permission controls, and notification content remain unchanged.
- Hard constraints:
  - keep one current implementation and remove the superseded UI, transport, native command, tray state, and icon-rendering paths in the same change;
  - do not add, update, or run User Interface (UI) automation tests; visually accept the real page with screenshots and human inspection;
  - add focused positive non-UI coverage for the native-delivery contract and run the real Rust/TypeScript checkers relevant to the changed path;
  - preserve unrelated dirty-worktree changes and do not include them in this task's commit;
  - after initial validation, obtain an independent read-only agent review and resolve every valid finding before commit/push.
- Materials read:
  - `AGENTS.md` repository instructions supplied in the task;
  - `specs/current/architecture/**` and its index; no current document defines a separate desktop-notification architecture contract;
  - `packages/overlay/src/services/desktop-notifications.ts`, `MailboxPanel.tsx`, `main.tsx`, `App.tsx`, titlebar styles, host transport/capability definitions, transport protocol, Tauri transport and notification tests;
  - `packages/overlay/src-tauri/src/main.rs`, `Cargo.toml`, `tauri.conf.json`, and notification permissions;
  - the English and Simplified Chinese Overlay overview command tables under `packages/web/src/content/docs/**/overlay/overview.mdx`;
  - Tauri 2.11 documentation for `UserAttentionType` / `request_user_attention` and the official Tauri notification plugin reference.
- Repository-wide searches:
  - `badge.set` is defined only by the transport protocol, host capability matrix, Tauri dispatch, desktop notification projector, capability test, and `overlay_badge_set` command;
  - the top-right unread dot is owned only by `App.tsx`, `main.tsx`, `MailboxPanel.tsx`, and `styles/surfaces/titlebar.css`;
  - `overlay_attention_set`, `TrayAttention`, `build_attention_tray_icon`, and the tray flasher have no renderer caller and form a stranded custom-attention path;
  - `request_user_attention` currently exists only behind that unused command and is not part of successful native message delivery;
  - Mailbox notification projection is the sole live caller that couples unread count to host badge state.
- Independent agent feedback before implementation: none. The mandatory independent delivery review will occur after implementation and first-pass verification.

## Analysis

### Observable behavior

Every Mailbox refresh projects active unread items into three independent presentations:

1. `main.tsx` sets `mailboxAttention`, causing the titlebar Mailbox icon to change color and pulse;
2. `MailboxPanel.tsx` sends the unread count to `main.tsx`, and `App.tsx` draws a small count badge over the button;
3. `desktop-notifications.ts` writes the unread count through `badge.set`, while newly added item IDs separately pass through permission checks to `notification.send`.

On Windows, `overlay_badge_set` draws a red/white bitmap and installs it as a taskbar overlay icon. On non-Windows hosts it writes a badge count. The Tauri process also keeps an otherwise unreachable custom tray flasher that swaps a second red-dot bitmap every 700 milliseconds.

### Direct trigger and data/control flow

`MailboxPanel.refresh()` loads the canonical active Mailbox page. A non-append refresh calls `projectMailboxNotifications()`, which loads every active page, filters unread/unarchived items, updates the native badge for the whole count, invokes the in-app attention callback for newly presented items, and finally sends system notifications for newly added IDs. Scope replacement and disconnect call another projector method only to clear the native badge.

The system-notification transport is already host-specific: browser mode uses the Web Notification API, while Tauri mode invokes `overlay_notification_send`. The Tauri command submits a native toast/banner but does not request native window attention.

### Root cause

Message attention was modeled as three presentation-specific states instead of one delivery event. Unread collection state escaped the Mailbox and became both an application chrome badge and a desktop badge protocol, while native attention existed as a separate unused command plus custom tray animation. Because `notification.send` did not own the complete native delivery behavior, every platform received hand-authored indicators in addition to, or independently of, its native notification conventions.

### Why the old path did not converge

Later native-toast work reused the existing notification command but retained the earlier unread-count badge projection and in-app callback. The unused `overlay_attention_set` command was never connected to `notification.send`; its custom tray state and icon builders therefore survived as a parallel implementation rather than becoming the platform-attention primitive. Scope-reset code further entrenched badge lifecycle ownership in Mailbox projection.

### Impact surface

- Definitions and call sites: `AppProps`, `MailboxPanelProps`, `MailboxNotificationProjector`, host capability maps, `NativeCommand`, Tauri native dispatch, command handlers, and Rust tray state/setup.
- Public/internal contract: remove the internal `badge.set` native command. Keep `notification.send` as the sole delivery contract and strengthen Tauri delivery so `true` means the system notification was submitted and native informational attention was requested.
- Platform behavior:
  - macOS: `UserAttentionType::Informational` bounces the Dock icon once; the notification plugin submits the Notification Center banner;
  - Windows: informational attention flashes the taskbar button until focus; the existing registered Application User Model ID toast path remains canonical;
  - Linux: Tauri delegates attention to the window manager's urgency behavior and the notification plugin delegates notification display to the desktop environment; OpenCorvus explicitly clears the request on focus because some window managers do not;
  - browser: Web Notification delivery remains, with no fabricated taskbar/Dock equivalent.
- Data and server: Mailbox schemas, Server-Sent Events, paging, unread counts, acknowledgement, and durable item state are unaffected.
- UI: remove only the badge/pulse/attention presentation. The Mailbox button, hover panel, item counts inside the Mailbox, and read-management actions remain.
- Configuration: `desktopNotifications` continues to gate native delivery and permission requests. No new setting or hard-coded per-platform policy is introduced.
- Tests: update the exhaustive native-command capability test, keep positive browser/Tauri delivery tests, and add a Rust positive contract test for informational native attention. Existing UI automation in any touched path will not be run.
- Documentation/delivery: add this record and both required indexes; no SDK/OpenAPI generation is involved because `NativeCommand` is an internal overlay transport protocol.
- Risks:
  - native attention has no visible effect while the application is already focused by platform design;
  - desktop environment/user notification settings can suppress banners or attention even after application-level permission succeeds;
  - the current Windows machine can validate compilation and real toast/taskbar behavior, but macOS/Linux visual behavior requires their platform build/runtime; the cross-platform semantic mapping is verified against the exact Tauri API used by the compiled host.

## Implementation plan

1. Remove the titlebar unread/attention props, state, callback plumbing, count badge markup, and pulse/badge CSS while retaining the Mailbox action and accessible static label.
2. Remove unread-count and scope-reset presentation callbacks from `MailboxPanel` and delete badge ownership from `MailboxNotificationProjector`.
3. Remove `badge.set` from the transport protocol, exhaustive host capabilities, browser/Tauri dispatch, and focused tests.
4. Remove `overlay_badge_set`, custom taskbar badge rendering, `overlay_attention_set`, custom tray-attention state/thread/icon, and clear calls from the Rust host.
5. Make `overlay_notification_send` request `UserAttentionType::Informational` through the main native window and submit the existing platform system notification as one accepted delivery operation.
6. Clear native attention when the main window is explicitly shown or receives focus, and update both Overlay overview command tables to the single current command contract.
7. Run focused TypeScript unit tests and typecheck, Rust format/test/check, and the repository document checker.
8. Start the real Overlay page, capture and inspect the titlebar/Mailbox action without the custom badge or pulse, then obtain independent read-only review and repeat affected checks after any repair.

## Verification record

First-pass implementation verification:

- `bun run script/run-unit-tests.ts test/desktop-notifications.test.ts test/notification-host-transports.test.ts test/host-transport-capabilities.test.ts` from `packages/overlay`: passed 9 focused tests across three files. This covers one delivery for a newly observed unread Mailbox item, accepted and rejected browser/Tauri notification delivery, permission behavior, and the exhaustive host capability surface.
- `bun run typecheck` from `packages/overlay`: passed.
- `bun run typecheck` from `packages/transport-protocol`: passed.
- `cargo test --manifest-path packages/overlay/src-tauri/Cargo.toml`: first pass passed all 55 Rust tests. Independent review required strengthening the positive command-orchestration test and adding explicit focus-time attention clearing; the repaired evidence is recorded below.
- `bun run build:vite` from `packages/overlay`: passed after 7,100 transformed modules. Existing third-party `use client` and large-chunk warnings remain unchanged.
- `bun run docs:check`: passed with 330 operations in 25 groups.
- `git diff --check`: passed.
- Browser-skill real-page acceptance against isolated Vite at `http://127.0.0.1:5187/`: the actual desktop Overlay rendered at 1280 × 720; the titlebar Mailbox action retained its normal icon, size, static `Mailbox` accessible name, hover entry position, and adjacent Search action while showing no unread-count dot, number badge, accent state, or pulse. A visible screenshot was captured and inspected. The browser-only host reported its pre-existing Tauri event-bridge `transformCallback` console error and offline backend banner; neither originates in the touched notification files nor obstructed visual inspection. No UI automation test was added, changed, or run.
- Native runtime boundary: the Windows build and unit suite compile the exact `request_user_attention(Some(UserAttentionType::Informational))` call before the existing Windows toast submission. Starting a second visible Tauri application was intentionally excluded because the user already has OpenCorvus processes and repository rules forbid operating or colliding with a user's active application without explicit authorization. macOS/Linux behavior is validated at the compiled cross-platform Tauri API contract and official platform mapping rather than claimed as locally observed visual evidence.

## Independent review

The mandatory independent read-only reviewer found three valid issues:

1. Linux window managers may retain urgency after input unless the application explicitly clears `request_user_attention(None)`.
2. The first Rust test checked only the attention enum and did not exercise the attention-then-system-notification orchestration.
3. The English and Simplified Chinese Overlay overviews still listed the removed badge and tray-attention commands.

All three findings were accepted. The repair adds main-window show/focus clearing, routes the Tauri command through an injectable delivery orchestrator with a positive ordered-effects test, and replaces both stale command-table entries with the current `overlay_notification_send` contract. Post-repair verification is pending below.

Post-repair verification:

- The first repaired Rust compile exposed that Tauri's builder focus callback supplies `Window` while the explicit show path owns a `WebviewWindow`. The clear operation was moved into one generic closure-based error-reporting primitive used by both exact native window types; no fallback or duplicate lifecycle implementation was added.
- `cargo test --manifest-path packages/overlay/src-tauri/Cargo.toml`: passed all 55 tests after the repair. `native_message_delivery_requests_attention_before_system_notification` now executes the exact orchestrator called by `overlay_notification_send`, verifies accepted delivery, and verifies ordered `attention:Informational` then `system-notification` effects.
- `bun run script/run-unit-tests.ts test/desktop-notifications.test.ts test/notification-host-transports.test.ts test/host-transport-capabilities.test.ts`: passed all 9 focused tests again.
- `bun run docs:check`: passed again with 330 operations in 25 groups after both command tables changed.
- The second independent read-only review confirmed all three repairs, rechecked the complete task diff, residual definitions/call sites, retry/error behavior, UI removal scope, spec/indexes, and validation evidence, and reported **no unresolved findings**.
