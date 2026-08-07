import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("panel i18n health scan includes declarative TSX data-i18n attributes", () => {
  const source = readFileSync(join(import.meta.dir, "../script/check-panel-i18n.ts"), "utf8")

  expect(source).toContain("const keys = new Set<string>(extract(text))")
  expect(source).toContain('node.name.text === "tabLabelKey"')
})
