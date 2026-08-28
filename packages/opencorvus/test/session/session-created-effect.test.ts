import { afterEach, describe, expect, test } from "bun:test"
import { GlobalBus } from "@/bus/global"
import { Instance } from "@/project/instance"
import { EventService } from "@/scheduler/event-service"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Session Created post-commit lifecycle", () => {
  test("delivers the exact global Created envelope from the durable post-commit publication", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EventService.init({ sessionWake: SessionWake })
        const received: Array<{ directory?: string; payload: unknown }> = []
        let resolveCreated!: () => void
        const created = new Promise<void>((resolve) => (resolveCreated = resolve))
        const listener = (envelope: { directory?: string; payload: unknown }) => {
          received.push(envelope)
          const payload = envelope.payload as { type?: string; properties?: { info?: { title?: string } } }
          if (
            envelope.directory === project.path &&
            payload.type === Session.Event.Created.type &&
            payload.properties?.info?.title === "Created effect positive contract"
          ) {
            resolveCreated()
          }
        }
        GlobalBus.on("event", listener)
        try {
          const session = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            title: "Created effect positive contract",
          })

          await Promise.race([
            created,
            Bun.sleep(2_000).then(() => {
              throw new Error(`Session ${session.id} Created envelope did not arrive`)
            }),
          ])

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
