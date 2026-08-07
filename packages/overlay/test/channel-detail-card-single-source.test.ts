// Regression for iter36 — finishing the iter28 / iter30 / iter33
// single-source pass for the remaining sibling still in the
// `var(--surface-inset) !important` reset chain at line ~12428
// of styles.css and the `border-color: var(--border) !important`
// reset at ~13122:
//
//   .channel-doc-card  (channel docs / install panel cards)
//
// Its canonical declared `background: var(--subtle-1)`, while the
// !important reset forced `var(--surface-inset)` over it. Same rule-8
// active conflict — source said one thing, browser rendered another.
//
// Pin: the live canonical declares transparent flat chrome directly so
// source matches rendered. The retired `.detail-*` settings cluster stays
// absent because it has no production owner.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const STYLES_ROOT = path.resolve(import.meta.dir, "..", "src", "styles")
const SOURCE_ROOT = path.resolve(import.meta.dir, "..", "src")
const RETIRED_DETAIL_CLASSES = ["detail-stack", "detail-card", "detail-pre", "detail-pre-json", "detail-grid-row"]

function walkFiles(dir: string, accept: (file: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, accept))
    else if (accept(full)) out.push(full)
  }
  return out
}

// Concatenate all surface + cascade + primitive CSS files (styles.css was
// dissolved 2026-05-04 into this decomposed architecture). Comments are
// stripped first so a `/* … */` block immediately preceding a rule does
// not get folded into the rule's selector head when we split on `}`.
function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "")
}
const STYLES = stripCssComments(
  walkFiles(STYLES_ROOT, (file) => file.endsWith(".css"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n"),
)
const SOURCE = walkFiles(SOURCE_ROOT, (file) => /\.(?:ts|tsx|html)$/.test(file))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")

function cssSelectorRe(className: string): RegExp {
  return new RegExp(`(^|[\\n,{])\\s*\\.${className}(?:\\s|[,{:.#\\[]|$)`)
}

function sourceClassRe(className: string): RegExp {
  return new RegExp(`(?:^|["'\\s])${className}(?:["'\\s])`)
}

function soloRuleBody(selector: string): string {
  for (const chunk of STYLES.split("}")) {
    const openIdx = chunk.indexOf("{")
    if (openIdx < 0) continue
    const raw = chunk.slice(0, openIdx)
    const head = raw.trim()
    if (head !== selector) continue
    const lastNewline = raw.lastIndexOf("\n")
    const lastLine = raw.slice(lastNewline + 1)
    if (lastLine !== lastLine.trimStart()) continue
    return chunk.slice(openIdx + 1)
  }
  throw new Error(`solo ${selector} not found`)
}

describe(".channel-doc-card canonical matches the rendered bg", () => {
  test(".channel-doc-card canonical declares transparent background", () => {
    expect(soloRuleBody(".channel-doc-card")).toMatch(/background:\s*transparent/)
  })

  test(".channel-doc-card owns borderless chrome directly", () => {
    expect(soloRuleBody(".channel-doc-card")).toMatch(/border:\s*0/)
  })
})

describe("neither selector still rides an !important bg/border-color reset chain", () => {
  const sel = ".channel-doc-card"

  test(`no rule body using !important on background still lists \`${sel}\` as a top-level segment`, () => {
    for (const chunk of STYLES.split("}")) {
      const openIdx = chunk.indexOf("{")
      if (openIdx < 0) continue
      const raw = chunk.slice(0, openIdx)
      const head = raw.trim()
      if (!head) continue
      if (head.startsWith("body")) continue
      if (head.startsWith("@")) continue
      const lastNewline = raw.lastIndexOf("\n")
      const lastLine = raw.slice(lastNewline + 1)
      if (lastLine !== lastLine.trimStart()) continue
      const body = chunk.slice(openIdx + 1)
      if (!/background:[^;]*!important/.test(body)) continue
      const segments = head.split(",").map((s) => s.trim())
      expect(segments).not.toContain(sel)
    }
  })

  test(`no rule body using !important on border-color still lists \`${sel}\``, () => {
    for (const chunk of STYLES.split("}")) {
      const openIdx = chunk.indexOf("{")
      if (openIdx < 0) continue
      const raw = chunk.slice(0, openIdx)
      const head = raw.trim()
      if (!head) continue
      if (head.startsWith("body")) continue
      if (head.startsWith("@")) continue
      const lastNewline = raw.lastIndexOf("\n")
      const lastLine = raw.slice(lastNewline + 1)
      if (lastLine !== lastLine.trimStart()) continue
      const body = chunk.slice(openIdx + 1)
      if (!/border-color:[^;]*!important/.test(body)) continue
      const segments = head.split(",").map((s) => s.trim())
      expect(segments).not.toContain(sel)
    }
  })
})

describe("retired settings detail-card cluster stays absent", () => {
  for (const className of RETIRED_DETAIL_CLASSES) {
    test(`.${className} has no production CSS or source owner`, () => {
      expect(STYLES).not.toMatch(cssSelectorRe(className))
      expect(SOURCE).not.toMatch(sourceClassRe(className))
    })
  }
})
