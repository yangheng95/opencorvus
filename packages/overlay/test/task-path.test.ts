import { describe, expect, test } from "bun:test"

import { directoryScopedPath, taskScopedPath } from "../src/services/task-path"

describe("taskScopedPath", () => {
  test("rejects task routes without an owning directory", () => {
    expect(() => taskScopedPath("task-abc-123", "", "/cancel")).toThrow("directory is required")
  })

  test("adds the task directory for cross-project routes", () => {
    expect(taskScopedPath("task-abc-123", "C:/Local/Temp", "/cancel")).toBe(
      "task/task-abc-123/cancel?directory=C%3A%2FLocal%2FTemp",
    )
  })

  test("encodes both the task id and the directory", () => {
    expect(taskScopedPath("task/with spaces", "C:/Users/example/my temp/project", "/replan")).toBe(
      "task/task%2Fwith%20spaces/replan?directory=C%3A%2FUsers%2Fexample%2Fmy+temp%2Fproject",
    )
  })

  test("directoryScopedPath rejects missing project directories", () => {
    expect(() => directoryScopedPath("run/run_1/acceptance", "", "acceptance diff")).toThrow("directory is required")
  })

  test("directoryScopedPath appends directory to existing query parameters", () => {
    expect(directoryScopedPath("run/run_1/acceptance?format=patch", "D:/repo", "acceptance diff")).toBe(
      "run/run_1/acceptance?format=patch&directory=D%3A%2Frepo",
    )
  })
})
