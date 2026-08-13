import { afterEach, describe, expect, test } from "bun:test"
import { reviewedTerminalLifecycleReferenceBeforePanelAction } from "@/agent/task-review-facts"
import { recordEngineArtifact } from "@/engine/artifact"
import { requireCurrentTerminalLifecycleReference, sameTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import { terminalTask, updateTask } from "@/engine/state"
import { Identifier } from "@/id/id"
import { missionBoardProjection } from "@/mission/board"
import { MissionCompletionActionInput, MissionCompletionReceipt } from "@/mission/completion"
import { ensureMissionSession } from "@/mission/session"
import { panelActionSchemaForAgent } from "@/panel/capability"
import { PanelQueryTaskOutput } from "@/panel/task-query"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Tool } from "@/tool/tool"
import { PanelTool } from "@/tool/panel"
import { ArtifactSchemaLimits } from "@opencorvus-ai/plugin/artifact-catalog"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

const locator = {
  source: "engine_artifact" as const,
  artifact_id: "art_terminal_authority",
  catalog_revision: 1,
  expected_sha256: "b".repeat(64),
}

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Mission terminal Task authority", () => {
  test("enumerates a terminal child catalog through Host-backed numbered pages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-numbered-artifact-pages",
          defaultCwd: project.path,
          productPillar: "work",
        })
        const taskSession = await Session.create({ kind: "root", title: "Paged terminal child" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: taskSession.id,
          now,
          title: "Paged terminal child",
          request: "Publish a multi-page evidence catalog",
          productPillar: "work",
          metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        for (let index = 0; index < 33; index += 1) {
          recordEngineArtifact({
            taskID,
            kind: "expert_output",
            label: `Paged evidence ${index.toString().padStart(2, "0")}`,
            payload: { index, accepted: true },
            timeCreated: now + index,
          })
        }
        await terminalTask(
          requireTask(taskID),
          { status: "completed", time_started: now, time_completed: now + 34 },
          "Paged evidence published",
        )
        const terminalReference = requireCurrentTerminalLifecycleReference(taskID)
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: now + 35 },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const caller = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 36 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const panel = await PanelTool.init({ agentID: "mission" })
        const context = {
          sessionID: mission.id,
          messageID: caller.id,
          agent: "mission",
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface(["panel"], []),
          extra: { surface: "panel" },
          metadata() {},
          async ask() {},
        }
        const entries: Array<{ locator: unknown }> = []
        const visitedPageNumbers: number[] = []
        let pageNumber: number | null = 1
        while (pageNumber !== null) {
          const result = await panel.execute(
            {
              action: "query_task_artifacts",
              taskID,
              terminal_lifecycle_reference: terminalReference,
              page_number: pageNumber,
              kinds: ["expert_output"],
              sort: "oldest",
            },
            context,
          )
          expect(Buffer.byteLength(result.output, "utf8")).toBeLessThanOrEqual(
            ArtifactSchemaLimits.structuredOutputBytes,
          )
          const page = JSON.parse(result.output) as {
            taskID: string
            terminal_lifecycle_reference: typeof terminalReference
            page_number: number
            next_page_number: number | null
            entries: Array<{ locator: unknown }>
            filtered_total: number
            catalog_complete: boolean
          }
          expect(page).toEqual(
            expect.objectContaining({
              taskID,
              terminal_lifecycle_reference: terminalReference,
              page_number: pageNumber,
              filtered_total: 33,
              catalog_complete: true,
            }),
          )
          visitedPageNumbers.push(page.page_number)
          entries.push(...page.entries)
          pageNumber = page.next_page_number
        }
        expect(visitedPageNumbers).toEqual([1, 2, 3])
        expect(entries).toHaveLength(33)
        expect(new Set(entries.map((entry) => JSON.stringify(entry.locator))).size).toBe(33)
      },
    })
  }, 30_000)

  test("binds resume and completion authority from the canonical same-Turn query receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-terminal-authority",
          defaultCwd: project.path,
          productPillar: "work",
        })
        const taskSession = await Session.create({ kind: "root", title: "Terminal child" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: taskSession.id,
          now,
          title: "Terminal child",
          request: "Publish accepted evidence",
          productPillar: "work",
          metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        await terminalTask(
          requireTask(taskID),
          { status: "completed", time_started: now, time_completed: now + 1 },
          "Terminal evidence published",
        )
        const initialReference = requireCurrentTerminalLifecycleReference(taskID)

        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: now + 2 },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        })
        const queryMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 3, completed: now + 4 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-sol",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        const panel = await PanelTool.init({ agentID: "mission" })
        const query = await panel.execute(
          { action: "query_task", taskIDs: [taskID] },
          {
            sessionID: mission.id,
            messageID: queryMessage.id,
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface(["panel"], []),
            extra: { surface: "panel" },
            metadata() {},
            async ask() {},
          },
        )
        expect(PanelQueryTaskOutput.parse(JSON.parse(query.output))).toEqual({
          tasks: [
            expect.objectContaining({
              taskID,
              status: "completed",
              terminal_lifecycle_reference: initialReference,
            }),
          ],
        })
        const queryPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: queryMessage.id,
          type: "tool",
          callID: "query-terminal-task",
          tool: "panel",
          state: {
            status: "completed",
            input: { action: "query_task", taskIDs: [taskID] },
            output: query.output,
            title: query.title,
            metadata: query.metadata,
            time: { start: now + 3, end: now + 4 },
          },
        })
        expect(queryPart.type).toBe("tool")

        const mutationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 5, completed: now + 6 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-sol",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        expect(
          reviewedTerminalLifecycleReferenceBeforePanelAction({
            sessionID: mission.id,
            assistantMessageID: mutationMessage.id,
            taskID,
          }),
        ).toEqual(initialReference)

        const missionSchema = panelActionSchemaForAgent("mission")
        expect(
          missionSchema.parse({
            action: "resume_task",
            taskID,
            text: "Publish the corrected audit receipt.",
            evidence_locators: [locator],
          }),
        ).toEqual({
          action: "resume_task",
          taskID,
          text: "Publish the corrected audit receipt.",
          evidence_locators: [locator],
        })
        expect(
          missionSchema.parse({
            action: "complete_mission",
            summary: "Accepted terminal evidence",
            task_acceptances: [{ task_id: taskID, evidence_locators: [locator] }],
          }),
        ).toEqual({
          action: "complete_mission",
          summary: "Accepted terminal evidence",
          task_acceptances: [{ task_id: taskID, evidence_locators: [locator] }],
        })
        const completionInput = MissionCompletionActionInput.parse({
          action: "complete_mission",
          summary: "Accepted terminal evidence",
          task_acceptances: [{ task_id: taskID, evidence_locators: [locator] }],
        })

        const completionCallID = "complete-terminal-mission"
        const completionPartID = Identifier.ascending("part")
        const receipt = MissionCompletionReceipt.parse({
          kind: "mission_completed",
          mission_id: mission.missionID,
          mission_session_id: mission.id,
          summary: completionInput.summary,
          task_acceptances: [
            {
              ...completionInput.task_acceptances[0],
              terminal_lifecycle_reference: initialReference,
            },
          ],
          assistant_message_id: mutationMessage.id,
          tool_call_id: completionCallID,
          tool_part_id: completionPartID,
          time_recorded: now + 6,
        })
        await Session.updatePart({
          id: completionPartID,
          sessionID: mission.id,
          messageID: mutationMessage.id,
          type: "tool",
          callID: completionCallID,
          tool: "panel",
          state: {
            status: "completed",
            input: { ...completionInput, model: "openai/gpt-5.6-luna" },
            output: JSON.stringify(receipt),
            title: "Mission completed",
            metadata: { truncated: false },
            time: { start: now + 5, end: now + 6 },
          },
        })
        expect(
          missionBoardProjection(mission, {
            interruptible: false,
            pendingInteractions: 0,
            taskLifecycleStatuses: ["completed"],
          }),
        ).toMatchObject({ lane: "completed", completion: { summary: "Accepted terminal evidence" } })

        await updateTask(requireTask(taskID), { status: "active" }, "Task resumed")
        await terminalTask(
          requireTask(taskID),
          { status: "completed", time_completed: now + 8 },
          "New terminal occurrence",
        )
        const currentReference = requireCurrentTerminalLifecycleReference(taskID)
        expect({
          reviewed: reviewedTerminalLifecycleReferenceBeforePanelAction({
            sessionID: mission.id,
            assistantMessageID: mutationMessage.id,
            taskID,
          }),
          current: currentReference,
          sameOccurrence: sameTerminalLifecycleReference(initialReference, currentReference),
        }).toEqual({ reviewed: initialReference, current: currentReference, sameOccurrence: false })
      },
    })
  }, 30_000)
})
