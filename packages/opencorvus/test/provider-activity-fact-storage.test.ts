import { afterEach, describe, expect, test } from "bun:test"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Database as BunDatabase } from "bun:sqlite"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import {
  recordProviderActivityEvent,
  settleAbandonedProviderActivity,
} from "@/session/provider-activity-facts"
import { ProviderActivityOutcomeTable, ProviderActivityRequestTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Provider activity fact storage", () => {
  test("reserves the cross-process writer before reading a Provider activity occurrence", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process Provider activity test requires the repository test runtime")
    await using project = await memoryProject()
    const barrier = await createManagedTemporaryDirectory(processRoot, "provider-activity-writer-")
    let child: ReturnType<typeof Bun.spawn> | undefined
    let lock: BunDatabase | undefined
    let locked = false
    try {
      const facts = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "assistant", title: "Provider writer reservation" })
          const now = Date.now()
          const user = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            time: { created: now },
            agent: "assistant",
            model: { providerID: "provider-activity-cross-process", modelID: "writer-reservation" },
          })
          const assistant = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            parentID: user.id,
            role: "assistant",
            author: "assistant",
            time: { created: now + 1 },
            agent: "assistant",
            providerID: "provider-activity-cross-process",
            modelID: "writer-reservation",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          })
          return { session, assistant, activityID: Identifier.ascending("activity") }
        },
      })
      const worker = path.join(import.meta.dir, "fixture", "provider-activity-writer-process-worker.ts")
      child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          project.path,
          barrier,
          facts.session.id,
          facts.assistant.id,
          facts.activityID,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
      )
      const waitForFile = async (name: string) => {
        const deadline = Date.now() + 15_000
        while (!(await fs.stat(path.join(barrier, name)).catch(() => undefined))) {
          if (Date.now() >= deadline) throw new Error(`Provider activity worker did not publish ${name}`)
          await Bun.sleep(10)
        }
      }
      await waitForFile("ready")

      lock = new BunDatabase(Database.Path())
      lock.run("PRAGMA busy_timeout = 5000")
      lock.run("BEGIN IMMEDIATE")
      locked = true
      await fs.writeFile(path.join(barrier, "start"), "start")
      await waitForFile("attempting")
      // The worker has entered the production writer while this independent
      // connection owns SQLite's writer reservation. A deferred transaction
      // can read here and then fail its upgrade; BEGIN IMMEDIATE waits instead.
      await Bun.sleep(250)
      lock.run("COMMIT")
      locked = false

      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      expect(JSON.parse(stdout.trim())).toEqual({ activityID: facts.activityID })
      expect(
        Database.use((db) => ({
          request: db
            .select()
            .from(ProviderActivityRequestTable)
            .where(eq(ProviderActivityRequestTable.id, facts.activityID))
            .get(),
          outcome: db
            .select()
            .from(ProviderActivityOutcomeTable)
            .where(eq(ProviderActivityOutcomeTable.request_id, facts.activityID))
            .get(),
        })),
      ).toEqual({
        request: {
          id: facts.activityID,
          assistant_message_id: facts.assistant.id,
          time_created: expect.any(Number),
        },
        outcome: {
          id: expect.any(String),
          request_id: facts.activityID,
          data: { outcome: "done", attempt_count: 1 },
          time_created: expect.any(Number),
        },
      })
    } finally {
      if (locked) lock?.run("ROLLBACK")
      lock?.close(false)
      if (child && child.exitCode === null) child.kill()
      if (child) await child.exited
      await removeManagedDirectoryTree(barrier)
    }
  }, 30_000)

  test("streams multiple Provider steps into one effect-bound assistant with fixed causal/model identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Provider fact storage" })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "assistant",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "assistant",
          time: { created: now + 1 },
          agent: "assistant",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const activityID = Identifier.ascending("activity")
        recordProviderActivityEvent(assistant.id, {
          type: "started",
          id: activityID,
          ts: now + 2,
          sessionID: session.id,
          provider: "openai",
          model: "gpt-5.6-terra",
        })
        const secondActivityID = Identifier.ascending("activity")
        recordProviderActivityEvent(assistant.id, {
          type: "started",
          id: secondActivityID,
          ts: now + 3,
          sessionID: session.id,
          provider: "openai",
          model: "gpt-5.6-terra",
        })
        const streamed = await Session.updateMessage({
          ...assistant,
          cost: 0.25,
          tokens: { ...assistant.tokens, input: 4, output: 3, total: 7 },
        })
        expect(streamed).toMatchObject({
          parentID: user.id,
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          cost: 0.25,
          tokens: { input: 4, output: 3, total: 7 },
        })
        await expect(Session.updateMessage({ ...streamed, modelID: "different-model" })).rejects.toThrow(
          `Assistant Message ${assistant.id} effect causal/model identity is immutable`,
        )
        recordProviderActivityEvent(assistant.id, { type: "terminal", id: activityID, ts: now + 4, outcome: "done" })
        recordProviderActivityEvent(assistant.id, {
          type: "terminal",
          id: secondActivityID,
          ts: now + 5,
          outcome: "done",
        })
        const completed = await Session.updateMessage({
          ...streamed,
          finish: "stop",
          time: { ...streamed.time, completed: now + 6 },
        })
        expect(completed.time.completed).toBe(now + 6)

        const facts = Database.use((db) => ({
          requests: db.select().from(ProviderActivityRequestTable).all(),
          outcomes: db.select().from(ProviderActivityOutcomeTable).all(),
        }))
        expect(facts.requests).toEqual([
          { id: activityID, assistant_message_id: assistant.id, time_created: now + 2 },
          { id: secondActivityID, assistant_message_id: assistant.id, time_created: now + 3 },
        ])
        expect(facts.outcomes).toEqual([
          {
            id: expect.any(String),
            request_id: activityID,
            data: { outcome: "done", attempt_count: 1 },
            time_created: now + 4,
          },
          {
            id: expect.any(String),
            request_id: secondActivityID,
            data: { outcome: "done", attempt_count: 1 },
            time_created: now + 5,
          },
        ])
      },
    })
  })

  test("lets a late receipt stand down to a recovery verdict while still refusing two owned results", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Late provider receipt" })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "assistant",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "assistant",
          time: { created: now + 1 },
          agent: "assistant",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const abandoned = Identifier.ascending("activity")
        const owned = Identifier.ascending("activity")
        for (const [id, ts] of [
          [abandoned, now + 2],
          [owned, now + 3],
        ] as const) {
          recordProviderActivityEvent(assistant.id, {
            type: "started",
            id,
            ts,
            sessionID: session.id,
            provider: "openai",
            model: "gpt-5.6-terra",
          })
        }

        // The owner of the second call did return; only the first is abandoned.
        recordProviderActivityEvent(assistant.id, { type: "terminal", id: owned, ts: now + 4, outcome: "done" })
        expect(
          settleAbandonedProviderActivity({
            assistantMessageID: assistant.id,
            now: now + 5,
            reason: "Previous process ended mid-call",
          }),
        ).toEqual([abandoned])

        // An activation lease can expire while the call it covers is still
        // streaming, so the owner can return after recovery already spoke for
        // it. The recovery verdict stands; it must not fault the caller.
        recordProviderActivityEvent(assistant.id, { type: "terminal", id: abandoned, ts: now + 6, outcome: "done" })

        // Two receipts that both claim an owned result stay a Host bug.
        expect(() =>
          recordProviderActivityEvent(assistant.id, {
            type: "terminal",
            id: owned,
            ts: now + 7,
            outcome: "failed",
            cls: "server_5xx",
          }),
        ).toThrow(`Provider activity ${owned} has conflicting terminal receipts.`)

        const outcomes = Database.use((db) =>
          db.select().from(ProviderActivityOutcomeTable).orderBy(ProviderActivityOutcomeTable.time_created).all(),
        )
        expect(outcomes.map((outcome) => [outcome.request_id, outcome.data])).toEqual([
          [owned, { outcome: "done", attempt_count: 1 }],
          [
            abandoned,
            {
              outcome: "aborted",
              attempt_count: 1,
              error_class: "external_abort",
              error: { name: "ProcessExecutionInterruptedError", message: "Previous process ended mid-call" },
            },
          ],
        ])
      },
    })
  })
})
