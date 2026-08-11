# Clipboard API-key Provider Prompt

## Recall

| Item | Record |
| --- | --- |
| User request | Add system-clipboard reading. When the clipboard may contain a key, ask whether to configure a Large Language Model (LLM) API. |
| Acceptance | The native desktop reads plain clipboard text through the canonical host boundary after startup and when the app regains focus; structurally key-like content opens one visible confirmation; confirmation opens the existing Providers settings; dismissal does not repeat for the same candidate during the current app process. Clipboard content is never logged, persisted, sent to the backend, or inserted into a form automatically. |
| Hard constraints | Preserve unrelated dirty-worktree changes. Keep one HostTransport native-command authority. Use the existing App Dialog and Providers settings surfaces. Do not infer the provider or persist a secret-derived preference. Do not add or run UI automation. Validate UI with a real isolated desktop page and screenshots. Add focused positive non-UI contract tests. |
| Sources read | `AGENTS.md`; `specs/current/architecture/05-config.md`; `specs/current/architecture/06-provider.md`; `packages/transport-protocol/src/index.ts`; Overlay HostTransport/Tauri transport, App Dialog, Config Dialog, Providers panel, startup lifecycle, Tauri builder/capabilities/Cargo files; official Tauri Clipboard documentation. |
| Repository search | Existing clipboard use is paste/write-oriented; there is no native clipboard-read command or key-candidate detector. Provider credentials are saved only by explicit Providers-panel actions. `openConfigDialog("providers")` is the canonical navigation entry. |
| Independent agent feedback | None before implementation. A previously uninvolved read-only agent will review the completed diff and evidence after first-pass validation, as required by repository policy. |

## Analysis and impact boundary

### Observable gap

After a user copies an LLM API key outside OpenCorvus and returns to the desktop app, OpenCorvus has no system-clipboard read capability and provides no contextual route to Provider configuration. Existing paste handling only consumes an explicit Composer paste event, while existing clipboard helpers write diagnostics, paths, text, or images.

### Direct trigger and root cause

The missing trigger is native-window activation after the backend and Overlay settings surface are ready. Browser clipboard APIs are unsuitable for this lifecycle because background reads are permission/user-activation constrained and would create a second host-specific path. The architectural root cause is the absence of a clipboard-read member in the canonical `NativeCommand`/`HostTransport` contract and the absence of a secret-safe candidate classifier/orchestrator.

### Why existing paths do not solve it

- Composer `ClipboardEvent` handling is explicit input ownership and cannot observe a key copied before the app receives focus.
- `navigator.clipboard` helpers are write-oriented and do not provide a reliable desktop activation read contract.
- Providers settings owns credential selection and saving, but has no authority to monitor the operating-system clipboard.
- App Dialog can ask the question, but it must receive only a boolean classification result; passing the secret through dialog state would retain or expose it unnecessarily.

### Definitions, calls, public contracts, and data

The change affects the transport-protocol `NativeCommand` union and validator, the Overlay host capability matrix and Tauri dispatcher, the Tauri plugin/builder and command registration, a new pure classifier/orchestrator service, startup/focus wiring, and localized confirmation copy. It does not change HTTP/OpenAPI routes, Provider credential persistence, project/global config schemas, model selection, or backend logs.

The official Tauri v2 Clipboard plugin is the native implementation because it supports Windows, macOS, and Linux and exposes Rust `ClipboardExt::read_text`. OpenCorvus will call it behind its own existing Tauri command so business code continues to use HostTransport only. No JavaScript plugin package or parallel clipboard abstraction is introduced.

### Candidate contract

Classification returns metadata only:

- explicit credential assignment with an API-key/token variable name and a structurally opaque value;
- recognized LLM-provider key prefix with a structurally plausible suffix; or
- a single-line, bounded, high-entropy opaque token with mixed character classes.

URLs, UUIDs, PEM blocks, multiline prose, common source identifiers, and oversized clipboard content map to an explicit `not-candidate` result. The classifier never returns the candidate text. A non-persistent SHA-256 fingerprint is retained in a bounded in-memory list solely to avoid repeating the question for the same candidate in one process.

### Control flow

1. Install one lifecycle owner after the Solid application is mounted.
2. When the initial backend connection settles, and whenever the Tauri desktop window reports that it regained focus, schedule a coalesced check.
3. If the native command is supported, the app is ready, and no App/Config dialog is open, read clipboard text once.
4. Classify locally. For a candidate not yet prompted in this process, show the shared App Dialog without including the secret.
5. On confirmation, open the canonical `providers` Config Dialog. The user chooses a provider and explicitly pastes/saves the key using the existing credential path.

