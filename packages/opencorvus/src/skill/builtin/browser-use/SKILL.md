---
name: browser-use
description: Research and operate rendered web pages through OpenCorvus Browser tools, including authenticated workflows and visual inspection.
---

# Browser Use

Use Browser tools for rendered web state and interactions. Use native Computer tools for desktop interfaces outside the page. All names below are local tool names within the current Browser provider; use the callable names actually exposed by your harness.

## Initialize and retain identity

`session_create` returns `sessionId`, `profileId`, `browserMode` and `liveViewUrl`. Retain these exact values. Chrome DevTools Protocol (CDP) mode uses the current Chrome login environment but creates a tool-owned tab; isolated mode creates a separate browser environment. Configuration selects the mode. A launch/debugging error is not permission to change it or attach another browser.

Use `navigate` with the intended URL, then `observe` to inspect the current page. `tabs` manages only tool-owned tabs; selection returns the `sessionId` that subsequent calls must use. Reuse `profileId` only when another tab should share that environment. User-owned tabs are not part of this tab inventory.

## Ground actions and verify useful boundaries

`observe` combines a screenshot, URL/title, a bounded Document Object Model (DOM) summary and diagnostics. Its text/element list is a sample, not a complete inventory, and suggested selectors may match several elements. Choose targets from current page evidence; use `count`, scoped selectors, `get_attribute` or a targeted read when needed. Never invent selectors from a desired label.

Prefer a grounded selector for normal page controls. Use viewport coordinates for visual targets. After scrolling, navigation, a dialog or layout change, obtain fresh evidence before choosing new coordinates. `hover` can reveal menus/tooltips; inspect the result when that changes the intended target. Scrolling uses pixel deltas at a viewport point.

Keep predictable actions together when the callable tool interface supports ordered execution. Observe at decision boundaries and inspect the final result; there is no universal requirement to screenshot after each input. Keyboard tools act on current focus, so establish the intended field first. `type` replaces the field value, including when `clear` is false; `clear` only controls the preliminary clear step.

## Diagnose instead of guessing

- A blocked coordinate interaction returns target/nearby evidence. Re-observe and correct the target. `force:true` is only for an intentionally chosen raw-coordinate action supported by current evidence, never an automatic retry strategy.
- For selector ambiguity or absence, inspect the current state and refine the selector. If an iframe owns the target, inspect `frames` and use the exposed frame tools.
- For a closed page or disconnected session, use `session_status` when exposed and read the exact result. Create a new session only after confirming the old one is unavailable; reestablish navigation/login state deliberately. Never replay submissions after a timeout without checking their actual outcome.
- Use `diagnostics_get` for page/network failures and the specific wait tool for an expected transition. Repeating the same call without new evidence does not diagnose it.
- `evaluate` executes a page expression, not a host script or a Playwright Page API. Use it for targeted inspection or an explicitly intended page operation; direct DOM/storage changes are not evidence that a user interaction worked.

Respect task authorization for forms, uploads, downloads and external effects. Inspect actual screenshots for visual claims. `session_destroy` closes the tool-owned tab; in isolated mode, the final tab normally releases its login environment. `help` reloads these instructions without launching or changing a browser.
