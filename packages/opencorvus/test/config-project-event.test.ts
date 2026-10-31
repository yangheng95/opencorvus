import { afterEach, expect, test } from "bun:test"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a committed Project configuration publishes its declared public event", async () => {
  await using project = await memoryProject()
  const received: Array<{ directory?: string; payload: unknown }> = []
  const listener = (event: { directory?: string; payload: { type?: string } }) => {
    if (event.directory === project.path && event.payload.type === Config.Event.ProjectChanged.type) {
      received.push({ directory: event.directory, payload: BusEvent.payloads().parse(event.payload) })
    }
  }
  GlobalBus.on("event", listener)
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const saved = await Config.updateProjectPatch({ assistant: { max_executor_groups: 4 } })
        expect(saved.assistant?.max_executor_groups).toBe(4)
        expect(received).toEqual([
          {
            directory: project.path,
            payload: {
              type: "project.config.changed",
              properties: Config.Info.parse(await Config.get()),
            },
          },
        ])
      },
    })
  } finally {
    GlobalBus.off("event", listener)
  }
})

test("the public Session configuration event retains its exact Session authority", () => {
  const sessionID = "ses_project_config_contract"
  expect(
    BusEvent.payloads().parse({
      type: Session.Event.ConfigChanged.type,
      properties: { sessionID },
    }),
  ).toEqual({
    type: "config.changed",
    properties: { sessionID },
  })
})
