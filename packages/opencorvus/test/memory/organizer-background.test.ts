import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { EffectiveConfig } from "@/config/effective"
import { Identifier } from "@/id/id"
import { ProjectMemory } from "@/memory/project-memory"
import { ProjectMemoryOrganizer } from "@/memory/project-memory-organizer"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import type { Message } from "@/session/message"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("condition did not settle in time")
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

function userMessage(sessionID: string, text: string) {
  const info: Message.User = {
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "assistant",
    model: { providerID: "test", modelID: "organizer-background" },
    time: { created: Date.now() },
    extra: ProjectMemory.userInputExtra({ surface: "test.prompt", literalText: text }),
  }
  const part: Message.TextPart = {
    id: Identifier.ascending("part"),
    sessionID,
    messageID: info.id,
    type: "text",
    text,
    kind: "user_content",
    source: "user",
  }
  return { info, parts: [part] }
}

describe("organizer runs behind the request, not inside it", () => {
  test("a user message's own settlement does not wait for the organizer's turn", async () => {
    await using project = await memoryProject()

    let releaseOrganizer!: () => void
    const organizerHeld = new Promise<void>((resolve) => {
      releaseOrganizer = resolve
    })
    let organizerEntered = false
    const configSpy = spyOn(EffectiveConfig, "effective").mockImplementation(async () => {
      organizerEntered = true
      // Hold the organizer where its model turn would run. The message that
      // triggered it must settle while this is held — awaiting the turn inside
      // the durable delivery is exactly what coupled a session's HTTP
      // settlement to model latency.
      await organizerHeld
      return {} as never
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          ProjectMemoryOrganizer.init()
          const session = await Session.create({ kind: "assistant", title: "Organizer decoupling" })
          const settled = Session.persistMessage(userMessage(session.id, "Remember this input"))
          await Promise.race([
            settled,
            new Promise((_resolve, reject) =>
              setTimeout(() => reject(new Error("message settlement waited on the organizer")), 8_000),
            ),
          ])

          // The organizer really was triggered by that message and is running
          // in the background right now.
          await waitFor(() => organizerEntered)

          // Releasing it lets the run settle through its own durable states —
          // with an empty effective config the model is unresolvable, which is
          // the deterministic `unavailable` settlement.
          releaseOrganizer()
          await waitFor(() => ProjectMemory.read(Instance.project.id).status === "unavailable")
        },
      })
    } finally {
      releaseOrganizer()
      configSpy.mockRestore()
    }
  }, 60_000)
})
