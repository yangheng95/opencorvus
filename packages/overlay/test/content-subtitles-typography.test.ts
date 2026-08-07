// Regression for iter12 of the design-language audit.
//
// Last sweep of tier-2 leaks across content panels — six classes
// that styled themselves as tier-3 status pills (uppercase + wide
// letter-spacing) but had no pill chrome (no background, no
// border-radius, no accent color):
//
//   .diff-preview-scope            (file scope label in diff
//                                    preview header)
//   .msg-todo-card__label          ("In progress", "Pending"
//                                    section labels in TodoListPart)
//   .msg-read-reminder__label      ("Read reminder" subtitle)
//   .log-detail-title              (log-viewer detail block
//                                    subtitle: "Stack", "Body", …)
//   .board-intro__section-title    (board intro section title:
//                                    "Modes", "Agents")
//
// All five are plain subtitles inside content. Same logic as iter4 /
// iter7 / iter9 / iter10 / iter11: no pill chrome → not a status
// chip → drop the all-caps + wide tracking. The remaining
// uppercase tier-3 pills (verdict-pill, req-status, reasoning toggle,
// criteria-result, eval-error-meta, session-msg-role, md-code-lang,
// gwg-priority-badge, gwg-verdict,
// req-priority, req-type, status-label)
// keep their styling — they ARE color-coded short-word chips and
// the all-caps pill convention reads as a status tag there.
//
// NOTE: .board-intro__section-title was removed during the flat-
// redesign (2026-05-04), and .change-directory was retired when
// file rows converged on the shared FileRow primitive. Neither
// selector exists in CSS anymore.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const STYLES_ROOT = path.resolve(import.meta.dir, "..", "src", "styles")
const COMPONENTS_ROOT = path.resolve(import.meta.dir, "..", "src", "components")

function walkCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkCss(full))
    else if (entry.endsWith(".css")) out.push(full)
  }
  return out
}

function walkSource(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkSource(full))
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full)
  }
  return out
}

// Concatenate all surface + cascade + primitive CSS files.
const STYLES = walkCss(STYLES_ROOT)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const head = new RegExp(`(^|\\n)\\s*${escaped}(?=[\\s,{[])[^{]*\\{`, "m").exec(STYLES)
  if (!head) throw new Error(`selector ${selector} not found in surface files`)
  const open = head.index + head[0].length - 1
  const close = STYLES.indexOf("}", open)
  if (close < 0) throw new Error(`malformed block for ${selector}`)
  return STYLES.slice(open + 1, close)
}

describe("content-area subtitles render Title Case", () => {
  for (const sel of [
    ".diff-preview-scope",
    ".msg-todo-card__label",
    ".msg-read-reminder__label",
    ".log-detail-title",
  ]) {
    test(`${sel} does not force-uppercase`, () => {
      expect(ruleBody(sel)).not.toContain("text-transform: uppercase")
    })
  }
})

describe("retired file-change subtitle selector stays absent", () => {
  test(".change-subline is not reintroduced as a second file-change path owner", () => {
    const files = [...walkSource(COMPONENTS_ROOT), ...walkCss(STYLES_ROOT)]
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toContain("change-subline")
    }
  })
})

describe("legitimate tier-3 pills keep uppercase (negative control)", () => {
  for (const sel of [".verdict-pill", ".req-status", ".gwg-priority-badge", ".gwg-verdict", ".md-code-lang"]) {
    test(`${sel} stays uppercase`, () => {
      expect(ruleBody(sel)).toContain("text-transform: uppercase")
    })
  }
})
