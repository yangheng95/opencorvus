import { expect, test } from "bun:test"
import {
  overlayHighlightStyle,
  resolveRevealTarget,
  revealHighlightLines,
} from "../src/components/ui/code-editor-theme"

test("a cited range resolves onto the document that holds it", () => {
  expect(resolveRevealTarget(120, { startLine: 42, endLine: 48 })).toEqual({
    anchorLine: 42,
    endLine: 48,
    settled: true,
  })
  expect(resolveRevealTarget(120, { startLine: 42, endLine: 42 })).toEqual({
    anchorLine: 42,
    endLine: 42,
    settled: true,
  })
})

test("a range past the end of the file clamps onto the last line", () => {
  expect(resolveRevealTarget(30, { startLine: 12, endLine: 900 })).toEqual({
    anchorLine: 12,
    endLine: 30,
    settled: true,
  })
})

test("a reveal against a document that lacks the cited line is not settled", () => {
  // This is the regression that made citation jumps vanish: an empty document
  // is one line long, so every citation clamped to line 1 and the reveal was
  // latched as done before the file content had arrived.
  expect(resolveRevealTarget(1, { startLine: 42, endLine: 48 })).toEqual({
    anchorLine: 1,
    endLine: 1,
    settled: false,
  })
  expect(resolveRevealTarget(20, { startLine: 42, endLine: 48 })?.settled).toBe(false)
})

test("nothing is revealed without a well-formed range or document", () => {
  expect(resolveRevealTarget(120, undefined)).toBeNull()
  expect(resolveRevealTarget(0, { startLine: 1, endLine: 1 })).toBeNull()
  expect(resolveRevealTarget(120, { startLine: 0, endLine: 4 })).toBeNull()
  expect(resolveRevealTarget(120, { startLine: 9, endLine: 4 })).toBeNull()
  expect(resolveRevealTarget(120, { startLine: 1.5, endLine: 4 })).toBeNull()
})

test("a cited window is banded", () => {
  const target = resolveRevealTarget(400, { startLine: 42, endLine: 48 })!
  expect(revealHighlightLines(400, target)).toEqual({ fromLine: 42, toLine: 48 })
})

test("a whole-file citation gets a cursor but no band", () => {
  // A plain `read` cites lines 1..N. Banding the entire document says nothing,
  // and selecting it — what the editor used to do — read as "no jump happened".
  const target = resolveRevealTarget(120, { startLine: 1, endLine: 120 })!
  expect(target.anchorLine).toBe(1)
  expect(revealHighlightLines(120, target)).toBeNull()
  expect(revealHighlightLines(120, resolveRevealTarget(120, { startLine: 1, endLine: 4000 })!)).toBeNull()
})

test("an oversized band is skipped rather than decorating six figures of lines", () => {
  const target = resolveRevealTarget(20_000, { startLine: 10, endLine: 9_000 })!
  expect(revealHighlightLines(20_000, target)).toBeNull()
})

test("every syntax colour resolves from the theme tokens", () => {
  const declarations = Object.values(overlayHighlightStyle.module?.rules ?? []).join("\n")
  expect(declarations).not.toBe("")
  // The bug this guards: `basicSetup` ships a light-only palette, so a dark
  // theme rendered source files at roughly 1.2:1 contrast — the file looked
  // empty. Any literal colour here would reintroduce a theme-blind token.
  const literalColours = declarations.match(/color:\s*(#[0-9a-f]{3,8}|rgba?\()/gi)
  expect(literalColours).toBeNull()
  for (const token of ["keyword", "string", "comment", "number", "function", "variable", "meta"]) {
    expect(declarations).toContain(`var(--oc-syntax-${token})`)
  }
})
