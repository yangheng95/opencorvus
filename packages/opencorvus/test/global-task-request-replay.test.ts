import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { GlobalTaskService } from "@/task-api/global-task-service"
import { resetMemoryDatabase } from "./fixture/memory"
import { Database, eq } from "@/storage/db"
import { EngineTaskTable } from "@/engine/engine.sql"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { GlobalTaskRequestOwnerTestHooks, withGlobalTaskRequestOwner } from "@/engine/task-creation-owner"

beforeAll(async () => {
  // Task execution mode is normally declared by the deployment; a unit test
  // is a native host.
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  // A global create allocates a fresh anonymous Project, whose effective
  // model can only come from the global configuration.
  await Config.updateGlobalPatch({
    model: "replay-test-provider/replay-test-model",
    provider: {
      "replay-test-provider": {
        name: "Replay test provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:9/replay-test-model",
        models: {
          "replay-test-model": {
            name: "Replay test model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
})

afterAll(resetMemoryDatabase)

describe("global Task request replay", () => {
  test("one padded request identity is normalized before ownership, replay and persistence", async () => {
    const requestID = Identifier.ascending("call")
    const paddedRequestID = `  ${requestID}  `
    const base = {
      title: "Normalized global request",
      request: "Create one Task for one canonical request identity",
      productPillar: "code" as const,
      source: "test",
    }
    const results = await Promise.all([
      GlobalTaskService.create({ ...base, requestID: paddedRequestID }),
      GlobalTaskService.create({ ...base, requestID }),
      GlobalTaskService.create({ ...base, requestID: paddedRequestID }),
    ])
    const rows = Database.use((db) =>
      db
        .select({
          id: EngineTaskTable.id,
          projectID: EngineTaskTable.project_id,
          requestID: EngineTaskTable.request_id,
        })
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, results[0]!.task_id))
        .all(),
    )

    expect({ results, rows }).toEqual({
      results: [results[0], results[0], results[0]],
      rows: [{ id: results[0]!.task_id, projectID: results[0]!.project_id, requestID }],
    })
  }, 120_000)

  test("the same request identity in two runtime roots has two independent local owners", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Global Task root isolation test requires the repository test runtime")
    const firstRoot = await createManagedTemporaryDirectory(processRoot, "global-task-owner-root-a-")
    const secondRoot = await createManagedTemporaryDirectory(processRoot, "global-task-owner-root-b-")
    const requestID = Identifier.ascending("call")
    const firstEntered = Promise.withResolvers<void>()
    const releaseFirst = Promise.withResolvers<void>()
    let first: Promise<string> | undefined
    try {
      first = Global.provideRoot(firstRoot, () =>
        withGlobalTaskRequestOwner(requestID, async () => {
          firstEntered.resolve()
          await releaseFirst.promise
          return "first-root"
        }),
      )
      await firstEntered.promise
      const second = Global.provideRoot(secondRoot, () =>
        withGlobalTaskRequestOwner(requestID, async () => "second-root"),
      )
      expect(await second).toBe("second-root")
      releaseFirst.resolve()
      expect(await first).toBe("first-root")
    } finally {
      releaseFirst.resolve()
      await first?.catch(() => undefined)
      await removeManagedDirectoryTree(firstRoot)
      await removeManagedDirectoryTree(secondRoot)
    }
  }, 30_000)

  test("an owner hook failure settles the started operation before releasing its local owner", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Global Task owner lifecycle test requires the repository test runtime")
    const runtimeRoot = await createManagedTemporaryDirectory(processRoot, "global-task-owner-hook-failure-")
    const requestID = Identifier.ascending("call")
    const operationEntered = Promise.withResolvers<void>()
    const finishOperation = Promise.withResolvers<void>()
    const hookFailure = new Error("owner receipt publication failed")
    const events: string[] = []
    const hook = GlobalTaskRequestOwnerTestHooks.replaceAfterProcessOwnerStarted(async () => {
      throw hookFailure
    })
    try {
      const caller = Global.provideRoot(runtimeRoot, () =>
        withGlobalTaskRequestOwner(requestID, async () => {
          events.push("operation-entered")
          operationEntered.resolve()
          await finishOperation.promise
          events.push("operation-settled")
          return "committed"
        }),
      ).then(
        () => events.push("caller-fulfilled"),
        (error) => {
          events.push("caller-rejected")
          throw error
        },
      )
      await operationEntered.promise
      finishOperation.resolve()
      await expect(caller).rejects.toBe(hookFailure)
    } finally {
      finishOperation.resolve()
      hook[Symbol.dispose]()
    }

    const next = await Global.provideRoot(runtimeRoot, () =>
      withGlobalTaskRequestOwner(requestID, async () => {
        events.push("next-owner-entered")
        return "next-owner"
      }),
    )
    expect({ events, next }).toEqual({
      events: ["operation-entered", "operation-settled", "caller-rejected", "next-owner-entered"],
      next: "next-owner",
    })
    await removeManagedDirectoryTree(runtimeRoot)
  }, 30_000)

  test("concurrent creates with one global request commit one Project and Task result", async () => {
    const requestID = Identifier.ascending("call")
    const input = {
      title: "Concurrent global request",
      request: "Create one Task even when the request is delivered concurrently",
      productPillar: "code" as const,
      source: "test",
      requestID,
    }

    // Each async call performs its initial replay lookup synchronously before
    // ImplicitProject.create reaches its first filesystem await. Without the
    // global owner all four therefore observe an empty lookup deterministically
    // and allocate different Projects; the current owner makes them join.
    const results = await Promise.all(Array.from({ length: 4 }, () => GlobalTaskService.create(input)))
    const rows = Database.use((db) =>
      db.select().from(EngineTaskTable).where(eq(EngineTaskTable.request_id, requestID)).all(),
    )

    expect({ results, rows: rows.map((row) => ({ id: row.id, projectID: row.project_id })) }).toEqual({
      results: Array.from({ length: 4 }, () => results[0]),
      rows: [{ id: results[0]!.task_id, projectID: results[0]!.project_id }],
    })
  }, 120_000)

  test("two backend processes join the global request before either allocates a Project", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Global Task process test requires the repository test runtime")
    const sharedRuntime = await createManagedTemporaryDirectory(processRoot, "global-task-owner-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "global-task-owner-barrier-")
    const requestID = Identifier.ascending("call")
    const worker = path.join(import.meta.dir, "fixture", "global-task-request-process-worker.ts")
    const environment = {
      ...process.env,
      OPENCORVUS_HOME: sharedRuntime,
      OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
    }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "init" | "holder" | "contender") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          barrier,
          requestID,
        ],
        {
          cwd: path.join(import.meta.dir, ".."),
          env: environment,
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as {
        initialized?: boolean
        result?: { task_id: string; project_id: string; directory: string }
        rows?: Array<{ id: string; projectID: string }>
      }
    }
    const waitForBarrier = async (name: string) => {
      const target = path.join(barrier, name)
      const deadline = Date.now() + 30_000
      while (!(await fs.stat(target).catch(() => undefined))) {
        if (Date.now() >= deadline) throw new Error(`Global Task worker did not reach ${name}`)
        await Bun.sleep(5)
      }
    }

    try {
      expect(await read(spawn("init"))).toEqual({ initialized: true })
      const holder = spawn("holder")
      await waitForBarrier("holder.lookup")
      const contender = spawn("contender")
      await waitForBarrier("contender.owner-started")
      await fs.writeFile(path.join(barrier, "holder.release"), "release")
      const raced = await Promise.all([read(holder), read(contender)])
      expect(raced).toEqual([
        {
          result: expect.objectContaining({
            task_id: raced[0]!.result!.task_id,
            project_id: raced[0]!.result!.project_id,
            directory: raced[0]!.result!.directory,
          }),
          rows: [{ id: raced[0]!.result!.task_id, projectID: raced[0]!.result!.project_id }],
        },
        {
          result: raced[0]!.result,
          rows: [{ id: raced[0]!.result!.task_id, projectID: raced[0]!.result!.project_id }],
        },
      ])
      expect(JSON.parse(await fs.readFile(path.join(barrier, "contender.lookup"), "utf8"))).toEqual({
        committed: true,
      })
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill()
      }
      await Promise.allSettled(children.map((child) => child.exited))
      await removeManagedDirectoryTree(sharedRuntime)
      await removeManagedDirectoryTree(barrier)
    }
  }, 120_000)

  test("a replayed global create resolves the first attempt's Project and Task instead of allocating anew", async () => {
    const requestID = Identifier.ascending("call")
    const input = {
      title: "Global replay",
      request: "Create exactly one Task for this request",
      productPillar: "code" as const,
      source: "test",
      requestID,
    }

    const first = await GlobalTaskService.create(input)
    expect(first.task_id).toMatch(/\w+/)

    // The caller lost the first response and retries the documented body.
    // Before the request identity resolved globally, this allocated a second
    // random Project and a second Task the first response never named.
    const replay = await GlobalTaskService.create(input)
    expect(replay).toEqual(first)
  }, 120_000)

  test("a conflicting replay is refused by the same per-project idempotency contract every create uses", async () => {
    const requestID = Identifier.ascending("call")
    const first = await GlobalTaskService.create({
      title: "Global conflict",
      request: "Create exactly one Task for this request",
      productPillar: "code" as const,
      source: "test",
      requestID,
    })
    expect(first.task_id).toMatch(/\w+/)

    await expect(
      GlobalTaskService.create({
        title: "Global conflict",
        request: "Create exactly one Task for this request",
        productPillar: "work" as const,
        source: "test",
        requestID,
      }),
    ).rejects.toThrow(`Task request ${requestID} already committed as ${first.task_id} with a different product pillar`)
  }, 120_000)
})
