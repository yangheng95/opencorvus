import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectOpenLifecycle } from "@/project/open-lifecycle"
import { TerminalProfile } from "@/system-terminal/profile"
import type { Log } from "@/util/log"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

function observeTerminalProfileBootstrapStage() {
  const actualStage = ProjectOpenLifecycle.stage
  const stages: Array<{ level: "info" | "error"; status: unknown; error?: unknown }> = []
  const logger: Pick<Log.Logger, "info" | "error"> = {
    info(_message, extra) {
      stages.push({ level: "info", status: extra?.status })
    },
    error(_message, extra) {
      stages.push({ level: "error", status: extra?.status, error: extra?.error })
    },
  }
  const stage = spyOn(ProjectOpenLifecycle, "stage").mockImplementation((name, context, run, observedLogger) => {
    if (name !== "terminal-profile.ensure-default") return actualStage(name, context, run, observedLogger)
    return actualStage(name, context, run, logger)
  })
  return {
    stages,
    [Symbol.dispose]() {
      stage.mockRestore()
    },
  }
}

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

  test("project-open terminal profile settlement returns one durable resolved default profile", async () => {
    await using project = await memoryProject()

    const stages: Array<{ level: "info" | "error"; status: unknown }> = []
    const logger: Pick<Log.Logger, "info" | "error"> = {
      info(_message, extra) {
        stages.push({ level: "info", status: extra?.status })
      },
      error(_message, extra) {
        stages.push({ level: "error", status: extra?.status })
      },
    }
    const result = await Instance.provide({
      directory: project.path,
      init: async () => {
        await ProjectOpenLifecycle.stage(
          "terminal-profile.ensure-default",
          {
            directory: Instance.directory,
            worktree: Instance.worktree,
            projectID: Instance.project.id,
          },
          () => TerminalProfile.ensureProjectDefaultProfile(),
          logger,
        )
      },
      fn: async () => {
        const config = await Config.get()
        const listed = await TerminalProfile.list()
        const resolved = await TerminalProfile.resolve(listed.defaultProfileID)
        return {
          configuredDefaultProfileID: config.terminal?.default_profile_id,
          listed,
          resolved,
        }
      },
    })

    expect(stages).toEqual([
      { level: "info", status: "started" },
      { level: "info", status: "completed" },
    ])
    expect(result.configuredDefaultProfileID).toBe(result.listed.defaultProfileID)
    expect(result.listed.profiles.map((profile) => profile.id)).toContain(result.listed.defaultProfileID)
    expect(result.resolved).toMatchObject({
      id: result.listed.defaultProfileID,
      args: expect.any(Array),
      env: expect.objectContaining({ TERM: "xterm-256color", COLORTERM: "truecolor" }),
    })
  }, 120_000)

  test("production bootstrap completes a typed terminal-profile degradation and serves the Project", async () => {
    await using project = await memoryProject()
    using observed = observeTerminalProfileBootstrapStage()
    const unavailable = new TerminalProfile.ConfigError({ message: "controlled host has no resolvable shell" })
    const terminal = spyOn(TerminalProfile, "ensureProjectDefaultProfile").mockImplementation(async () => {
      throw unavailable
    })
    using _terminal = { [Symbol.dispose]: () => terminal.mockRestore() }

    const projectID = await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: () => Instance.project.id,
    })

    expect(terminal).toHaveBeenCalledTimes(1)
    expect(projectID).toBeTruthy()
    expect(observed.stages).toEqual([
      { level: "info", status: "started" },
      { level: "info", status: "completed" },
    ])
  }, 120_000)

  test("production bootstrap fails an unexpected terminal settlement and rolls its Instance back", async () => {
    await using project = await memoryProject()
    using observed = observeTerminalProfileBootstrapStage()
    const settlementFailure = new Error("controlled terminal runtime settlement failure")
    const terminal = spyOn(TerminalProfile, "ensureProjectDefaultProfile").mockImplementation(async () => {
      throw settlementFailure
    })
    using _terminal = { [Symbol.dispose]: () => terminal.mockRestore() }

    const failure = await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: () => Instance.project.id,
    }).catch((cause) => cause)
    const durableProject = await Project.fromDirectory(project.path)
    const reopenedProjectID = await Instance.provide({
      directory: project.path,
      fn: () => Instance.project.id,
    })

    expect(failure).toBe(settlementFailure)
    expect(observed.stages).toEqual([
      { level: "info", status: "started" },
      { level: "error", status: "failed", error: settlementFailure.message },
    ])
    expect(reopenedProjectID).toBe(durableProject.project.id)
  }, 120_000)
})
