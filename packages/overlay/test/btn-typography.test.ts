// Regression for iter4 of the right-panel design-language audit.
//
// `.oc-button` owns the overlay's primary button typography. The retired
// legacy class family once carried `text-transform: uppercase` and
// `letter-spacing: 0.05em`,
// which force-uppercased every button label across the overlay
// regardless of what i18n returned. So `Copy All` became `COPY ALL`,
// `Set up` became `SET UP`, etc — directly clashing with the Title
// Case used everywhere else (section titles, tab labels, field labels)
// and with the modern calm/flat trajectory recent commits have been
// pushing the overlay toward (a345c39a2 calm workflow, c399c6838
// transparent secondary controls, 5f0f209d3 remove right panel
// decorative borders, a5723925a flatten themes).
//
// Tier-3 status pills (verdict-pill, req-type, req-status, gwg-verdict)
// status, etc.) DO keep their uppercase styling — those are short
// single-word color-coded chips where the pill convention reads as a
// status tag, not as a screaming action. The negative control below
// pins that distinction so a future "remove all uppercase" sweep
// can't quietly strip the legitimate tier-3 pill styling either.

import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const STYLES_ROOT = path.resolve(import.meta.dir, "..", "src", "styles")

function walkCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkCss(full))
    else if (entry.endsWith(".css")) out.push(full)
  }
  return out
}

// Concatenate all surface + cascade + primitive CSS files — the post-
// styles.css decomposed architecture. Selectors that used to live in the
// monolith now live across these files; searching the combined text
// preserves the same semantics as the old readFileSync("styles.css").
const STYLES = walkCss(STYLES_ROOT)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")

function ruleBody(selector: string): string {
  // Match a CSS rule that STARTS with the given selector (so a
  // descendant rule like `.foo .oc-button { ... }` doesn't steal the match).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const head = new RegExp(`(^|\\n)\\s*${escaped}(?=[\\s,{[])[^{]*\\{`, "m").exec(STYLES)
  if (!head) throw new Error(`selector ${selector} not found in surface files`)
  const open = head.index + head[0].length - 1
  const close = STYLES.indexOf("}", open)
  if (close < 0) throw new Error(`malformed block for ${selector}`)
  return STYLES.slice(open + 1, close)
}

describe(".oc-button primary primitive renders Title Case action labels", () => {
  test(".oc-button does NOT force-uppercase its label", () => {
    const body = ruleBody(".oc-button")
    expect(body).not.toContain("text-transform: uppercase")
  })

  test(".oc-button does NOT carry the all-caps wide letter-spacing", () => {
    const body = ruleBody(".oc-button")
    // The 0.05em wide letter-spacing was paired with text-transform:
    // uppercase to make all-caps labels readable. With Title Case the
    // wide tracking just looks loose, so it goes too. A button can
    // still set its own letter-spacing if the design calls for it.
    expect(body).not.toMatch(/letter-spacing:\s*0\.05em/)
  })
})

describe("tier-3 status pills keep their uppercase styling (negative control)", () => {
  // These are the pills the "no uppercase" rule does NOT apply to. If
  // a future sweep accidentally removes their uppercase too, the
  // status badges lose their pill identity.
  for (const sel of [".verdict-pill", ".req-type", ".req-status"]) {
    test(`${sel} stays uppercase`, () => {
      expect(ruleBody(sel)).toContain("text-transform: uppercase")
    })
  }
})
