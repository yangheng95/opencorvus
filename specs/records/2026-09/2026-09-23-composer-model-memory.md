# Remember the last Composer model

## Recall

- User: `现在每次新对话都要选择模型，就不能记住最后的模型吗`. New conversations should reuse the last explicit model choice, including after reopening the application. Existing conversations retain their own model.
- Acceptance: select a model, enter New Chat repeatedly and reopen the isolated page; the selection survives. Read an existing conversation with a different model and verify both that conversation's own value and the remembered draft value. Cover browser and native persistence contracts with focused positive checks and real page interaction/screenshots. Commit, merge upstream and push.
- Constraints: one existing settings persistence owner, no new local-storage key or global inference-config override, no UI automation tests, no user-process refresh/restart, no delegation or release.
- Read/search: AGENTS; panel, reactivity, configuration and provider architecture; Composer selector/service/store; all clear/project/select callers in init, workspace, task, main and conversation-session; settings store, browser storage, transport protocol and Rust settings owner; model creation/follow-up payloads; current native contract tests. Whole-repository composerModel search confirms one current-view projection. No UI-rendering tests found in these model/persistence paths. Composer draft-text tests are unrelated to the model preference and are not run or changed.
- Additional user request during investigation: investigate NVDA data-access failures by trying the actual search path. Keep its evidence and any independently necessary repair in a separate record.

## Cause and impact

`enterDirectoryFreeWorkspace` calls `clearComposerModelProjection`, which writes an empty string. `selectComposerModel` saves only the selected root Session config; a fresh draft returns immediately without persistence. Startup initializes the projection to empty. The previous per-Session ownership change correctly prevents one existing conversation from inheriting another's model, but supplies no durable new-draft preference.

The selected Session config remains inference authority. Add optional `lastSelectedModel` to the existing Overlay settings contract and native JSONC (JSON with comments) storage. This is a draft initialization preference, not a second Session configuration. Explicit successful choices update it; merely loading old Sessions does not. Empty/new workspace and startup read it. Existing first-submit payloads already carry the projected model. No backend inference routes, database schema, model catalog, task scheduling, queues, retries or occurrence lifecycle changes are needed. Persist failure must surface through the existing error path and restore the last confirmed preference; a successful Session write must remain visible even if saving the preference fails.

The settings payload has strict TypeScript and Rust validation, so both definitions must change together. Browser storage uses the same protocol. Optional absence represents a first-run user; no compatibility layer is introduced. Risk: asynchronous Session reads/writes could overwrite a newer choice or new draft. Retain existing projection generation/target ownership and track explicit selection intent separately from passive Session refresh.

## Plan

1. Extend the existing settings contract, defaults, load/save and native parser with the optional last choice; add focused serialization contract checks.
2. Restore the preference on startup and entry into an empty Composer. Save it after an explicit draft choice or successful Session model write; keep passive Session projection separate.
3. Build/typecheck and run focused protocol/native persistence checks plus docs checks. Use a separate source `/ui` server with credential-free model declarations for manual visual verification, then record evidence and commit/push.

## Verification

- Implemented optional `lastSelectedModel` through the existing protocol, settings store, browser storage and Rust settings serialization. Draft entry/startup restore it. Existing Session reads remain passive; explicit successful model selection records the preference, with the settings owner's confirmed-snapshot rollback on persistence error. Re-selecting the displayed model also counts as an explicit choice; removed the selector's previous early return.
- `bun test ./packages/transport-protocol/test/contract.test.ts --test-name-pattern 'last selected model'`: 1 passed, 3 assertions. `cargo test --bin opencorvus-overlay overlay_settings_saved_text_round_trips_through_jsonc_parser -- --nocapture`: 1 passed, including the exact native JSONC round trip. No native graphical application was launched.
- Overlay typecheck and real build/public-surface checker passed. Initial implementation had a duplicate local `model` identifier; it was corrected to `savedModel`, and both original checks were rerun successfully. Build was repeated after the selector refinement and passed. Existing bundle-size/third-party directive warnings remain.
- Real isolated source service: `http://127.0.0.1:17886/ui/`, runtime `.tmp/20260923-model-tools`. Manual browser interaction selected DeepSeek V4 Flash, entered New Chat, reloaded the independent page, and observed the same model in screenshots. After creating real independent NVDA Chat/Work conversations, selected Pro in a fresh draft, opened the older Chat and observed its own Flash model, then entered New Chat and observed Pro again. Screenshots were actually rendered and visually inspected in the tool transcript; no UI automation test, DOM assertion suite, fixture browser or pixel comparison was created or run.
- The same real-page send used the selected Flash model; canonical assistant records confirm exact `deepseek/deepseek-v4-flash`. Pro was selected only for preference verification and was not invoked. User's installed app/server on 7878 was not restarted, refreshed or modified.
- Final selector check: while the saved draft preference was Pro, opened the existing Flash Chat, explicitly re-selected its currently selected Flash entry, then entered New Chat. The displayed model became Flash, confirming the removed same-value early return. The host resized the final screenshot to a narrower crop; desktop layout acceptance is based on the earlier complete 1320-pixel screenshots, not a responsive-layout claim.
- `docs:check` and architecture-index passed. Full source review and final commit/push recorded at delivery. No installer, release or replacement of the running installed version is part of this task.
