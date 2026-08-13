# Browser MCP Live View

## Recall

| Item | Record |
| --- | --- |
| User request | Identify what the current Browser MCP lacks compared with Browser Use, then close the largest gap: the user cannot see the web page while the agent operates it. Investigate mature open-source frameworks that provide MCP browser automation. |
| Acceptance metrics | A local Browser MCP run opens the exact agent-controlled Chromium as a visible window by default; every newly created session returns a local `liveViewUrl`; the URL presents the same Playwright page and follows its actions without creating another browser; headless environments retain an explicit supported configuration; the real page and Live View are visually inspected. |
| Hard constraints | Preserve one Browser MCP and one Playwright session authority; do not introduce a second browser/runtime or a fallback path; do not add or run UI automation tests; use real-page screenshots and human visual inspection; add focused positive non-UI coverage; preserve unrelated dirty-worktree changes; independently review the final diff before commit. |
| Sources read | `AGENTS.md`; `specs/current/architecture/04-extensions.md`; `packages/opencorvus/src/mcp/browser/{builtin,index,monitor,sessions,screenshot,tools}.ts`; Browser runtime and node-sidecar launch code; Overlay Browser Preview code. |
| Repository search | Browser MCP has 45 low-level tools and already owns session/profile/tab/storage/diagnostic/screenshot state. `monitor.ts` already renders screenshots and tool calls, but it is reachable only from the explicit HTTP transport. The built-in projected Browser MCP uses stdio, so its users never receive or can reach the monitor. `sessions.ts` also defaults `BROWSER_HEADLESS` to true, so the normal local runtime hides the actual browser window. The Overlay Browser Preview is a separate task-target preview surface and is not connected to Browser MCP sessions. |
| External research | Microsoft Playwright MCP is the closest mature open-source reference: it uses Playwright, opens a headed browser by default, and supports persistent/isolated/CDP/extension modes. Browser Use exposes headed/real-Chrome/CDP/cloud modes and its Cloud sessions expose a live URL. Steel provides an open-source browser-session viewer but would add an entire parallel browser service. Browserbase also provides Live View but is hosted infrastructure. |
| Independent agent feedback | None before implementation. A separate read-only delivery review is required after first-pass verification. |

## Analysis

### Observable symptom

The agent can navigate, click, type, scroll, and capture screenshots through Browser MCP, but the user cannot continuously watch the controlled page during a normal OpenCorvus Task.

### Direct trigger

The canonical built-in server launches through stdio. Only `serveHttp()` routes `/monitor`, while `serveStdio()` starts no monitor listener and the MCP session contract publishes no viewer address. Independently, browser launch evaluates `BROWSER_HEADLESS !== "false"`, making hidden Chromium the default.

### Data/control-flow root cause

The Page is correctly owned by `sessions.ts`, and the existing monitor correctly reads that Page. The missing link is publication and lifecycle ownership: stdio does not start the monitor beside its MCP server, and session creation cannot derive a viewer URL. The hidden default then removes the simpler same-machine observation surface as well.

### Why the old path did not solve it

The monitor was implemented as an HTTP-transport diagnostic page. The production built-in projection continued to use stdio, so the monitor and the actual Task path never met. Screenshots returned to the model are evidence attachments, not a user-facing continuous view. Overlay Browser Preview renders task-selected URLs in its own WebView and cannot truthfully display the Browser MCP Page.

### Impact surface

- Definitions: Browser MCP transport lifecycle, monitor route, session/tool output schemas, browser launch visibility configuration.
- Callers: built-in stdio projection and explicit HTTP CLI transport.
- Public contract: `session_create`, `storage_state_import`, and tab results publish `liveViewUrl` where a live Page exists.
- Tests: focused positive tests for visibility configuration and viewer URL construction; no UI automation.
- Documentation: current MCP architecture and this record.
- Delivery risk: headed Chromium requires a graphical display. Server/CI owners must set `BROWSER_HEADLESS=true`; the local Live View remains the observation surface in that mode.
- Excluded: replacing Browser MCP with Browser Use/Playwright MCP/Steel; remote streaming, browser takeover, VNC, cloud anti-bot infrastructure, and Overlay Browser Preview integration.

## Decision

Use the existing Playwright Page as the only live state and add two complementary presentations:

1. Browser MCP is headed by default, matching Microsoft Playwright MCP's local interaction model. `BROWSER_HEADLESS=true` is the explicit deployment setting for displayless environments.
2. Both stdio and HTTP transports own a loopback monitor server. Stdio uses an ephemeral port. The monitor origin is injected into the MCP tool registry, and session-producing tools return a session-selected `liveViewUrl`.
3. The existing monitor remains read-only and polls screenshots/tool history from the same Page. It auto-selects the URL's session and refreshes often enough to function as Live View; it does not create, navigate, or mutate a browser.

## Verification plan

1. Run focused positive Browser MCP contract tests and TypeScript typecheck for the touched package.
2. Start the real stdio Browser MCP, create a session over MCP, navigate and interact with a local deterministic page, and verify the returned `liveViewUrl` responds.
3. Open the returned URL in a real browser, capture screenshots before and after an MCP action, and visually confirm that the displayed controlled page changes.
4. Ask an uninvolved agent to review this spec, the complete diff, tests, evidence, documentation, and regression risk. Resolve every valid finding and repeat review if implementation changes.

## Delivery record

Implemented the headed-by-default launch policy, loopback Live View ownership for stdio and HTTP transports,
session-selected `liveViewUrl` publication, script-safe session selection, one-second monitor refresh, and a manual
real-MCP checker. The checker successfully created a real Playwright session, navigated to a deterministic local page,
returned its Live View URL, executed an MCP click, read back `MCP click observed live`, and exited without leaving the
browser running. The before/after visual inspection confirmed the same page changed and the monitor appended the exact
`click` and `get_text` tool calls; final evidence is
[`2026-08-13-browser-mcp-live-view.png`](../../artifacts/2026-08-13-browser-mcp-live-view.png).

The first independent delivery review found four issues: explicit HTTP transport was not bound to loopback; the
monitor's inline session click handler could treat an adversarial page URL as JavaScript; popup-adopted sessions omitted
their Live View URL; and stdio shutdown did not guarantee every resource received a close attempt. All four were fixed.
The monitor now uses button data plus event listeners and text-only URL projection, HTTP binds `127.0.0.1`, every adopted
popup returns its session-selected Live View, and stdio caches one all-settled shutdown operation. The real checker was
rerun through click, popup adoption, per-popup Live View publication, and clean exit.

The second independent review found one synchronous re-entry window: the SDK transport can fire `onclose` while
`transport.close()` is being evaluated, before the shared shutdown Promise was assigned. Shutdown now publishes a
microtask-deferred shared Promise first, then detaches `onclose` and closes every resource.

The final review initially questioned whether the Model Context Protocol (MCP) SDK overwrote the registered transport
close hook. Inspection of the pinned SDK showed `connect()` preserves and invokes the existing hook before its protocol
cleanup, and the real client disconnect exited naturally. The reviewer withdrew that finding and reported no unresolved
issues.

Focused Live View contract tests and package TypeScript typecheck passed. The broader pre-existing
`browser-mcp-node-bundle.test.ts` could not complete under its fixed five-second timeout: after the declared test-runtime
preparation it still hit the Windows process-supervisor settlement race (`settled.json` absent). Direct production-style
entry bundling and the real Node stdio MCP round trip passed, so this runner defect does not hide the changed runtime path.
