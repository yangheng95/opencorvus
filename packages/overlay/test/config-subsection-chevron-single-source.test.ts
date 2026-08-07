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

function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "")
}

const CSS = stripCssComments(
  walkCss(STYLES_ROOT)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n"),
)

describe("retired config-subsection chevron", () => {
  test("removes the config-subsection chevron selectors with the retired shell", () => {
    expect(CSS).not.toMatch(/\.config-subsection-head::before/)
    expect(CSS).not.toMatch(/\.config-subsection\[open\]\s*>\s*\.config-subsection-head::before/)
  })

  test("does not keep the older Unicode config-subsection chevron implementation", () => {
    expect(CSS).not.toMatch(/\.config-subsection[^{]*\{[^}]*content:\s*"▸"/)
  })
})
