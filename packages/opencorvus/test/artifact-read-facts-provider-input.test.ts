import { afterEach, describe, expect, test } from "bun:test"
import { completeArtifactReadsBeforePanelAction } from "@/agent/artifact-read-facts"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Artifact read facts from provider Tool input", () => {
  test("audits a completed panel read from its exact discriminated-union branch", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({
          kind: "mission",
          title: "Provider read facts",
          metadata: {
            mission: {
              id: "provider-read-facts",
              channelKey: "mission:provider-read-facts",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        const now = Date.now()
        const taskID = "task-provider-read-facts"
        const locatorRef = "al_1234567890abcdef"
        const readRef = "ar_1234567890abcdef"
        const terminalReference = {
          terminalEventID: "evt_provider_read_fact",
        }
        const locator = {
          source: "engine_artifact" as const,
          artifact_id: "art_provider_read_fact",
          catalog_revision: 7,
          expected_sha256: "b".repeat(64),
        }
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const readMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 1 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: "call_unrelated_panel_fact",
          tool: "panel_query_task",
          state: {
            status: "completed",
            input: { taskID: "unrelated" },
            output: JSON.stringify({ ok: true }),
            title: "Unrelated panel fact",
            metadata: { truncated: false },
            time: { start: now + 1, end: now + 2 },
          },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: "call_provider_read_fact",
          tool: "panel_read_task_artifact",
          state: {
            status: "completed",
            input: {
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
            },
            output: JSON.stringify({
              taskID,
              terminal_lifecycle_reference: terminalReference,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              artifact_read_ref: readRef,
              locator,
              media_type: "application/json",
              byte_start: 0,
              byte_end: 1,
              next_offset: null,
              total_bytes: 1,
              complete: true,
              sha256: locator.expected_sha256,
              text: "x",
              attachment: false,
            }),
            title: "Task Artifact",
            metadata: { truncated: false },
            time: { start: now + 1, end: now + 2 },
          },
        })
        await Session.updateMessage({
          ...readMessage,
          time: { ...readMessage.time, completed: now + 2 },
          finish: "tool-calls",
        })
        const mutationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 3 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: mutationMessage.id,
          type: "step-start",
        })
        const mutationPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: mutationMessage.id,
          type: "tool",
          callID: "complete-panel-action",
          tool: "panel_complete_mission",
          state: { status: "running", input: {}, time: { start: now + 4 } },
        })

        expect(
          completeArtifactReadsBeforePanelAction({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            taskID,
          }),
        ).toEqual([locator])
      },
    })
  })
})
