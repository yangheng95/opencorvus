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

## Follow-up: system Chrome and explicit CDP attachment

### Recall

| Item | Record |
| --- | --- |
| User requirement | Show Browser MCP work directly in Chrome, make the default path a CDP page, and operate with the login state of the Chrome the user already opened. |
| Acceptance | With no endpoint configured, resolve the running stable Chrome channel from its default profile's `DevToolsActivePort`, attach to its existing default context, create only an MCP-owned visible tab, publish CDP mode/product, and disconnect without closing Chrome or unrelated tabs. Setting `OPENCORVUS_BROWSER_CDP_ENDPOINT` connects to that explicit endpoint with the same ownership rules. A missing Chrome authorization produces a stable actionable diagnostic rather than launching a second browser or falling back. |
| Hard constraints | Preserve one Playwright Page/Context fact source and the existing Live View; do not add a parallel browser runtime, hidden fallback, browser extension implementation, or host-side workflow gate; the user must explicitly enable Chrome remote debugging because this grants access to the signed-in browser. All LLM-facing MCP interactions remain streaming. |
| Read repository material | `packages/opencorvus/src/browser/runtime/index.ts`, `packages/opencorvus/src/mcp/browser/{sessions,tools,index}.ts`, the first-phase implementation and tests, and `specs/current/architecture/04-extensions.md`. |
| Repository search | `BrowserRuntime.findBrowserExecutable()` already prioritizes installed Google Chrome on Windows and Linux and the installed Chrome application on macOS, then falls back to Edge/Chromium candidates. The missing capability is CDP connection and ownership-aware cleanup. Existing profiles always call `context.close()`, which is correct for MCP-created incognito contexts but unsafe for an attached browser's default context. |
| Authoritative research | Current Playwright MCP documents `--cdp-endpoint=chrome`: after the user enables “Allow remote debugging for this browser instance” at `chrome://inspect/#remote-debugging`, it resolves the default Chrome profile's `DevToolsActivePort` and attaches without special launch flags. Its Playwright Extension is the mature alternative for user-selected tab authorization and reuses cookies, sessions, and installed extensions, but requires installation and a separate relay protocol. Chrome 136+ blocks remote-debugging command-line switches against the default data directory; the in-browser authorization path is the supported way to expose the already-running daily profile. |
| Independent agent feedback | The read-only review found a CDP profile-lock re-entry on setup failure, adoption of unrelated default-context pages, credential-bearing endpoint leakage through derived Playwright errors, a host-dependent Chrome test, and an ignored visual artifact. The implementation and delivery were corrected, then rechecked. |

### Analysis and decision

The directly visible default was partly present already: on this Windows host the first executable candidate is the
installed `Google Chrome\\Application\\chrome.exe`, and the first phase made it headed. Its MCP result, however, did not
publish which runtime was selected, so clients could not distinguish system Chrome launch from attachment.

For attachment, merely replacing `chromium.launch()` with `connectOverCDP()` would violate resource ownership. A launched
browser uses MCP-created incognito contexts, while a CDP browser exposes an external default context that Playwright says
cannot be closed independently. The current last-session and shutdown paths unconditionally close contexts, so a naive
connection would either fail cleanup or interfere with the external Chrome session.

Use one connection selector and one attached-profile model:

1. With no CDP endpoint, resolve the stable `chrome` channel's default profile directory, read only its
   `DevToolsActivePort` rendezvous file, and connect Playwright over CDP. The user explicitly enables remote debugging in
   the already-running Chrome once. Browser MCP then uses that Chrome account, cookies, site login state, and extensions.
   It never launches a second Chrome as an implicit fallback.
2. With `OPENCORVUS_BROWSER_CDP_ENDPOINT`, connect once through Playwright Chromium CDP and reuse its single default
   context as one attached profile. Each MCP session still creates and owns a new visible tab so it cannot silently adopt
   or mutate an unrelated existing tab.
3. Cleanup closes only registered MCP pages and detaches the Playwright transport; it never closes the external context
   or Chrome process.
4. `session_create` publishes `browserMode` and `browserProduct` alongside the existing `liveViewUrl`. No runtime fallback
   is allowed: unavailable channel authorization or an explicit endpoint connection failure returns a typed connect error.
