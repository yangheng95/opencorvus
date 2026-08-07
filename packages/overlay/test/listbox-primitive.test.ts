import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const COMPONENTS = join(ROOT, "src/components")
const SOURCE = readFileSync(join(COMPONENTS, "ui/Listbox.tsx"), "utf8")
const CSS = readFileSync(join(ROOT, "src/styles/primitives/listbox.css"), "utf8")

function featureSources(directory: string): string[] {
  const sources: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      if (path === join(COMPONENTS, "ui")) continue
      sources.push(...featureSources(path))
    } else if (path.endsWith(".tsx")) sources.push(readFileSync(path, "utf8"))
  }
  return sources
}

test("Listbox primitive is the only Kobalte listbox owner", () => {
  expect(SOURCE).toContain('import * as KobalteListbox from "@kobalte/core/listbox"')
  expect(SOURCE).toContain("KobalteListbox.Root")
  expect(SOURCE).toContain("KobalteListbox.Item")
  for (const source of featureSources(COMPONENTS)) expect(source).not.toContain('@kobalte/core/listbox')
})

test("Listbox owns density, reset and interaction states", () => {
  expect(CSS).toMatch(/\.oc-listbox\s*\{[^}]*list-style:\s*none;[^}]*outline:\s*none;/s)
  expect(CSS).toMatch(/\.oc-listbox\[data-density="rich"\]\s*\{[^}]*44px/s)
  expect(CSS).toMatch(/\.oc-listbox-item\s*\{[^}]*min-height:[^}]*border:[^}]*font:[^}]*cursor:/s)
  expect(CSS).toMatch(/\.oc-listbox-item\[data-highlighted\][^{]*\{[^}]*background:\s*var\(--hover-wash\);/s)
  expect(CSS).toMatch(/\.oc-listbox-item:focus-visible\s*\{[^}]*outline:\s*var\(--oc-border-width\) solid var\(--accent\);/s)
  expect(CSS).toMatch(/\.oc-listbox-item\[data-selected\]\s*\{[^}]*background:\s*var\(--selected-wash\);/s)
})
