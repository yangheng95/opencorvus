# Composer picker visual review

Manual interaction and screenshot inspection on the real isolated source `/ui/`
at 1440×900. These are visual evidence, not automated screenshot baselines.

| Case | Evidence |
| --- | --- |
| User's Chat/Mission report | [User screenshot](user-reference.png) |
| Revised menu detail | [After](after-menu-detail.png) |
| Dark Chat/Mission before / after | [Before](before-chat-menu.png), [after](after-dark-chat-menu.png) |
| Dark Code/Work | [After](after-dark-product-menu.png) |
| Dark model grouping | [Before](before-model-menu.png), [after](after-dark-model-menu.png) |
| Dark references | [Before](before-reference-menu.png), [plain glyphs](after-dark-reference-menu.png), [selected](after-dark-reference-selected.png) |
| Ivory Chat/Mission | [After](after-ivory-chat-menu.png) |
| Ivory model selection | [After](after-ivory-model-selected.png) |
| Ivory settings SelectControl | [After](after-ivory-settings-select.png) |

Chat/Mission and Code/Work now have one enclosing frame, one inset, a plain glyph
and a check mark. Model and reference lists keep provider/category headings and
functional selection feedback without additional icon tiles or provider-group
padding. Keyboard Down/Enter selection, model ID filtering and reference
multi-selection were operated on the real page.

The final model catalog is an explicitly configured local layout catalog with
two review entries, so before/after model rows differ. It is not evidence of
model inference or provider connectivity. No model calls or messages were sent.
Concurrent Composer width changes are visible outside the reviewed menus and
remain outside this task's commit. No native host menu behavior changed.

See [analysis and scope](../../records/2026-09/2026-09-29-popup-layer-simplification.md).