### Security and regression risks

- Clipboard reads are sensitive. The content must remain within the shortest-lived local call scope; errors must not interpolate or log it.
- Aggressive heuristics can annoy users. Structural exclusions, high-entropy requirements, one-process deduplication, and modal readiness checks bound false positives and interruption.
- A confirmation must not replace an existing question or permission dialog. Checks defer while any App or Config dialog is open.
- Browser-host behavior remains explicitly unsupported instead of silently using a permission-fragile fallback.
- Adding a native command must update the shared protocol validator, both host capability maps, the Tauri dispatcher, both Rust handler lists, and the Rust plugin initialization together.

Unknown before implementation: exact clipboard behavior under the isolated Windows WebView/Tauri runtime and whether the development environment has all native plugin dependencies cached. These require real native validation.

## Implementation plan

1. Extend the shared native-command protocol and Overlay capability/dispatch implementation with read-only `clipboard.readText`.
2. Initialize the official Tauri clipboard manager and expose a narrow Rust command returning plain text.
3. Add a pure clipboard key-candidate classifier and one lifecycle owner for startup/focus checks, modal deferral, in-memory deduplication, confirmation, and Providers navigation.
4. Add localized prompt copy and wire the lifecycle owner into `main.tsx` without overwriting existing adjacent edits.
5. Add focused non-UI positive contract tests for candidate classifications and host/protocol command coverage.
6. Run formatting, focused tests, typecheck, Rust checks, docs check, and production Overlay build. Then use a real isolated desktop runtime, place a synthetic non-secret candidate in the system clipboard, capture the prompt and Providers destination, and inspect both screenshots manually.
7. Ask a previously uninvolved agent for a read-only review of the complete diff and evidence; resolve all valid findings and rerun affected acceptance before committing and pushing only this task's files.

## Evidence log

- The native command was exercised in an isolated Windows Tauri process through the real WebView bridge. It returned the synthetic clipboard candidate as a 39-character string; acceptance output retained only length and prefix-match metadata, never the candidate value.
- Real startup exposed two lifecycle facts that were corrected before acceptance: a connected empty-project runtime can legitimately keep `appStore.config` null, so readiness now uses `appStore.connected`; browser `window.focus` is not the desktop authority, so focus checks now use Tauri `getCurrentWindow().onFocusChanged`.
- [Prompt screenshot](../../artifacts/2026-08-11-clipboard-api-key-prompt.png) shows the shared visible confirmation and explicit “Not now” / “Configure Providers” choices. The copy states that clipboard content is not saved, uploaded, or inserted automatically.
- [Providers screenshot](../../artifacts/2026-08-11-clipboard-api-key-providers.png) shows the canonical Providers settings destination after confirmation. Runtime inspection found zero non-empty password fields, confirming that the candidate was not inserted into a form.
- After dismissal, a real native minimize/restore/focus cycle read the same candidate but did not reopen the prompt, confirming in-process fingerprint deduplication. A different synthetic candidate did reopen it on native focus.
- Final focused tests passed: Overlay clipboard/classifier and HostTransport coverage reported 6 passes and 23 assertions; the complete transport-protocol contract reported 18 passes and 1,119 assertions.
- `bun run typecheck` passed for the Overlay. `cargo fmt --check` passed, and isolated `cargo check` completed against the final Tauri source and generated plugin schemas.
- The production Overlay Vite build passed with 7,104 transformed modules. `bun run docs:check` passed with 330 operations across 25 groups.
- Independent review found and closed two related lifecycle classes before delivery: the raw clipboard value now dies inside the read/classify/hash helper; App/Config/Session/Goal modal guards are re-evaluated at the final App Dialog opening boundary; each App Dialog epoch owns and releases a distinct native-surface occlusion; and a disposed clipboard owner can only dismiss its own visible prompt and cannot deduplicate or navigate afterward.
- A fourth read-only review of the corrected implementation reported no findings.
- A final isolated-window relaunch was attempted after the lifecycle corrections, but a parallel Release had already started its own OpenCorvus single instance; the new validation process exited instead of replacing or controlling that instance. The earlier real prompt and Providers screenshots remain the visual evidence because the later corrections changed ownership and async arbitration, not rendered copy or layout. The final corrected source passed the focused tests, Overlay typecheck, and production build.
- At delivery time the shared `main` checkout had advanced to `31f1dfcde` and diverged from `origin/main` (seven local commits ahead and forty remote commits behind). This task may create its bounded local commit, but repository policy forbids automatic merge, rebase, or force-push; a non-fast-forward push must remain explicitly blocked.
