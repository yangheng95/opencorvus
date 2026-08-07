import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const STYLES_ROOT = path.join(OVERLAY_ROOT, "src", "styles")
const SETTINGS_ROOT = path.join(OVERLAY_ROOT, "src", "components", "settings")

function walk(dir: string, predicate: (entry: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, predicate))
    else if (predicate(entry)) out.push(full)
  }
  return out
}

function stripCssComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, "")
}

const STYLES = stripCssComments(
  walk(STYLES_ROOT, (entry) => entry.endsWith(".css"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n"),
)
const SETTINGS_COMPONENTS = walk(SETTINGS_ROOT, (entry) => entry.endsWith(".tsx"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")

function countSoloTopLevelRules(selector: string): number {
  let count = 0
  for (const chunk of STYLES.split("}")) {
    const openIdx = chunk.indexOf("{")
    if (openIdx < 0) continue
    const raw = chunk.slice(0, openIdx)
    const head = raw.trim()
    if (!head || head.startsWith("body") || head.startsWith("@")) continue
    const lastNewline = raw.lastIndexOf("\n")
    const lastLine = raw.slice(lastNewline + 1)
    if (lastLine !== lastLine.trimStart()) continue
    if (head === selector) count += 1
  }
  return count
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

describe("settings extension rows use the settings row primitive", () => {
  test("settings components create extension rows through SettingsRow", () => {
    expect(SETTINGS_COMPONENTS).toContain("SettingsRow")
    expect(SETTINGS_COMPONENTS).toContain('class="extension-settings-row"')
    for (const legacy of ["extension-row", "extension-row-main", "extension-row-actions"]) {
      expect(SETTINGS_COMPONENTS).not.toContain(legacy)
    }
  })

  test("the primitive row owns row chrome", () => {
    expect(countSoloTopLevelRules(".s-row")).toBe(1)
    expect(soloRuleBody(".s-row")).toMatch(/background:\s*transparent/)
    expect(soloRuleBody(".s-row")).toMatch(/\bborder:\s*0\s+solid transparent/)
  })

  test("theme selectors cannot own settings row chrome", () => {
    for (const chunk of STYLES.split("}")) {
      const openIdx = chunk.indexOf("{")
      if (openIdx < 0) continue
      const selector = chunk.slice(0, openIdx).trim()
      const isThemeSelector = /body(?:\[[^\]]*data-theme[^\]]*\]|:is\([^)]*data-theme[^)]*\))/.test(selector)
      if (!isThemeSelector) continue

      expect(selector).not.toMatch(/(?:^|\s|:is\([^)]*)\.s-row(?:\b|[:.[#])/)
    }
  })
})
