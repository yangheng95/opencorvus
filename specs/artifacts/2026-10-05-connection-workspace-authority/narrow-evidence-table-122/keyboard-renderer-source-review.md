#122 keyboard renderer independent source review

## Recall / evidence

Root-owned focused renderer release follows actual after02 keyboard failure, not a source-only guess. Read122 plan final release, complete current markdown utility and CSS diff, installed Marked17.0.1 declarations and Renderer.ts source-map content, all current call sites; personally viewed after02/root-table-narrow-left.png. The screenshot shows retained native evidence rows/identifiers with right column outside the narrow visible area; it cannot itself prove Tab handling. Root's separate actual clicked-header BODY→Tab Copy message/table tabIndex-1 observation is the keyboard failure authority. No parser/test/build/UI/service/DB/model/Git action and no123 source edits here.

## Source conclusion

No concrete source blocker found. markdown.ts167–173 adds only table renderer at the existing marked.use owner. It renders original header and body cells with this.tablecell, each row through this.tablerow, preserves thead/tbody conditional body, and emits native table tabindex0. Installed marked.d.ts186–188 exposes these exact APIs. Actual Renderer.ts source reproduces the same loops and same header/body composition; tablecell consumes original inline tokens, header flag and alignment. Consequently inline links/escaping/code and current alignment remain owned by the mature renderer, rather than table text matching or another parser. No wrapper state, event scroll writer, cache key, response ownership or model-message change.

CSS sole native table policy uses block/max-content/max-width100/overflow-x:auto with normal word-break/wrap, avoiding the prior inconsistent md-content-only rule and late blanket width100. focus-visible uses current border/accent/ui-scale with a negative offset inside the scroll box. Native table/row/header/cell elements remain present; display:block does not by source alone prove every assistive browser's AX behavior, but actual after02 preserved the roles before tabindex change. Extra focus stop applies even to tables that do not overflow; this is a deliberate shared keyboard availability tradeoff, not proven bug. Native browser ArrowRight/End behavior and focus outline pixels require Root fresh after03, not this review.

## Whole current callers and limits

The same parser renders TextPart worker tokens via markdown-render.worker.ts39, direct InteractionCard body, ArchitectPanel decision/reason/summary, dialog conversation text, ExpertSquadPanel descriptions and ReleaseNotes content. InlineToolPart only imports code rendering, whose generated code blocks do not become table tokens. renderMarkdown uses existing locale/source cache; worker renderMarkdownToken uses existing Marked parser. Both reach the one renderer. Raw HTML is escaped by the existing html renderer, so the new table focusability concerns actual Markdown table tokens rather than arbitrary model HTML injection. InlineMarkdown has no block table parsing. Interactive table artifacts remain a separate component.

Existing cache may retain HTML only within its current runtime; fresh built asset/worker execution is needed to qualify the new renderer, as Root plans. No runtime dynamic registration or stale-reply owner was added. Original source clipping/sanitization and locale dependencies are unchanged and not requalified by a keyboard fix.

## Required actual remaining acceptance

Fresh same completed116 history after03: natural Tab reaches actual table with visible focus, native horizontal keys expose the last evidence column while outer viewport remains readable; actual header/row/cell AX roles and all identifier associations survive. Pointer scrollbar, Sources, prose/code and child380/280 remain manual matrix. Release notes/settings/dialog/Interaction/Architect and live appended tables are shared source impact but unknown real pages here. Retain after02 failure; no generic DOM/render/snapshot/source UI tests are admissible or executed. Source review passes within these limits and is not a visual after pass.123 generator/test files remain frozen.
