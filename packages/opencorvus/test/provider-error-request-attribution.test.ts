import { afterEach, expect, spyOn, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import type { Provider } from "@/provider/provider"
import {
  ensureTaskMessageProtocolBridge,
  awaitTaskMessageProtocolBridgeIdle,
} from "@/orchestrator/protocol/message-bridge"
import { ProtocolStore } from "@/protocol/store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { rejectLocalStream } from "./fixture/rejected-local-stream"
import { Bus } from "@/bus"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

for (const agentID of ["memory", "title", "coding"])
  test(`persists and replays the actual ${agentID} stream request identity`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Local request provenance" })
        ensureTaskMessageProtocolBridge()
        const model = {
          id: "local-catalog-model",
          providerID: "local-attribution",
          name: "Local",
          api: { id: "local-wire-model", npm: "@ai-sdk/openai", url: "http://127.0.0.1" },
          limit: { context: 100000, input: 90000, output: 4096 },
          cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
          capabilities: {
            temperature: true,
            toolcall: true,
            attachment: false,
            reasoning: false,
            input: { text: true },
            output: { text: true },
          },
          options: {},
          headers: {},
          status: "active",
          release_date: "2026-09-09",
        } as Provider.Model
        const requestID = `${agentID}-source-occurrence`
        const publications: Bus.Publication[] = []
        const publish = Bus.publishOwned
        using observed = spyOn(Bus, "publishOwned").mockImplementation((definition, properties) => {
          const publication = publish(definition, properties)
          if (definition.type === Session.Event.Error.type && properties.sessionID === session.id) {
            publications.push(publication)
          }
          return publication
        })
        await rejectLocalStream({ sessionID: session.id, agentID, requestID, model })
        expect(publications).toHaveLength(1)
        await Promise.all(publications.map((publication) => publication.retry()))
        await awaitTaskMessageProtocolBridgeIdle()
        const first = ProtocolStore.latestSessionEvent(session.id, "session.error")
        expect(first?.payload).toMatchObject({
          channel: "main",
          agentID: "root",
          streamRequest: {
            requestID,
            agentID,
            providerID: model.providerID,
            modelID: model.id,
            apiModelID: model.api.id,
          },
          error: {
            name: "APIError",
            data: { statusCode: 400, isRetryable: false, message: `${agentID} local rejection` },
          },
        })
        expect(ProtocolStore.latestSessionEvent(session.id, "session.error")).toEqual(first)
      },
    })
  }, 60000)
