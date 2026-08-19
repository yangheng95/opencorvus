import { afterEach, describe, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("instance re-entry during its own context preparation", () => {
  /**
   * Project open runs Task-control recovery inside context preparation, and a
   * recovered Orchestrator Turn reaches project-scoped read helpers that enter
   * the instance by directory. Those helpers must get this project's context,
   * not a lifecycle error that fails the Task being recovered.
   */
  test("a project-scoped read inside the initializer runs in the project's own context", async () => {
    await using project = await memoryProject()

    const observed: Array<{ directory: string; worktree: string; projectID: string }> = []
    const outcome = await Instance.provide({
      directory: project.path,
      init: async () => {
        const inner = await Instance.provide({
          directory: project.path,
          fn: async () => ({
            directory: Instance.directory,
            worktree: Instance.worktree,
            projectID: Instance.project.id,
          }),
        })
        observed.push(inner)
      },
      fn: async () => Instance.project.id,
    })

    expect(observed).toHaveLength(1)
    expect(observed[0]!.directory).toBe(project.path)
    expect(observed[0]!.worktree).toBe(project.path)
    expect(observed[0]!.projectID).toBe(outcome)
  })

  test("nested reads see the same project identity the initializer is preparing", async () => {
    await using project = await memoryProject()

    let identityInsideInit: string | undefined
    let identityInsideNested: string | undefined
    await Instance.provide({
      directory: project.path,
      init: async () => {
        identityInsideInit = Instance.project.id
        identityInsideNested = await Instance.provide({
          directory: project.path,
          fn: async () => Instance.project.id,
        })
      },
      fn: async () => undefined,
    })

    expect(identityInsideInit).toBeDefined()
    expect(identityInsideNested).toBe(identityInsideInit!)
  })
})
