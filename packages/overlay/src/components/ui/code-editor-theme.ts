// ── CodeMirror theming and citation reveal ──
//
// `basicSetup` bundles `syntaxHighlighting(defaultHighlightStyle, {fallback:true})`,
// a light-only palette (#219 / #a11 / #708 / #940 …). Rendered on the overlay's
// dark surfaces those tokens sit at roughly 1.2:1 contrast, so an ordinary
// source file reads as an empty document — which is exactly how a citation jump
// looked when it landed. The base theme's caret has the same problem
// (`border-left: 1.2px solid black`; its dark variant only applies to themes
// that declare `dark: true`, and we serve light, dark and vscode-dark from one
// build).
//
// Both are fixed by driving CodeMirror from the design tokens instead: the
// `--oc-syntax-*` palette already themes highlight.js in rendered markdown, so
// reusing it also makes the editor and the message code blocks finally agree.
// A registered highlighter displaces the fallback one, so `basicSetup` keeps
// contributing everything else it brings.

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"
import { tags } from "@lezer/highlight"

export interface CodeEditorLineRange {
  startLine: number
  endLine: number
}

/** Where a reveal should land once the document is known. */
export interface CodeEditorRevealTarget {
  /** 1-based line the cursor lands on, clamped to the document. */
  anchorLine: number
  /** 1-based last line of the cited range, clamped to the document. */
  endLine: number
  /**
   * Whether the document already contains the cited start line. A reveal
   * computed against a document that is still loading is deliberately *not*
   * final, so the caller must re-run it — never latch it — once text arrives.
   */
  settled: boolean
}

// A whole-file citation (a plain `read` of a short file cites lines 1..N) points
// at nothing in particular, so it gets a cursor and a scroll but no banded
// highlight. Longer bands are capped: decorating six figures of lines to mark
// "the file" costs a frame and communicates nothing.
const REVEAL_HIGHLIGHT_LINE_LIMIT = 400

/**
 * Clamp a cited range onto a concrete document. Returns null when there is
 * nothing to reveal (no range, or a malformed one).
 */
export function resolveRevealTarget(
  documentLines: number,
  range: CodeEditorLineRange | undefined,
): CodeEditorRevealTarget | null {
  if (!range || !Number.isInteger(documentLines) || documentLines < 1) return null
  const { startLine, endLine } = range
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return null
  if (startLine < 1 || endLine < startLine) return null
  return {
    anchorLine: Math.min(startLine, documentLines),
    endLine: Math.min(endLine, documentLines),
    settled: startLine <= documentLines,
  }
}

/**
 * The line band worth highlighting for a reveal, or null when the range says
 * "this whole file" or is too large to mark usefully.
 */
export function revealHighlightLines(
  documentLines: number,
  target: CodeEditorRevealTarget,
): { fromLine: number; toLine: number } | null {
  if (target.anchorLine === 1 && target.endLine >= documentLines) return null
  if (target.endLine - target.anchorLine + 1 > REVEAL_HIGHLIGHT_LINE_LIMIT) return null
  return { fromLine: target.anchorLine, toLine: target.endLine }
}

const revealLineDecoration = Decoration.line({ class: "cm-oc-reveal-line" })
const setRevealedLines = StateEffect.define<{ fromLine: number; toLine: number } | null>()

const revealedLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setRevealedLines)) continue
      if (!effect.value) return Decoration.none
      const builder = new RangeSetBuilder<Decoration>()
      const { fromLine, toLine } = effect.value
      for (let line = fromLine; line <= toLine; line += 1) {
        const start = transaction.state.doc.line(line).from
        builder.add(start, start, revealLineDecoration)
      }
      return builder.finish()
    }
    // The band marks where a citation pointed at the text as it was read; once
    // the text changes underneath it the claim no longer holds.
    return transaction.docChanged ? Decoration.none : decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

/** State effect a reveal dispatches to band (or clear) the cited lines. */
export function revealLinesEffect(band: { fromLine: number; toLine: number } | null): StateEffect<unknown> {
  return setRevealedLines.of(band)
}

/**
 * Tag → token mapping. Colours are `var()` references so one extension serves
 * every theme; anything unmapped inherits `--text`, which keeps punctuation and
 * operators legible instead of pushing them into a token colour.
 */
export const overlayHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword, tags.controlKeyword, tags.definitionKeyword], color: "var(--oc-syntax-keyword)" },
  { tag: [tags.moduleKeyword, tags.self, tags.null], color: "var(--oc-syntax-keyword)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape], color: "var(--oc-syntax-string)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "var(--oc-syntax-comment)", fontStyle: "italic" },
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.atom, tags.literal], color: "var(--oc-syntax-number)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName, tags.labelName], color: "var(--oc-syntax-function)" },
  { tag: [tags.variableName, tags.propertyName, tags.attributeName, tags.definition(tags.variableName)], color: "var(--oc-syntax-variable)" },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName, tags.annotation, tags.meta], color: "var(--oc-syntax-meta)" },
  { tag: tags.inserted, color: "var(--oc-syntax-addition-text)" },
  { tag: tags.deleted, color: "var(--oc-syntax-deletion-text)" },
  { tag: tags.invalid, color: "var(--bad)" },
  { tag: tags.link, textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "var(--oc-syntax-keyword)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
])

// Theme rules (unlike base-theme rules) win regardless of the `&light`/`&dark`
// marker CodeMirror would otherwise pick, which is what lets a single extension
// serve all three overlay themes.
const overlayEditorTheme = EditorView.theme({
  "&": { color: "var(--text)" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
  },
  ".cm-activeLine": { backgroundColor: "var(--ui-highlight-tone)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--ui-highlight-tone)", color: "var(--text)" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--warn) 30%, transparent)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in srgb, var(--accent) 38%, transparent)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
    color: "inherit",
  },
  ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": { color: "var(--bad)" },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--subtle-3)",
    color: "var(--text-muted)",
    border: "none",
  },
  ".cm-panels, .cm-tooltip": {
    backgroundColor: "var(--menu-panel-bg)",
    color: "var(--text)",
    border: "var(--oc-border-width) solid var(--border)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--subtle-3)",
    color: "var(--text-strong)",
  },
  // The citation band. Deliberately distinct from `.cm-activeLine` so "where I
  // was sent" stays readable next to "where the cursor is".
  ".cm-oc-reveal-line": {
    backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)",
    boxShadow: "inset 2px 0 0 0 var(--accent)",
  },
})

/** Theme, syntax palette and citation-band state for every overlay code surface. */
export function overlayCodeEditorExtensions(): Extension[] {
  return [overlayEditorTheme, syntaxHighlighting(overlayHighlightStyle), revealedLines]
}