5. For users who do not want to authorize their daily Chrome, `OPENCORVUS_BROWSER_MODE=isolated` explicitly selects the
   existing BrowserRuntime launch path. It opens a visible, clean browser and preserves the original per-context options;
   it is a selected operating mode, never an automatic response to a CDP failure.

### Follow-up delivery evidence

The initial headed-launch checker resolved `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`, opened an
independent visible Chrome window, and executed the MCP click. Window-level visual inspection showed the Chrome frame,
local acceptance URL, and the resulting
`MCP click observed live` state; evidence is
[`2026-08-13-browser-mcp-google-chrome.png`](../../artifacts/2026-08-13-browser-mcp-google-chrome.png).

For CDP acceptance, a separate Chrome process was started with a dedicated non-default test profile and loopback remote
debugging endpoint. The real stdio MCP returned `browserMode: "cdp"`, created its primary Page and popup under the same
profile ID, and published both Live View URLs. A deliberately invalid viewport forced first-session setup failure; a
valid session immediately succeeded afterward, proving cleanup does not re-enter the attached-profile lock. An unrelated
page was then created through the external CDP endpoint: it remained absent from MCP `tabs`, while the popup from the MCP
source page was adopted. After normal MCP exit, the attached Chrome endpoint remained responsive, both MCP-owned pages
were closed, and the unrelated page plus the pre-existing blank page remained. This proves shutdown detaches without
closing the external BrowserContext or Chrome process and does not claim or close external pages.

The independent review also required CDP connection failures to expose a stable actionable
`browser_connect_failed` diagnostic without propagating credential-bearing endpoint URLs, exact use of both lines in
Chrome's `DevToolsActivePort` rendezvous, deterministic browser-candidate ordering, and isolated launch args that do not
inherit the host process proxy. The public tool descriptions now distinguish settings supported only by isolated mode
from Chrome CDP's existing-context behavior. CDP attachment may use existing site sessions inside its pages, but
`storage_state_export` now returns the stable `STORAGE_STATE_EXPORT_UNAVAILABLE` contract rather than exposing the daily
Chrome context's complete cookies and localStorage to the MCP client.

After the user clarified that the default must use the Chrome they already opened, the managed persistent-profile design
was replaced rather than retained as a parallel implementation. The default now follows Playwright MCP's current Chrome
channel mechanism: it reads the default profile rendezvous and attaches after the user enables remote debugging in the
Chrome they are already using. An attempted convenience opener was removed after real validation showed that launching a
`chrome://` URL can display the Profile Picker in multi-profile Chrome, which is neither deterministic nor safe. The typed
failure instead returns the exact settings URL and the explicit isolated-mode switch. A separate extension was not added;
the Microsoft Playwright Extension remains the mature alternative when per-tab selection is preferred. The explicit
`isolated` mode was real-MCP checked in headed Google Chrome: it returned `browserMode: "isolated"`, navigated the local
acceptance page, executed the click, observed `MCP click observed live`, and exited cleanly.

The final default-channel acceptance launched a real Google Chrome against a disposable directory shaped as its stable
default profile, let Chrome publish the two-line `DevToolsActivePort` rendezvous, and ran the production-style Node stdio
bundle with no explicit CDP endpoint. Browser MCP returned `browserMode: "cdp"` and `browserProduct: "Google Chrome"`,
navigated and clicked the acceptance page, observed `MCP click observed live`, and detached while the external page
remained. A second real CDP run kept an external sentinel page beside the MCP primary page and popup, proved the only
listed/selected indices were the contiguous MCP-owned `[0, 1]`, and confirmed CDP storage export returned its safe typed
error. Shutdown now waits for in-flight session operations before closing profiles, so a popup is either adopted and then
closed as MCP-owned or closed immediately if adoption fails. Shutdown freezes global tool admission, closes registered
and pending-owned pages to cancel even nonsettling Playwright work, drains those operations, then performs a second pending
page sweep before detaching. The host CLI launcher closes the sidecar stdin and retains a 310-second emergency window
before process-tree termination. Session creation also checks the shutdown state before and after browser acquisition and
page creation, so an already admitted late create cannot escape the first cancellation sweep. Focused 18 contract tests,
package
TypeScript typecheck, documentation checker, production-style Node bundle,
real isolated/CDP/default-channel checkers, and `git diff --check` passed. The final read-only review reported no
unresolved findings; the ignored screenshot was added explicitly and all task-local Chrome profiles were removed.
