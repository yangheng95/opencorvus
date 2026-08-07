import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const COMPONENTS = join(ROOT, "src/components")
const SOURCE = readFileSync(join(COMPONENTS, "ui/DropdownMenu.tsx"), "utf8")
const CSS = readFileSync(join(ROOT, "src/styles/primitives/dropdown-menu.css"), "utf8")

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

test("DropdownMenu primitive is the only Kobalte dropdown-menu owner", () => {
  expect(SOURCE).toContain('import * as KobalteDropdownMenu from "@kobalte/core/dropdown-menu"')
  for (const part of ["Content", "SubContent", "Item", "CheckboxItem", "SubTrigger", "Separator"]) {
    expect(SOURCE).toContain(`KobalteDropdownMenu.${part}`)
  }
  for (const source of featureSources(COMPONENTS)) expect(source).not.toContain('@kobalte/core/dropdown-menu')
})

test("DropdownMenu owns menu, item, state and separator chrome", () => {
  expect(CSS).toMatch(/\.oc-menu\s*\{[^}]*border:[^}]*border-radius:[^}]*background:[^}]*box-shadow:/s)
  expect(CSS).toMatch(/\.oc-menu-item\s*\{[^}]*min-height:\s*var\(--oc-density-control-height\);/s)
  expect(CSS).toMatch(/\.oc-menu-item\[data-highlighted\][^{]*\{[^}]*background:\s*var\(--hover-wash\);/s)
  expect(CSS).toMatch(/\.oc-menu-separator\s*\{[^}]*background:\s*var\(--border\);/s)

  for (const [file, selector] of [
    ["composer.css", ".composer-attachment-menu"],
    ["sidebar.css", ".project-group-menu"],
    ["workspace.css", ".right-dock-add-drop"],
    ["conversation.css", ".workspace-editor-menu"],
  ] as const) {
    const surface = readFileSync(join(ROOT, "src/styles/surfaces", file), "utf8")
    const escaped = selector.replaceAll(".", "\\.")
    expect(surface).not.toMatch(new RegExp(`${escaped}\\s*\\{[^}]*?(?:border-radius|background|box-shadow):`, "s"))
  }
})
