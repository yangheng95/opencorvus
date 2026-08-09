import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { InstanceLifecycleContext } from "@/project/instance-lifecycle-context"
import { SessionTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a persistent watcher callback owns its complete database subscriber and GlobalBus publication", async () => {
  await using project = await memoryProject()
  const globalEvents: Array<{ directory?: string; payload: { type?: string } }> = []
  const onGlobalEvent = (event: { directory?: string; payload: { type?: string } }) => globalEvents.push(event)
  GlobalBus.on("event", onGlobalEvent)
  let unsubscribe = () => undefined
  let publication!: Promise<void>
  const subscriberProjects: string[] = []
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async () => {
          await new Promise((resolve) => setTimeout(resolve, 25))
          Database.use((db) => db.select({ id: SessionTable.id }).from(SessionTable).limit(1).all())
          subscriberProjects.push(Instance.project.id)
        })
        const runPersistentCallback = FileWatcher.TestHooks.persistentCallbackRunner(InstanceLifecycleContext.use())
        publication = runPersistentCallback(project.path, "focused watcher publication", () =>
          Bus.publish(FileWatcher.Event.Updated, { file: `${project.path}\\owned.ts`, event: "change" }),
        )
        expect(projectID).toBe(Instance.project.id)
      },
    })

    await publication
    expect(subscriberProjects).toHaveLength(1)
    expect(
      globalEvents
        .filter((event) => event.payload.type === FileWatcher.Event.Updated.type)
        .map((event) => event.directory),
    ).toEqual([project.path])
  } finally {
    unsubscribe()
    GlobalBus.off("event", onGlobalEvent)
  }
})
