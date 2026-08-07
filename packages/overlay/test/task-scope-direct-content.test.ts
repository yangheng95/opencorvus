import { expect, test } from "bun:test"
import path from "node:path"

const overlayRoot = path.resolve(import.meta.dir, "..")

async function readSrc(rel: string): Promise<string> {
  return await Bun.file(path.join(overlayRoot, rel)).text()
}

test("task-scope toolbar panels render direct content without SectionFrame chrome", async () => {
  const board = await readSrc("src/components/Board.tsx")

  expect(board).not.toContain("function SectionFrame")
  expect(board).not.toContain("<SectionFrame")
  expect(board).not.toContain("SectionFrameProps")

  for (const [id, content] of [
    ["requirementsSection", "requirements"],
    ["architectSection", "architect"],
    ["goalsSection", "goals"],
  ] as const) {
    const at = board.indexOf(`id="${id}"`)
    expect(at).toBeGreaterThan(-1)
    const slice = board.slice(at, at + 420)
    expect(slice).toContain(`data-task-scope-content="${content}"`)
    expect(slice).toContain('class="task-scope-panel__content')
    expect(slice).not.toContain("<Section")
  }
})

test("task-scope badges live on the outer panel header", async () => {
  const board = await readSrc("src/components/Board.tsx")

  for (const badgeId of ["requirementsBadge", "architectBadge", "goalsBadge"]) {
    const callsite = board.indexOf(`badgeId="${badgeId}"`)
    expect(callsite).toBeGreaterThan(-1)
    const shellBefore = board.lastIndexOf("<TaskScopePanelShell", callsite)
    const contentBefore = board.lastIndexOf('class="task-scope-panel__content', callsite)
    expect(shellBefore).toBeGreaterThan(contentBefore)
  }
})
