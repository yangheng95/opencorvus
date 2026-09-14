import { describe, expect, test } from "bun:test"
import path from "path"
import { assertResolvedTaskPathInWorkspace, TaskProcessBoundaryError } from "../src/tool/external-directory"

describe("Task process file boundary", () => {
  test("accepts a workspace path and returns the typed boundary error for an external path", () => {
    const root = path.resolve("/workspace/project")
    expect(
      assertResolvedTaskPathInWorkspace({
        taskID: "task-boundary-contract",
        candidate: path.join(root, "artifact.txt"),
        root,
      }),
    ).toBeUndefined()

    let failure: unknown
    try {
      assertResolvedTaskPathInWorkspace({
        taskID: "task-boundary-contract",
        candidate: path.resolve("/private/provider/auth.json"),
        root,
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(TaskProcessBoundaryError)
    expect(failure).toMatchObject({
      code: "TASK_PROCESS_BOUNDARY_VIOLATION",
      name: "TaskProcessBoundaryError",
    })
  })
})
