import { afterEach, expect, spyOn, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { SessionPrompt } from "@/session/prompt"
import {
  currentOrchestratorControlMessage,
  materializeOrReuseCurrentOrchestratorControlMessage,
} from "@/orchestrator/agent"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { resetDatabase } from "./fixture/db"
import { tmpdir } from "./fixture/fixture"

const model = { providerID: "test", modelID: "orchestrator-control-message" }

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("exact terminal ingress persists one visible Orchestrator control Message and reuses it", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Orchestrator exact terminal ingress" })
      const wakeID = "art_exact_terminal_control_wake"
      const event = OrchestratorEventSchema.parse({
        dispatchInfrastructureFailure: {
          infrastructureFactID: "art_dispatch_infrastructure_failure",
          outcome: {
            kind: "infrastructure_failure",
            operation: "worker_dispatch",
            message: "worker dispatch could not acquire its physical owner",
            error_name: "WorkerDispatchUnavailableError",
            recovery_authority: { occurrence_status: "occurrence_not_committed" },
            infrastructure_error: {
              source: "engine_artifact",
              artifact_id: "art_dispatch_infrastructure_failure",
              catalog_revision: 1,
              expected_sha256: "a".repeat(64),
            },
          },
        },
      })
      const control = currentOrchestratorControlMessage(event, "tsk_exact_terminal_control", wakeID)!
      const prompt = spyOn(SessionPrompt, "prompt").mockImplementation(async (input: any) => {
        expect(input).toMatchObject({
          sessionID: session.id,
          messageID: control.messageID,
          author: "orchestrator",
          agent: "orchestrator",
          noReply: true,
          extra: control.extra,
        })
        return await Session.persistMessage({
          info: {
            id: input.messageID,
            role: "user",
            author: input.author,
            sessionID: input.sessionID,
            time: { created: Date.now() },
            agent: input.agent,
            model: input.model,
            extra: input.extra,
          },
          parts: input.parts.map((part: any) => ({
            ...part,
            sessionID: input.sessionID,
            messageID: input.messageID,
          })),
        })
      })
      try {
        await materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control })
        const first = await MessageStore.get({ sessionID: session.id, messageID: control.messageID })
        await materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control })
        const second = await MessageStore.get({ sessionID: session.id, messageID: control.messageID })

        expect(second).toEqual(first)
        expect(first).toMatchObject({
          info: {
            role: "user",
            author: "orchestrator",
            agent: "orchestrator",
            extra: control.extra,
          },
          parts: [
            {
              id: control.partID,
              type: "text",
              text: control.text,
              kind: "control",
              source: "system",
              metadata: control.partMetadata,
            },
          ],
        })
        const messages = []
        for await (const message of MessageStore.stream(session.id)) messages.push(message.info.id)
        expect(messages).toEqual([control.messageID])
        const visibleTranscript = await Session.messages({ sessionID: session.id })
        expect(visibleTranscript).toEqual([first])
        expect(prompt).toHaveBeenCalledTimes(1)
      } finally {
        prompt.mockRestore()
      }
    },
  })
})
