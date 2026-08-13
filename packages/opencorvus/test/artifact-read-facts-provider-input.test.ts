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
          model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        })
        const readMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 1, completed: now + 2 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-sol",
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
          tool: "panel",
          state: {
            status: "completed",
            input: { action: "unrelated_panel_action", sessionID: "unrelated" },
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
          tool: "panel",
          state: {
            status: "completed",
            input: {
              action: "read_task_artifact",
              taskID,
              locator,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
              model: null,
              text: null,
              evidence_locators: null,
            },
            output: JSON.stringify({
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
        const mutationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 3, completed: now + 4 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-sol",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })

        expect(
          completeArtifactReadsBeforePanelAction({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            taskID,
          }),
        ).toEqual([locator])
      },
    })
  })
})
