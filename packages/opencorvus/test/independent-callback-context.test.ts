import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { EventService } from "@/scheduler/event-service"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function callbackDiagnostics() {
  await Log.flush()
  const log = await Log.read({ lines: 200 })
  return log.lines.flatMap((line) => {
    const row = JSON.parse(line)
    return row.level === "error" || row.message?.includes("background work") ? [row] : []
  })
}

test("post-commit discovery settles the exact accepted Event fire under its independent database owner", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const job = await EventService.create({
        name: "independent effect discovery",
        eventType: "test.independent.event",
        prompt: "finite callback",
        projectId: Instance.project.id,
        oneShot: true,
      })
      using wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
        sessionID: fire.target_session_id,
        messageID: `message:${fire.id}`,
      }))
      Database.effect(() =>
        EventService.TestHooks.acceptEnvelope({
          occurrenceID: "event:independent-post-commit",
          type: "test.independent.event",
          properties: { value: "original" },
        }),
      )
      await Database.awaitEffectIdle(5_000)
      await EventService.TestHooks.waitForIdle()
      if (EventService.TestHooks.fires(Instance.project.id)[0]?.status !== "succeeded") {
        console.info(JSON.stringify(await callbackDiagnostics()))
      }
      expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
        expect.objectContaining({
          event_job_id: job.id,
          event_occurrence_id: "event:independent-post-commit",
          status: "succeeded",
        }),
      ])
    },
  })
})

test("native HEAD callbacks perform database work for their original Projects after initialization effects settle", async () => {
  await using first = await memoryProject("native-callback-first")
  await using second = await memoryProject("native-callback-second")
  const observed: Array<{ projectID: string; directory: string; file: string; sessionID: string }> = []
  const sources: Array<{ projectID: string; directory: string; head: string; bytes: Buffer; stop: () => void }> = []
  const expected = new Map<string, Promise<void>>()
  try {
    for (const project of [first, second]) {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const head = path.join(project.path, ".git", "HEAD")
          const projectID = Instance.project.id
          const receipt = Promise.withResolvers<void>()
          expected.set(projectID, receipt.promise)
          const stop = Bus.subscribe(FileWatcher.Event.Updated, async ({ properties }) => {
            if (properties.file !== head) return
            const session = await Session.create({ kind: "assistant", title: "Native file event database receipt" })
            const persisted = await Session.get(session.id)
            observed.push({
              projectID: persisted.projectID,
              directory: persisted.directory,
              file: properties.file,
              sessionID: persisted.id,
            })
            receipt.resolve()
          })
          sources.push({ projectID, directory: project.path, head, bytes: await fs.readFile(head), stop })
          Database.effect(() => FileWatcher.init())
          await Database.awaitEffectIdle(5_000)
        },
      })
    }
    for (const source of sources) await fs.writeFile(source.head, source.bytes)
    let watchdog: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        Promise.all(expected.values()),
        new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => {
            void callbackDiagnostics().then(
              (rows) =>
                reject(
                  new Error("Native HEAD callbacks did not persist both Project receipts: " + JSON.stringify(rows)),
                ),
              reject,
            )
          }, 5_000)
        }),
      ])
    } finally {
      if (watchdog) clearTimeout(watchdog)
    }
    for (const source of sources) {
      expect(observed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectID: source.projectID, directory: source.directory, file: source.head }),
        ]),
      )
    }
  } finally {
    for (const source of sources) source.stop()
  }
}, 30_000)
