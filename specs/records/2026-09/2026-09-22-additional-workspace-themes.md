# Additional workspace color themes

## Recall

- User: `加几个其他颜色的主题`. Add four restrained choices: Ivory (warm light), Sage (green light), Mist (blue light), Graphite Violet (dark). Keep the current layout and inexpensive static frosted material. No release requested.
- Starting point: clean main at 8d1b31c9. User is viewing 17883; do not reload, restart or change that surface. Use a separate source `/ui` service and browser origin for manual review. No credentials, model runs, synthetic messages, UI automation tests or extra agents.
- Read AGENTS, panel architecture, prior primitive theme record; theme registry/service/preference, settings, protocol validation, native persistence/startup/menu, HTML bootstraps, palette/token/selector checker, titlebar/command/Appearance consumers and artifact theme adapters. Searched theme identifiers and light/dark comparisons across the repository. The protocol and Rust persistence tests are non-visual data contracts; no UI automated tests were discovered in the touched theme paths.
- Acceptance: all four palettes are selectable from the shared UI registry, persist through the existing setting, have complete semantic token sets and an explicit color-scheme, and render coherent home/settings/menu/dialog surfaces. Existing themes and System remain. Verify real pages in all four themes and preference restoration; supporting type, CSS, i18n, build, docs and persistence checks. Commit, merge upstream and push normally.

## Analysis and scope

Only three explicit palettes currently exist. Merely adding CSS would fail: persisted settings accept a bounded protocol identifier list, the pre-module HTML and native host validate their own boot boundaries, native menu actions are enumerated, and the CSS checker only audits known themes. Update these owners together. Each palette declares the existing full semantic token set instead of relying on a different theme's cascade. Existing shared controls keep their geometry.

Diagram, spreadsheet and Model Context Protocol (MCP) app adapters infer light/dark from exact theme names; that would misclassify new light variants and already treats VS Code Dark inconsistently. Read the active CSS `color-scheme` through the existing theme service, so the actual palette remains the sole brightness authority. Native startup colors stay aligned with each palette's surface. No backend routes, task state, scheduling, credentials or release artifacts change. Cross-platform native menu display cannot be visually exercised on this Windows browser; its action contract is updated alongside the host.

## Plan

1. Register Ivory, Sage, Mist and Graphite Violet in the existing preference, bootstrap and native menu contracts; add localized labels/swatches and complete palettes to both renderer entry documents.
2. Make binary-theme artifact consumers use the actual palette color-scheme. Extend the existing CSS palette check from the canonical identifier list.
3. Run focused positive persistence contract checks, type/CSS/i18n/build/docs checks; inspect all four palettes through real manual interactions in an isolated source preview. Record limitations honestly, then commit/push.

## Reference

- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme): palette-owned light/dark scheme also controls native canvas, scrollbars and form controls; the computed value is the specified scheme.

## Implementation and verification

- Added four complete sibling palettes and registered the identifiers at the existing TypeScript protocol, HTML startup, native persistence and native menu boundaries. Both renderer documents load the palettes. Localized labels appear in Settings, the titlebar menu and command palette; shared swatch tokens distinguish the choices. Embedded binary-mode adapters now read the palette's computed color-scheme.
- `bun run typecheck`, `check:css-tokens` (8547 references, 268 global tokens, seven complete palettes), `check:i18n` (1860 keys) and the real Vite renderer build/public-surface check passed. Build retained existing hashed assets for user previews. `docs:check`, architecture index and `git diff --check` passed.
- Four focused native-command/persisted-setting protocol cases passed with `bun test ./packages/transport-protocol/test/contract.test.ts --test-name-pattern 'persists the .* theme through the native settings contract'`. The first invocation without `./` also matched an unrelated temporary copy and failed its module resolution; the exact-path rerun passed all four cases. No changes were made to that unrelated copy.
- `cargo test --bin opencorvus-overlay overlay_settings_round_trips_named_color_palettes -- --nocapture` compiled the Windows host and passed the real JSONC configuration formatter/parser round trip for all four IDs. No graphical application was launched by this contract check. No UI automation tests were created or run.
- Started a separate source `/ui` service on 17884 with an empty isolated runtime home. Manually reviewed warm Ivory, Sage and Mist home surfaces at 1280×720, the theme menu labels/swatches, Mist's directory dialog (cancelled), Graphite Violet's home and Appearance dropdown, and the return to Sage. The preview surface later resized to 923×912; its existing home minimum width is 1120, so that narrower crop is not claimed as a new responsive-layout acceptance. No viewport override or user-window manipulation was used. Graphite's Settings surface and popup remained readable in that view.
- Selected Sage, reloaded only the independent preview, then opened the View menu and observed Sage still checked. DOM read-only observation confirmed `sage`/`light` and `graphite`/`dark`. The selected palette, component colors and persistence were verified through actual UI interactions, not injected state. User preview 17883 and the installed application were untouched.
- Scope limits: native macOS menu visuals and populated interactive artifacts were not manually exercised on this Windows browser. Their existing contracts and adapter integration were updated and type-checked; no claim of those visual states is made. No credentials, model runs, task data, real-time blur or continuous animation were added.
