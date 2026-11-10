import { expect, test } from "bun:test"
import { projectDirectoryHints } from "../src/utils/project-directory"

test("same-named workspaces retain enough ancestors to identify either directory", () => {
  const alpha = "C:\\work\\Alpha\\shared\\Review\\Workspace"
  const beta = "c:/work/Beta/shared/review/workspace"
  const hints = projectDirectoryHints([
    { directory: alpha, name: "Workspace" },
    { directory: beta, name: "Workspace" },
  ])

  expect(hints.get(alpha)).toBe("Alpha/shared/Review")
  expect(hints.get(beta)).toBe("Beta/shared/review")
})

test("custom names shared by different folders use those real folder names", () => {
  const alpha = "/work/shared/checklist"
  const beta = "/work/shared/notes"
  const hints = projectDirectoryHints([
    { directory: alpha, name: "Quarterly work" },
    { directory: beta, name: "Quarterly work" },
  ])

  expect(hints.get(alpha)).toBe("checklist")
  expect(hints.get(beta)).toBe("notes")
})
