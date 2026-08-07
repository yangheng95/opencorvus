import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function source(path: string): string {
  return readFileSync(join(import.meta.dir, "../src", path), "utf8")
}

const requirements = source("components/RequirementsPanel.tsx")
const architect = source("components/ArchitectPanel.tsx")
const goals = source("components/GoalGroup.tsx")
const explorer = source("components/FileExplorerPanel.tsx")
const enUS = JSON.parse(source("i18n/en-US.json")) as Record<string, string>
const zhCN = JSON.parse(source("i18n/zh-CN.json")) as Record<string, string>

test("requirements and goals translate user-visible enum labels", () => {
  expect(requirements).toContain("requirementTypeLabel(req.type)")
  expect(requirements).toContain("requirementStatusLabel(req.status)")
  expect(requirements).toContain('t("task_scope.requirement_priority.advisory")')
  expect(requirements).not.toContain(">{req.type}<")
  expect(requirements).not.toContain(">{req.status || \"pending\"}<")
  expect(goals).toContain('t("task_scope.requirement_priority.advisory")')
  expect(goals).toContain('t("goal.field.worktree")')

  for (const key of [
    "task_scope.requirement_type.explicit",
    "task_scope.requirement_type.inferred",
    "task_scope.requirement_type.system",
    "task_scope.requirement_status.pending",
    "task_scope.requirement_status.passed",
    "task_scope.requirement_status.failed",
    "task_scope.requirement_priority.advisory",
  ]) {
    expect(enUS[key]).toBeTruthy()
    expect(zhCN[key]).toBeTruthy()
    expect(zhCN[key]).not.toBe(enUS[key])
  }
})

test("architect never silently truncates category evidence", () => {
  expect(architect).toContain("<For each={props.architect!.categories}>")
  expect(architect).not.toContain("categories.slice(")
})

test("file explorer uses one localized missing-directory message", () => {
  expect(explorer).not.toContain("Project directory is required")
  expect(explorer.match(/t\("explorer\.directory_required"\)/g) ?? []).toHaveLength(14)
  expect(enUS["explorer.directory_required"]).toBeTruthy()
  expect(zhCN["explorer.directory_required"]).toBeTruthy()
  expect(zhCN["explorer.directory_required"]).not.toBe(enUS["explorer.directory_required"])
})
