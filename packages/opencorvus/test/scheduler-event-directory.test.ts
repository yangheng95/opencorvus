import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { EventService } from "@/scheduler/event-service"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const Source = BusEvent.define("test.event.target-directory", z.object({ text: z.string() }))

afterEach(async () => {
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState()
  await resetMemoryDatabase()
})

for (const target of ["new", "existing"] as const) {
  test(`an Event ${target} Session uses its canonical target directory from a child publication`, async () => {
    await using fixture = await memoryProject()
    const child = path.join(fixture.path, "registered-child")
    await fs.mkdir(child)
    const project = await Project.fromDirectory(fixture.path)
    await Project.addSandbox(project.project.id, child)
    const observed = Promise.withResolvers<{ executionDirectory: string; sessionDirectory: string; targetID: string }>()
    using boundary = EventService.TestHooks.installBeforeSessionWake(async ({ fire }) => {
      const session = await Session.get(fire.target_session_id)
      observed.resolve({
        executionDirectory: Instance.directory,
        sessionDirectory: session.directory,
        targetID: session.id,
      })
      throw new Error("ACTUAL_SESSION_CREATION_OBSERVED_BEFORE_PROVIDER")
    })
    await Instance.provide({
      directory: child,
      fn: async () => {
        const session =
          target === "existing"
            ? await Session.create({ kind: "assistant", title: "Original child target" })
            : undefined
        EventService.init({ sessionWake: SessionWake })
        await EventService.create({
          name: "Canonical Event directory",
          projectId: Instance.project.id,
          sessionId: session?.id,
          eventType: Source.type,
          prompt: "Actual directory boundary",
        })
        await Bus.publishOwned(Source, { text: "Original child source" })
        const result = await observed.promise
        const expected = target === "new" ? fixture.path : child
        expect(result.executionDirectory).toBe(expected)
        expect(result.sessionDirectory).toBe(expected)
        expect((await Session.get(result.targetID)).projectID).toBe(project.project.id)
        if (session) expect(result.targetID).toBe(session.id)
      },
    })
  }, 60_000)
}
