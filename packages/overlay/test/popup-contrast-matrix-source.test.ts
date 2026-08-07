import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")

function readText(rel: string): string {
  return readFileSync(path.join(OVERLAY_ROOT, rel), "utf8")
}

test("popup contrast browser matrices load stylesheet order from the real overlay entrypoint", () => {
  const popupMatrix = readText("test/browser/popup-contrast-matrix.test.ts")
  const selectMatrix = readText("test/browser/select-popup-contrast-matrix.test.ts")

  for (const source of [popupMatrix, selectMatrix]) {
    expect(source).toContain("src/index.html")
    expect(source).toContain("function overlayStyleHrefs()")
    expect(source).toContain("const OVERLAY_STYLE_HREFS = overlayStyleHrefs()")
    expect(source).toContain("return OVERLAY_STYLE_HREFS.map(readCss).join")
    expect(source).not.toContain('return [\n    "tokens/design-language.css"')
    expect(source).not.toContain('"surfaces/field.css",\n    "surfaces/dialog.css",')
  }
})
