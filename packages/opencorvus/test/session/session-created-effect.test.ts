import { afterEach, describe, expect, test } from "bun:test"
import { GlobalBus } from "@/bus/global"
import { Instance } from "@/project/instance"
import { EventService } from "@/scheduler/event-service"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Session Created post-commit lifecycle", () => {
  test("keeps database subscribers and the exact global Created envelope inside the effect lifetime", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EventService.init()
        const received: Array<{ directory?: string; payload: unknown }> = []
        const listener = (envelope: { directory?: string; payload: unknown }) => {
          received.push(envelope)
        }
        GlobalBus.on("event", listener)
        try {
          const session = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            title: "Created effect positive contract",
          })

          await Database.awaitEffectIdle(2_000)

          expect(await Session.get(session.id)).toEqual(session)
          expect(
            received
              .filter(
                (envelope) =>
                  (envelope.payload as { type?: string }).type === Session.Event.Created.type &&
                  (envelope.payload as { properties?: { info?: { id?: string } } }).properties?.info?.id === session.id,
              )
              .map((envelope) => ({
                directory: envelope.directory,
                type: (envelope.payload as { type: string }).type,
                sessionID: (envelope.payload as { properties: { info: { id: string } } }).properties.info.id,
              })),
          ).toEqual([
            {
              directory: project.path,
              type: Session.Event.Created.type,
              sessionID: session.id,
            },
          ])
        } finally {
          GlobalBus.off("event", listener)
        }
      },
    })
  })
})
