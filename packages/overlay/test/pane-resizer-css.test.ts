import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, "src", rel), "utf8")
}

test("right pane resizer CSS stays retired with no right handle config", () => {
  const html = readSrc("components/App.tsx")
  const pane = readSrc("services/pane.ts")
  const workspaceCss = readSrc("styles/surfaces/workspace.css")

  expect(html).toContain('id="leftPaneResizer"')
  expect(html).not.toContain('id="rightPaneResizer"')
  expect(pane).not.toContain("rightHandleId")
  expect(pane).not.toContain("rightControls")
  expect(workspaceCss).toContain(".pane-resizer {")
  expect(workspaceCss).not.toContain(".pane-resizer-right")
})
