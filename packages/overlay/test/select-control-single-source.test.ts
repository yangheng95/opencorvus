import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const COMPONENTS_ROOT = join(OVERLAY_ROOT, "src/components")
const SELECT_CONTROL_PATH = join(COMPONENTS_ROOT, "ui/SelectControl.tsx")

function walkTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTsx(full))
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

describe("SelectControl single source", () => {
  test("only SelectControl owns the Kobalte Select shell", () => {
    for (const file of walkTsx(COMPONENTS_ROOT)) {
      const source = readFileSync(file, "utf8")
      const rel = relative(COMPONENTS_ROOT, file).replace(/\\/g, "/")
      if (file === SELECT_CONTROL_PATH) {
        expect(source).toContain('import * as Select from "@kobalte/core/select"')
        expect(source).toContain("<Select.Root<T>")
        continue
      }

      expect(source, rel).not.toContain('import * as Select from "@kobalte/core/select"')
      expect(source, rel).not.toContain("<Select.Root")
      expect(source, rel).not.toContain("<Select.Trigger")
      expect(source, rel).not.toContain("<Select.HiddenSelect")
      expect(source, rel).not.toContain("<Select.Portal")
      expect(source, rel).not.toContain("<Select.Content")
      expect(source, rel).not.toContain("<Select.Listbox")
      expect(source, rel).not.toMatch(/function \w*SelectOptionItem/)
    }
  })
})
