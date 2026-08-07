import { readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "bun:test"

const OVERLAY_ROOT = join(import.meta.dir, "..")

function read(relativePath: string): string {
  return readFileSync(join(OVERLAY_ROOT, relativePath), "utf8")
}

function cssRuleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))
  if (!match) throw new Error(`CSS rule not found: ${selector}`)
  return match[1] ?? ""
}

test("left Projects panel squeezes the Workbench from its stable layout root", () => {
  const activity = read("src/styles/surfaces/activity.css")
  const titlebar = read("src/styles/surfaces/titlebar.css")
  const main = read("src/main.tsx")
  const shell = cssRuleBody(activity, ".left-activity-shell")
  const collapsed = cssRuleBody(activity, '.left-activity-shell[data-collapsed="true"]')

  for (const property of ["flex-basis", "width", "min-width", "max-width"]) {
    expect(shell).toContain(`${property} var(--ui-duration-slow) var(--ui-timing-standard)`)
  }
  expect(collapsed).toContain("flex-basis: 0;")
  expect(collapsed).toContain("width: 0;")
  expect(collapsed).toContain("min-width: 0;")
  expect(collapsed).toContain("max-width: 0;")
  expect(collapsed).toContain("pointer-events: none;")
  expect(activity).not.toContain('.sidebar[data-collapsed="true"] .side-panel-content')
  expect(titlebar).not.toContain('.left-activity-shell[data-collapsed="true"] .workspace-contextbar')
  expect(activity).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.left-activity-shell\s*\{[^}]*transition-duration:\s*var\(--ui-duration-instant\);/s,
  )
  expect(main).toContain("leftActivityShell.inert = sidebarCollapsed")
  expect(main).toContain('leftActivityShell.setAttribute("aria-hidden", String(sidebarCollapsed))')
})

test("Right Dock and its resizer stay mounted while squeezing the conversation", () => {
  const app = read("src/components/App.tsx")
  const main = read("src/main.tsx")
  const workspace = read("src/styles/surfaces/workspace.css")
  const dock = cssRuleBody(workspace, ".right-dock")
  const dockClosed = cssRuleBody(workspace, '.right-dock[data-open="false"]')
  const resizer = cssRuleBody(workspace, ".right-dock-resizer")
  const resizerClosed = cssRuleBody(workspace, '.right-dock-resizer[data-open="false"]')

  for (const property of ["flex-basis", "width", "max-width"]) {
    expect(dock).toContain(`${property} var(--ui-duration-slow) var(--ui-timing-standard)`)
  }
  expect(dockClosed).toContain("flex-basis: 0;")
  expect(dockClosed).toContain("width: 0;")
  expect(dockClosed).toContain("max-width: 0;")
  expect(dockClosed).toContain("pointer-events: none;")
  for (const property of ["flex-basis", "width", "min-width"]) {
    expect(resizer).toContain(`${property} var(--ui-duration-slow) var(--ui-timing-standard)`)
  }
  expect(resizerClosed).toContain("flex-basis: 0;")
  expect(resizerClosed).toContain("width: 0;")
  expect(resizerClosed).toContain("min-width: 0;")
  expect(workspace).not.toContain(".right-dock[hidden]")
  expect(workspace).not.toContain(".right-dock-resizer[hidden]")
  expect(workspace).toMatch(
    /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.right-dock,[^{]*\.right-dock-resizer\s*\{[^}]*transition-duration:\s*var\(--ui-duration-instant\);/s,
  )

  expect(app).toContain('id="rightDockResizer"')
  expect(app).toContain('data-open="false"')
  expect(app).not.toMatch(/id="rightDockResizer"[^>]*\shidden(?:\s|=|\/|>)/s)
  expect(main).not.toContain("dock.hidden = !open")
  expect(main).not.toContain("resizer.hidden = !open")
  expect(main).toContain('resizer.dataset.open = open ? "true" : "false"')
  expect(main).toContain("dock.inert = !open")
  expect(main).toContain('dock.setAttribute("aria-hidden", String(!open))')
  expect(main).toContain('resizer.setAttribute("aria-hidden", String(!open))')
  expect(main).toContain("resizer.tabIndex = open ? 0 : -1")
})
