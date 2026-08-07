import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")
const source = read("src/components/ui/SelectControl.tsx")
const css = read("src/styles/primitives/select-control.css")
const fieldCss = read("src/styles/surfaces/field.css")
const indexHtml = read("src/index.html")

describe("SelectControl primitive", () => {
  test("owns the complete shared Kobalte class family", () => {
    for (const className of [
      "oc-select-trigger",
      "oc-select-content",
      "oc-select-listbox",
      "oc-select-option",
      "oc-select-indicator",
    ]) {
      expect(source).toContain(className)
      expect(css).toContain(`.${className}`)
    }
  })

  test("uses the bounded Codex control geometry", () => {
    expect(css).toMatch(
      /\.oc-select-trigger\s*\{[^}]*height:\s*var\(--oc-density-control-height\);[^}]*border:\s*var\(--oc-border-width\) solid var\(--border\);[^}]*border-radius:\s*var\(--oc-radius-large\);[^}]*background:\s*var\(--surface-strong\);/s,
    )
    expect(css).toMatch(
      /\.oc-select-trigger\s*\{[^}]*font-weight:\s*var\(--ui-font-weight-body\);/s,
    )
    expect(css).toMatch(
      /\.oc-select-trigger:focus-visible\s*\{[^}]*box-shadow:\s*0 0 0 calc\(2px \* var\(--ui-scale\)\) var\(--oc-control-focus-ring\);/s,
    )
    expect(css).toMatch(/\.oc-select-content\s*\{[^}]*border-radius:\s*var\(--oc-radius-large\);/s)
  })

  test("is loaded as a primitive and has no surface-level duplicate", () => {
    const textFieldAt = indexHtml.indexOf('href="styles/primitives/text-field.css"')
    const selectAt = indexHtml.indexOf('href="styles/primitives/select-control.css"')
    const fieldAt = indexHtml.indexOf('href="styles/surfaces/field.css"')

    expect(textFieldAt).toBeGreaterThan(-1)
    expect(selectAt).toBeGreaterThan(textFieldAt)
    expect(fieldAt).toBeGreaterThan(selectAt)
    expect(fieldCss).not.toContain(".oc-select-")
  })
})
