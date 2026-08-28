import { describe, expect, test } from "bun:test"
import path from "node:path"
import { writeFile } from "node:fs/promises"
import { GlobalBus } from "@/bus/global"
import { Config } from "@/config/config"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function within<T>(label: string, operation: Promise<T>, timeoutMs = 20_000): Promise<T> {
  return Promise.race([
    operation,
    Bun.sleep(timeoutMs).then(() => {
      throw new Error(`${label} did not settle within ${timeoutMs}ms`)
    }),
  ])
}

describe.serial("cross-process Config convergence", () => {
  test("a stable generation parses the exact source snapshot that owns its revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: () => Config.updateProjectPatch({ username: "snapshot-a" }),
    })
    let target = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        target = Config.projectConfigFile()
        await Config.state.reset()
      },
    })
    let interleaved = false
    Config.TestHooks.afterSourceSnapshotRead = async (input) => {
      if (interleaved || path.resolve(input.path) !== path.resolve(target)) return
      interleaved = true
      await writeFile(target, JSON.stringify({ username: "snapshot-b" }), "utf8")
    }
    Config.TestHooks.afterSourceSnapshotParsed = async (input) => {
      if (!interleaved || path.resolve(input.path) !== path.resolve(target)) return
      await writeFile(target, JSON.stringify({ username: "snapshot-a" }), "utf8")
    }
    try {
      const config = await Instance.provide({ directory: project.path, fn: () => Config.get() })
      expect({ interleaved, username: config.username }).toEqual({ interleaved: true, username: "snapshot-a" })
    } finally {
      Config.TestHooks.afterSourceSnapshotRead = undefined
      Config.TestHooks.afterSourceSnapshotParsed = undefined
    }
  })

  test("a committed writer transition retains its exact generation until event settlement succeeds", async () => {
    await using project = await memoryProject()
    let attempts = 0
    let resolveRetried!: () => void
    const retried = new Promise<void>((resolve) => {
      resolveRetried = resolve
    })
    const listener = (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
      if (
        event.directory !== project.path ||
        event.payload.type !== "config.changed" ||
        event.payload.properties?.username !== "retry-after"
      ) {
        return
      }
      attempts++
      if (attempts === 1) throw new Error("controlled first event settlement failure")
      resolveRetried()
    }
    GlobalBus.on("event", listener)
    try {
      const error = await Instance.provide({
        directory: project.path,
        fn: () => Config.updateProjectPatch({ username: "retry-after" }),
      }).catch((cause) => cause)
      await within("committed transition retry", retried)
      const config = await Instance.provide({ directory: project.path, fn: () => Config.get() })
      expect({
        error: error instanceof Error ? error.name : String(error),
        committed: error instanceof Config.ProjectConfigCommittedReconcileError ? error.committed : false,
        attempts,
        username: config.username,
      }).toEqual({
        error: "ProjectConfigCommittedReconcileError",
        committed: true,
        attempts: 2,
        username: "retry-after",
      })
    } finally {
      GlobalBus.off("event", listener)
    }
  })

  test("a detached reader admitted by a writer settles before the next generation owner", async () => {
    await using project = await memoryProject()
    let releaseRead!: () => void
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    let resolveReadAdmitted!: () => void
    const readAdmitted = new Promise<void>((resolve) => {
      resolveReadAdmitted = resolve
    })
    const timeline: string[] = []
    let matchingEvents = 0
    const listener = (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
      if (
        event.directory !== project.path ||
        event.payload.type !== "config.changed" ||
        event.payload.properties?.username !== "drain-after"
      ) {
        return
      }
      matchingEvents += 1
      timeline.push(`event-${matchingEvents}`)
      Config.TestHooks.afterProjectConfigAdmission = async (input) => {
        if (input.directory !== project.path) return
        resolveReadAdmitted()
        await readGate
      }
      void Config.get().then(() => timeline.push("nested-read"))
    }
    GlobalBus.on("event", listener)
    const first = Instance.provide({
      directory: project.path,
      fn: () => Config.updateProjectPatch({ username: "drain-after" }),
    }).then(() => timeline.push("first-writer"))
    let second: Promise<number> | undefined
    try {
      await within("nested Config read admission", readAdmitted)
      second = Instance.provide({
        directory: project.path,
        fn: () => Config.updateProjectPatch({ username: "drain-final" }),
      }).then(() => timeline.push("second-writer"))
      releaseRead()
      await within("nested reader and serialized writers", Promise.all([first, second]))
      expect(timeline).toEqual(["event-1", "nested-read", "first-writer", "second-writer"])
    } finally {
      Config.TestHooks.afterProjectConfigAdmission = undefined
      releaseRead()
      GlobalBus.off("event", listener)
      await Promise.allSettled([first, ...(second ? [second] : [])])
    }
  })

  test("a loaded backend settles a peer Project write and publishes its current projection", async () => {
    await using changedProject = await memoryProject()
    await using isolatedProject = await memoryProject()

    const before = await Instance.provide({
      directory: changedProject.path,
      fn: async () => {
        return {
          config: await Config.get(),
          agent: await PrimaryAssistantRegistry.get("coding"),
        }
      },
    })
    const isolatedBefore = await Instance.provide({
      directory: isolatedProject.path,
      fn: async () => {
        await Config.updateProjectPatch({ agent: { coding: { description: "isolated" } } })
        return {
          config: await Config.get(),
          agent: await PrimaryAssistantRegistry.get("coding"),
        }
      },
    })

    let releaseMiddle!: () => void
    const middleGate = new Promise<void>((resolve) => {
      releaseMiddle = resolve
    })
    let resolveMiddleStarted!: () => void
    const middleStarted = new Promise<void>((resolve) => {
      resolveMiddleStarted = resolve
    })
    let resolveFinal!: () => void
    const finalObserved = new Promise<void>((resolve) => {
      resolveFinal = resolve
    })
    let resolveLater!: () => void
    const laterObserved = new Promise<void>((resolve) => {
      resolveLater = resolve
    })
    const observed: string[] = []
    const listener = async (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
      if (event.directory !== changedProject.path || event.payload.type !== "config.changed") return
      const description = event.payload.properties?.agent?.coding?.description
      if (!description) return
      observed.push(description)
      if (description === "peer-middle") {
        resolveMiddleStarted()
        await middleGate
      }
      if (description === "peer-after") resolveFinal()
      if (description === "peer-later") resolveLater()
    }
    GlobalBus.on("event", listener)

    const middleWorker = Bun.spawn(
      [
        "bun",
        "run",
        path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
        "project",
        changedProject.path,
        "peer-middle",
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const middleStdout = new Response(middleWorker.stdout).text()
    const middleStderr = new Response(middleWorker.stderr).text()
    let resolveLocalSettlementReady!: () => void
    const localSettlementReady = new Promise<void>((resolve) => {
      resolveLocalSettlementReady = resolve
    })
    Config.TestHooks.beforeProjectRuntimeSettlement = async (input) => {
      if (input.directory === changedProject.path && input.config.agent?.coding?.description === "peer-after") {
        resolveLocalSettlementReady()
      }
    }
    let finalMutation: Promise<Config.Info> | undefined
    let laterWorker: ReturnType<typeof Bun.spawn> | undefined
    let laterStdout: Promise<string> | undefined
    let laterStderr: Promise<string> | undefined

    try {
      await within("middle peer transition admission", middleStarted)
      const middleExitCode = await middleWorker.exited
      if (middleExitCode !== 0) {
        throw new Error(`Middle peer configuration writer exited ${middleExitCode}: ${await middleStderr}`)
      }
      finalMutation = Instance.provide({
        directory: changedProject.path,
        fn: () => Config.updateProjectPatch({ agent: { coding: { description: "peer-after" } } }),
      })
      await within("local Project settlement admission", localSettlementReady)
      releaseMiddle()
      await within("final queued peer transition", finalObserved)
      const finalConfig = await within("local Project mutation settlement", finalMutation)
      laterWorker = Bun.spawn(
        [
          "bun",
          "run",
          path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
          "project",
          changedProject.path,
          "peer-later",
        ],
        {
          cwd: path.resolve(import.meta.dir, ".."),
          env: { ...process.env },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      laterStdout = new Response(laterWorker.stdout).text()
      laterStderr = new Response(laterWorker.stderr).text()
      await within("peer write after local writer reset", laterObserved)
      const laterExitCode = await laterWorker.exited
      if (laterExitCode !== 0) throw new Error(`Later peer writer exited ${laterExitCode}: ${await laterStderr}`)
      const after = await Instance.provide({
        directory: changedProject.path,
        fn: async () => ({
          config: await Config.get(),
          agent: await PrimaryAssistantRegistry.get("coding"),
        }),
      })
      const isolatedAfter = await Instance.provide({
        directory: isolatedProject.path,
        fn: async () => ({
          config: await Config.get(),
          agent: await PrimaryAssistantRegistry.get("coding"),
        }),
      })

      expect({
        observed,
        middleExitCode,
        middleStdout: JSON.parse((await middleStdout).trim()),
        localMutation: finalConfig.agent?.coding?.description,
        laterExitCode,
        laterStdout: JSON.parse((await laterStdout).trim()),
        before: before.config.agent?.coding?.description ?? null,
        after: after.config.agent?.coding?.description,
        agentAfter: after.agent.description,
        changedAgentReplaced: after.agent === before.agent,
        isolated: isolatedAfter.config.agent?.coding?.description,
        isolatedAgentPreserved: isolatedAfter.agent === isolatedBefore.agent,
      }).toEqual({
        observed: ["peer-middle", "peer-after", "peer-later"],
        middleExitCode: 0,
        middleStdout: { description: "peer-middle" },
        localMutation: "peer-after",
        laterExitCode: 0,
        laterStdout: { description: "peer-later" },
        before: null,
        after: "peer-later",
        agentAfter: "peer-later",
        changedAgentReplaced: false,
        isolated: "isolated",
        isolatedAgentPreserved: true,
      })
    } finally {
      Config.TestHooks.beforeProjectRuntimeSettlement = undefined
      releaseMiddle()
      GlobalBus.off("event", listener)
      if (middleWorker.exitCode === null) middleWorker.kill()
      if (laterWorker?.exitCode === null) laterWorker.kill()
      await within("middle peer Project writer cleanup", middleWorker.exited, 5_000)
      if (laterWorker) await within("later peer Project writer cleanup", laterWorker.exited, 5_000)
      await finalMutation?.catch(() => undefined)
    }
  }, 45_000)

  test("a peer global write refreshes every loaded Project from the same canonical generation", async () => {
    await resetMemoryDatabase()
    await using firstProject = await memoryProject()
    await using secondProject = await memoryProject()
    let originalUsername: Config.Info["username"]
    await within(
      "initial global configuration",
      Config.updateGlobalPatchAtomic((_effective, currentWritable) => {
        originalUsername = currentWritable.username
        return { username: "peer-global-before" }
      }),
    )

    try {
      await within(
        "global peer cache warmup",
        Promise.all([
          Config.getGlobal(),
          Instance.provide({ directory: firstProject.path, fn: () => Config.get() }),
          Instance.provide({ directory: secondProject.path, fn: () => Config.get() }),
        ]),
      )

      let releaseMiddle!: () => void
      const middleGate = new Promise<void>((resolve) => {
        releaseMiddle = resolve
      })
      let resolveMiddleStarted!: () => void
      const middleStarted = new Promise<void>((resolve) => {
        resolveMiddleStarted = resolve
      })
      let resolveAfterChanged!: () => void
      const afterChanged = new Promise<void>((resolve) => {
        resolveAfterChanged = resolve
      })
      let resolveLaterChanged!: () => void
      const laterChanged = new Promise<void>((resolve) => {
        resolveLaterChanged = resolve
      })
      let resolveCrossSource!: () => void
      const crossSourceChanged = new Promise<void>((resolve) => {
        resolveCrossSource = resolve
      })
      const observed = new Map<string, string[]>()
      const listener = async (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
        if (event.payload.type !== "config.changed") return
        if (event.directory !== firstProject.path && event.directory !== secondProject.path) return
        const username = event.payload.properties?.username
        if (username !== "peer-global-middle" && username !== "peer-global-after" && username !== "peer-global-later") {
          return
        }
        const label =
          username === "peer-global-middle" &&
          event.directory === firstProject.path &&
          event.payload.properties?.agent?.coding?.description === "cross-source"
            ? "cross-source"
            : username
        const entries = observed.get(event.directory) ?? []
        entries.push(label)
        observed.set(event.directory, entries)
        if (
          username === "peer-global-middle" &&
          observed.get(firstProject.path)?.includes(username) &&
          observed.get(secondProject.path)?.includes(username)
        ) {
          resolveMiddleStarted()
          await middleGate
        }
        if (
          username === "peer-global-after" &&
          observed.get(firstProject.path)?.includes(username) &&
          observed.get(secondProject.path)?.includes(username)
        ) {
          resolveAfterChanged()
        }
        if (
          username === "peer-global-later" &&
          observed.get(firstProject.path)?.includes(username) &&
          observed.get(secondProject.path)?.includes(username)
        ) {
          resolveLaterChanged()
        }
        if (label === "cross-source") resolveCrossSource()
      }
      GlobalBus.on("event", listener)

      const worker = Bun.spawn(
        [
          "bun",
          "run",
          path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
          "global",
          firstProject.path,
          "peer-global-middle",
        ],
        {
          cwd: path.resolve(import.meta.dir, ".."),
          env: { ...process.env },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const workerStdout = new Response(worker.stdout).text()
      const workerStderr = new Response(worker.stderr).text()
      let resolveLocalSettlementReady!: () => void
      const localSettlementReady = new Promise<void>((resolve) => {
        resolveLocalSettlementReady = resolve
      })
      Config.TestHooks.beforeGlobalRuntimeSettlement = async (input) => {
        if (input.transitions.some((transition) => transition.after.username === "peer-global-after")) {
          resolveLocalSettlementReady()
        }
      }
      let localMutation: Promise<Config.Info> | undefined
      let crossSourceWorker: ReturnType<typeof Bun.spawn> | undefined
      let crossSourceStdout: Promise<string> | undefined
      let crossSourceStderr: Promise<string> | undefined
      let laterWorker: ReturnType<typeof Bun.spawn> | undefined
      let laterStdout: Promise<string> | undefined
      let laterStderr: Promise<string> | undefined

      try {
        await within("peer global middle transition", middleStarted, 30_000)
        const exitCode = await within("peer global writer exit", worker.exited)
        if (exitCode !== 0)
          throw new Error(`Peer global configuration writer exited ${exitCode}: ${await workerStderr}`)
        const stdout = await workerStdout
        crossSourceWorker = Bun.spawn(
          [
            "bun",
            "run",
            path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
            "project",
            firstProject.path,
            "cross-source",
          ],
          {
            cwd: path.resolve(import.meta.dir, ".."),
            env: { ...process.env },
            stdout: "pipe",
            stderr: "pipe",
          },
        )
        crossSourceStdout = new Response(crossSourceWorker.stdout).text()
        crossSourceStderr = new Response(crossSourceWorker.stderr).text()
        const crossSourceExitCode = await within("cross-source peer writer commit", crossSourceWorker.exited)
        if (crossSourceExitCode !== 0) {
          throw new Error(`Cross-source peer writer exited ${crossSourceExitCode}: ${await crossSourceStderr}`)
        }
        const crossSourceRead = await within(
          "cross-source Project admission",
          Instance.provide({ directory: firstProject.path, fn: () => Config.get() }),
        )
        localMutation = Config.updateGlobalPatch({ username: "peer-global-after" })
        await within("local global settlement admission", localSettlementReady)
        releaseMiddle()
        await within("cross-source Project transition", crossSourceChanged, 30_000)
        await within("local global transition", afterChanged, 30_000)
        const localConfig = await within("local global mutation settlement", localMutation)
        laterWorker = Bun.spawn(
          [
            "bun",
            "run",
            path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
            "global",
            firstProject.path,
            "peer-global-later",
          ],
          {
            cwd: path.resolve(import.meta.dir, ".."),
            env: { ...process.env },
            stdout: "pipe",
            stderr: "pipe",
          },
        )
        laterStdout = new Response(laterWorker.stdout).text()
        laterStderr = new Response(laterWorker.stderr).text()
        await within("peer global write after local writer reset", laterChanged, 30_000)
        const laterExitCode = await laterWorker.exited
        if (laterExitCode !== 0)
          throw new Error(`Later global peer writer exited ${laterExitCode}: ${await laterStderr}`)
        const [globalConfig, first, second] = await within(
          "global converged reads",
          Promise.all([
            Config.getGlobal(),
            Instance.provide({ directory: firstProject.path, fn: () => Config.get() }),
            Instance.provide({ directory: secondProject.path, fn: () => Config.get() }),
          ]),
        )
        expect({
          exitCode,
          stdout: JSON.parse(stdout.trim()),
          observed: [...observed.entries()].sort(([left], [right]) => left.localeCompare(right)),
          localUsername: localConfig.username,
          crossSourceExitCode,
          crossSourceStdout: JSON.parse((await crossSourceStdout).trim()),
          crossSourceRead: {
            username: crossSourceRead.username,
            description: crossSourceRead.agent?.coding?.description,
          },
          laterExitCode,
          laterStdout: JSON.parse((await laterStdout).trim()),
          globalUsername: globalConfig.username,
          projectUsernames: [first.username, second.username],
        }).toEqual({
          exitCode: 0,
          stdout: { username: "peer-global-middle" },
          observed: [
            [firstProject.path, ["peer-global-middle", "cross-source", "peer-global-after", "peer-global-later"]],
            [secondProject.path, ["peer-global-middle", "peer-global-after", "peer-global-later"]],
          ].sort(([left], [right]) => left.localeCompare(right)),
          localUsername: "peer-global-after",
          crossSourceExitCode: 0,
          crossSourceStdout: { description: "cross-source" },
          crossSourceRead: { username: "peer-global-middle", description: "cross-source" },
          laterExitCode: 0,
          laterStdout: { username: "peer-global-later" },
          globalUsername: "peer-global-later",
          projectUsernames: ["peer-global-later", "peer-global-later"],
        })
      } finally {
        Config.TestHooks.beforeGlobalRuntimeSettlement = undefined
        releaseMiddle()
        GlobalBus.off("event", listener)
        if (worker.exitCode === null) worker.kill()
        if (crossSourceWorker?.exitCode === null) crossSourceWorker.kill()
        if (laterWorker?.exitCode === null) laterWorker.kill()
        await within("peer global writer cleanup", worker.exited, 5_000)
        if (crossSourceWorker) await within("cross-source peer writer cleanup", crossSourceWorker.exited, 5_000)
        if (laterWorker) await within("later global peer writer cleanup", laterWorker.exited, 5_000)
        await localMutation?.catch(() => undefined)
      }
    } finally {
      await within("global configuration restore", Config.updateGlobalPatch({ username: originalUsername ?? null }))
    }
  }, 90_000)

  test("a global-only backend publishes the canonical settlement event after a peer write", async () => {
    await resetMemoryDatabase()
    await using writerProject = await memoryProject()
    const originalUsername = (await Config.getGlobal()).username
    const localConfig = await within(
      "global-only initial configuration",
      Config.updateGlobalPatch({ username: "global-only-before" }),
    )
    expect(localConfig.username).toBe("global-only-before")

    let resolveDisposed!: () => void
    const disposed = new Promise<void>((resolve) => {
      resolveDisposed = resolve
    })
    const listener = (event: { directory?: string; payload: { type?: string } }) => {
      if (event.directory === "global" && event.payload.type === "global.disposed") resolveDisposed()
    }
    GlobalBus.on("event", listener)
    const worker = Bun.spawn(
      [
        "bun",
        "run",
        path.join(import.meta.dir, "fixture", "config-peer-writer.ts"),
        "global",
        writerProject.path,
        "global-only-after",
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const stdout = new Response(worker.stdout).text()
    const stderr = new Response(worker.stderr).text()

    try {
      await within("global-only peer settlement event", disposed)
      const exitCode = await within("global-only peer writer exit", worker.exited)
      if (exitCode !== 0) throw new Error(`Global-only peer writer exited ${exitCode}: ${await stderr}`)
      expect({
        exitCode,
        stdout: JSON.parse((await stdout).trim()),
        username: (await Config.getGlobal()).username,
        loadedProjectStates: Config.state.inspectAll().length,
      }).toEqual({
        exitCode: 0,
        stdout: { username: "global-only-after" },
        username: "global-only-after",
        loadedProjectStates: 0,
      })
    } finally {
      GlobalBus.off("event", listener)
      if (worker.exitCode === null) worker.kill()
      await within("global-only peer writer cleanup", worker.exited, 5_000)
      await within(
        "global-only configuration restore",
        Config.updateGlobalPatch({ username: originalUsername ?? null }),
      )
    }
  }, 90_000)

  test("a Project activated inside a global commit reads the committed generation", async () => {
    await resetMemoryDatabase()
    await using activationProject = await memoryProject()
    const originalUsername = (await Config.getGlobal()).username
    await Config.updateGlobalPatch({ username: "activation-before" })

    let releasePersist!: () => void
    const persistGate = new Promise<void>((resolve) => {
      releasePersist = resolve
    })
    let resolveCandidateReady!: () => void
    const candidateReady = new Promise<void>((resolve) => {
      resolveCandidateReady = resolve
    })
    Config.TestHooks.beforeGlobalPersist = async () => {
      resolveCandidateReady()
      await persistGate
    }

    const mutation = Config.updateGlobalPatch({ username: "activation-after" })
    try {
      await within("global candidate enumeration", candidateReady)
      let resolveActivationStarted!: () => void
      const activationStarted = new Promise<void>((resolve) => {
        resolveActivationStarted = resolve
      })
      const activation = Instance.provide({
        directory: activationProject.path,
        fn: async () => {
          resolveActivationStarted()
          return Config.get()
        },
      })
      await within("Project activation admission", activationStarted)
      releasePersist()
      const [committed, activated] = await within(
        "global commit and Project activation",
        Promise.all([mutation, activation]),
      )
      expect({ committed: committed.username, activated: activated.username }).toEqual({
        committed: "activation-after",
        activated: "activation-after",
      })
    } finally {
      Config.TestHooks.beforeGlobalPersist = undefined
      releasePersist()
      await mutation.catch(() => undefined)
      await Config.updateGlobalPatch({ username: originalUsername ?? null })
    }
  }, 90_000)
})
