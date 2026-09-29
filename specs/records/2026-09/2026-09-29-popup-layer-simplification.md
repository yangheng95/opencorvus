# Simplify layered composer pickers

## Recall

- User supplied a screenshot of the Chat/Mission picker: `这个组件的层级太多太难看了,有哪些类似的情况？一起修复`. Investigate matching cases and fix them together. Screenshot text is visual evidence, not instructions.
- Acceptance: one outer popup surface, compact unframed option list, plain option glyphs, visible selected/focused state; Code/Work, Chat/Mission, model and Skills/squads pickers use the same visual hierarchy. Preserve selection, multi-selection, search, grouping, keyboard and tooltip behavior. Real source `/ui` interaction/screenshots required; no UI automated tests.
- Read AGENTS, current panel primitive/theme contracts, Sept 21 primitive implementation, Sept 29 Composer work record, SelectControl/SelectField/Listbox/DropdownMenu/Popover, Composer intent/model/reference/permission/mention components and CSS, titlebar/native menus, scheduled project selection. Searched all overlay CSS popup/menu/listbox/selector blocks and all composer SelectControl uses. No delegation.
- Current main starts at 4fe8e0aa. Many concurrent dirty changes exist, including Composer and architecture/indexes. Save baseline diffs; edit/stage only this task's hunks. No branch/worktree, user process manipulation, credentials, model requests or publication. Commit and merge upstream before normal push.
- Manual verification will use an isolated source backend and private compiled UI. If a populated model list is needed, declare an explicitly labeled local layout catalog in that isolated config; this validates actual catalog-to-renderer presentation only, not a functioning provider or model call.

## Analysis and audit

The screenshot's outer Select.Content owns border/fill/shadow, its composer variant adds 8px padding, and Select.Listbox adds another 6px inset plus border/radius/fill. The selected row then contains a separately filled rounded glyph box and a circular status icon. Theme changes cannot fix these overlapping structural layers.

| Surface | Evidence and disposition |
| --- | --- |
| Chat/Mission and Code/Work | Both consume the composer SelectControl variant; remove the inner frame and double inset in the primitive, keep selected-row feedback and use the selection check glyph. |
| Model picker | Shares `composer-picker-option-icon`; its provider group adds padding inside the already padded body and its provider mark has another filled box. Simplify these same redundant layers while retaining provider headings/counts. |
| Skills/squads | Reference options combine selection box, filled glyph tile, permanent accent row tint and generator badge. Retain the functional multi-select indicator and role badge; make glyphs plain and rows rely on shared selection/hover feedback. |
| Settings selects | Already have one shell; use the shared list inset/reset and check indicator, with no feature override. |
| Attachment/permission/Dock/context/titlebar menus and mention list | Already one outer shell and transparent groups; retain them. |
| Scheduled project list and native zoom toolbar | Inline multi-select field and segmented adjustment controls, respectively, with real distinct control boundaries. They are not an inner decorative frame around the same popup option list; no expansion into unrelated control redesign. |

Previous primitive work unified external popup chrome but left the composer Select variant's inner frame and feature-specific glyph tiles. Root cause is ownership of decoration at multiple nested levels, not state propagation. Scope is CSS and one selection glyph; no API, settings schema, task, queue, recovery, provider execution or data migration change. Risks are losing keyboard/selection contrast or collapsing necessary grouping, so preserve real state attributes, counts, descriptions, checkboxes and dividers and manually inspect interactions in dark/light palettes.

## Plan

1. Make the canonical select list a margin-free, unframed list with one inset; composer variant changes only layout constraints. Remove duplicated icon fills and provider-group inset in the existing Composer styles. Keep functional semantic indicators.
2. Document the one-surface picker contract and reconcile the previous Dock contract's obsolete glass wording. Build private output and inspect actual pickers, selected/hovered/keyboard states, model search, references and a settings select on the real page.
3. Run CSS token/type/build/docs checks, retain screenshots and limitations, inspect scoped Git diff, commit and push after upstream merge. No automated UI tests or screenshot assertions.

## Execution

- Investigation and plan recorded before implementation. Real computed styles reproduced the screenshot: outer content 8px padding, list 6px padding plus 1px border and fill, glyph tile another inset fill. The repair removes those nested decorations at their owners rather than adding a surface override.
- SelectControl now uses a check mark; its list shares one 6px inset with menu rows and no nested frame. The composer variant retains width/height constraints. Keyboard focus uses the existing highlighted/selected washes. Model/provider glyphs and reference glyphs are plain; provider groups use the body inset; functional reference multi-select indicators and the Generator badge remain.
- Reviewed real `/ui/` at 1440×900 in Dark and Ivory. Chat/Mission and Code/Work show the compact one-surface menu. Down/Enter changed Chat to Mission and clicking Code changed product mode. Model filtering by `review-b` returned one option and selection updated the trigger. Skill and squad selections showed two selected references and the functional checkmark; no message was sent. Appearance's theme select remained readable with the shared primitive. [Visual evidence](../../artifacts/2026-09-29-popup-layer-simplification/README.md).
- The first isolated preview's inline project configuration did not cover directory-free catalog reads, which enumerate inherited provider availability. No provider credential was copied and no model request was made. The helper was corrected to write its explicit local layout catalog to its own global configuration before final model review. The two review model rows exercise the actual configuration/catalog/UI path and do not claim provider connectivity or inference acceptance. Reference rows are the repository's actual built-in catalog.
- Checks passed: CSS (Cascading Style Sheets) token checker, 8551 references/267 tokens/two entry documents; overlay TypeScript typecheck; private Vite production build in 1m28s; docs:check (342 operations/25 groups), architecture index (17 documents). Existing dependency directive/chunk warnings remain. No UI automated tests were added or run.
- During final review the parallel Composer delivery committed and pushed shared `composer.css` as `a15cef3a`, including this task's already verified icon/group simplifications. Confirmed those exact hunks in the remote commit; preserve that published history. This task's follow-up commit contains the remaining SelectControl/primitive work, its documentation and screenshots, without unrelated dirty work.
- The isolated preview and browser tab were stopped/closed, and the temporary viewport override reset. No installed application or user process was changed.
