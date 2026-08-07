import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const ICON_RENDERER_SOURCE = readFileSync(
  path.join(import.meta.dir, "..", "src", "components", "ui", "Icon.tsx"),
  "utf8",
)
const ICON_BRAND_SOURCE = readFileSync(
  path.join(import.meta.dir, "..", "src", "components", "ui", "Icon.brands.tsx"),
  "utf8",
)

test("Icon registry creates fresh DOM nodes for every icon instance", () => {
  expect(ICON_BRAND_SOURCE).toContain("body: (idPrefix: string) => JSX.Element")
  expect(ICON_RENDERER_SOURCE).toContain("const iconIDPrefix = createUniqueId()")
  expect(ICON_RENDERER_SOURCE).toContain("resolvedCustomRecord()?.body(iconIDPrefix)")
  expect(`${ICON_RENDERER_SOURCE}\n${ICON_BRAND_SOURCE}`).not.toContain("body: JSX.Element")
  expect(ICON_RENDERER_SOURCE).not.toContain("{record().body}")
})

test("Icon rejects unknown runtime names instead of rendering an empty SVG", () => {
  expect(ICON_RENDERER_SOURCE).toContain('throw new Error(`Unknown icon "${name}"`)')
  expect(ICON_RENDERER_SOURCE).toContain("!isLucideIconName(name) && !isCustomIconName(name)")
})
