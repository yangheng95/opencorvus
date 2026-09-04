import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { ArtifactReferenceResolutionError } from "@/agent/artifact-read-facts"
import { Config } from "@/config/config"
import { recordEngineArtifact } from "@/engine/artifact"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { sameTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference-schema"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import { terminalTask, updateTask } from "@/engine/state"
import { Identifier } from "@/id/id"
import { missionBoardProjection } from "@/mission/board"
import { MissionCompletionActionInput, MissionCompletionReceipt } from "@/mission/completion"
import { ensureMissionSession } from "@/mission/session"
import { openMissionThroughRealWake } from "./fixture/mission-opened"
import { panelActionSchemaForAgent } from "@/panel/capability"
import { PanelQueryTaskOutput } from "@/panel/task-query"
import { Instance } from "@/project/instance"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Session } from "@/session"
import { SessionProcessor } from "@/session/processor"
import { Tool } from "@/tool/tool"
import { createPanelUIRequestToolContext, PanelLeafTools, PanelTool } from "@/tool/panel"
import { panelLeafToolID, type PanelActionID } from "@/panel/action-ids"
import { ToolTurnExecutionConflictError } from "@/tool/execution-mode"
import { toolResultControl } from "@/session/tool-result-control"
import { EngineService } from "@/task-api"
import { ArtifactSchemaLimits } from "@opencorvus-ai/plugin/artifact-catalog"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { resolveTestCapabilityTools } from "./fixture/capability-occurrence"

async function panelLeaf(action: PanelActionID, agentID = "mission") {
  const id = panelLeafToolID(action)
  const definition = PanelLeafTools.find((tool) => tool.id === id)
  if (!definition) throw new Error(`Missing Panel leaf ${id}.`)
  return { id, tool: await definition.init({ agentID }) }
}

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

const providerModel = {
  id: "mission-panel-execution-mode-model",
  providerID: "mission-panel-execution-mode-provider",
  name: "Mission panel execution mode",
  limit: { context: 1_000_000, input: 900_000, output: 4_096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
  api: { id: "mission-panel-execution-mode", npm: "@ai-sdk/anthropic" },
  options: {},
} as any

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Mission terminal Task authority", () => {
  test("projects Mission panel queries as ordinary work and mutations as exclusive turn control", async () => {
    const missionViewTasks = await panelLeaf("view_tasks")
    const missionInspectSquad = await panelLeaf("expert_squad_inspect")
    const missionCreateTask = await panelLeaf("create_task")
    const missionComplete = await panelLeaf("complete_mission")
    const ordinaryCreateTask = await panelLeaf("create_task", "base")

    expect({
      viewTasks: missionViewTasks.tool.executionMode,
      inspectSquad: missionInspectSquad.tool.executionMode,
      createTask: missionCreateTask.tool.executionMode,
      completeMission: missionComplete.tool.executionMode,
      ordinaryPanel: ordinaryCreateTask.tool.executionMode,
    }).toEqual({
      viewTasks: "ordinary",
      inspectSquad: "ordinary",
      createTask: "turn_control_exclusive",
      completeMission: "turn_control_exclusive",
      ordinaryPanel: "ordinary",
    })
  })

  test("coordinates overlapping queries and a control mutation on the final Mission SessionLoop panel surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-overlapping-panel-queries",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        await openMissionThroughRealWake({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "mission-overlapping-panel-queries:dispatch",
        })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "mission",
          model: { providerID: "test", modelID: "mission-query-overlap" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 1 },
          agent: "mission",
          providerID: "test",
          modelID: "mission-query-overlap",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const config = await Config.get()
        const processor = SessionProcessor.create({
          assistantMessage: assistant,
          sessionID: mission.id,
          model: providerModel,
          abort: new AbortController().signal,
        })
        const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("mission", { config }))
        const { tools } = await resolveTestCapabilityTools({
          agent: runtime,
          agentID: "mission",
          model: providerModel,
          session: mission,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: mission.id }),
          config,
          includeMcpTools: false,
          extra: { surface: "panel" },
          activeLocalRefs: ["panel_expert_squad_inspect", "panel_view_tasks", "panel_create_task"],
        })
        const inspectSquad = tools.panel_expert_squad_inspect
        const viewTasks = tools.panel_view_tasks
        const createTask = tools.panel_create_task
        if (!inspectSquad?.execute || !viewTasks?.execute || !createTask?.execute) {
          throw new Error("Final Mission SessionLoop surface did not project the exact Panel leaves.")
        }
        const options = (toolCallId: string) => ({
          toolCallId,
          messages: [],
          abortSignal: new AbortController().signal,
        })
        const originalRecommendationCatalog = PromptProfileResolver.recommendationCatalog
        const order: string[] = []
        let markInspectionEntered!: () => void
        let releaseInspection!: () => void
        const inspectionEntered = new Promise<void>((resolve) => (markInspectionEntered = resolve))
        const inspectionGate = new Promise<void>((resolve) => (releaseInspection = resolve))
        const recommendationSpy = spyOn(PromptProfileResolver, "recommendationCatalog").mockImplementation(
          async (input) => {
            order.push("inspection:start")
            markInspectionEntered()
            await inspectionGate
            order.push("inspection:end")
            return originalRecommendationCatalog(input)
          },
        )
        const taskID = Identifier.ascending("task")
        const createSpy = spyOn(EngineService, "createTask").mockImplementation(async () => {
          order.push("mutation:effect")
          return taskID
        })
        const mappingSpy = spyOn(EngineService, "getCrossTaskArtifactImportMappings").mockReturnValue([])
        try {
          const inspectionPromise = inspectSquad.execute({ id: "base" }, options("call_final_surface_inspection"))
          await inspectionEntered
          const tasks = await viewTasks.execute({}, options("call_final_surface_tasks"))
          order.push("tasks:done")
          const mutationPromise = createTask.execute(
            {
              title: "Verify action-aware Mission control",
              request: "Verify action-aware Mission control",
              model: "firmware/gpt-5",
              promptProfile: "base",
            },
            options("call_final_surface_mutation"),
          )
          const fencedQuery = await viewTasks
            .execute({}, options("call_query_behind_pending_mutation"))
            .then(() => ({ kind: "completed" as const }))
            .catch((error) => ({
              kind: "rejected" as const,
              name: error instanceof Error ? error.name : typeof error,
              message: error instanceof Error ? error.message : String(error),
              typed: error instanceof ToolTurnExecutionConflictError,
            }))
          releaseInspection()
          const [inspection, mutation] = await Promise.all([inspectionPromise, mutationPromise])
          const inspected = JSON.parse((inspection as { output: string }).output) as { squad: { id: string } }
          const taskResult = JSON.parse((mutation as { output: string }).output) as { task_id: string }

          expect({
            order,
            tasks: {
              title: (tasks as { title: string }).title,
              output: (tasks as { output: string }).output,
              metadata: (tasks as { metadata: unknown }).metadata,
            },
            inspection: { title: (inspection as { title: string }).title, squadID: inspected.squad.id },
            mutation: {
              taskID: taskResult.task_id,
              control: toolResultControl((mutation as { metadata: Record<string, unknown> }).metadata),
            },
            fencedQuery,
          }).toEqual({
            order: ["inspection:start", "tasks:done", "inspection:end", "mutation:effect"],
            tasks: {
              title: "Mission Tasks",
              output: "No Mission-owned tasks found.",
              metadata: { missionID: mission.missionID, count: 0, truncated: false },
            },
            inspection: { title: "Expert Squad", squadID: "base" },
            mutation: { taskID, control: { kind: "immediate_park" } },
            fencedQuery: {
              kind: "rejected",
              name: "ToolTurnExecutionConflictError",
              message: "An exclusive Tool occurrence is already pending in this assistant turn",
              typed: true,
            },
          })
        } finally {
          mappingSpy.mockRestore()
          createSpy.mockRestore()
          recommendationSpy.mockRestore()
        }
      },
    })
  })

  test("returns an immediate parked turn boundary after a Mission Task is accepted", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-create-task-boundary",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const opened = await openMissionThroughRealWake({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "mission-create-task-boundary:dispatch",
        })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "mission",
          model: { providerID: "test", modelID: "mission-create-boundary" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 1 },
          agent: "mission",
          providerID: "test",
          modelID: "mission-create-boundary",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const callID = "create-one-mission-task"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: assistant.id,
          type: "tool",
          callID,
          tool: "panel_create_task",
          state: {
            status: "running",
            input: {
              title: "Build one bounded game",
              request: "Build one bounded game",
            },
            time: { start: now + 1 },
          },
        })
        const taskID = Identifier.ascending("task")
        const createSpy = spyOn(EngineService, "createTask").mockResolvedValue(taskID)
        const mappingSpy = spyOn(EngineService, "getCrossTaskArtifactImportMappings").mockReturnValue([])
        try {
          const panel = await panelLeaf("create_task")
          const result = await panel.tool.execute(
            {
              title: "Build one bounded game",
              request: "Build one bounded game",
              model: "firmware/gpt-5",
              promptProfile: "base",
            },
            {
              sessionID: mission.id,
              messageID: assistant.id,
              callID,
              agent: "mission",
              abort: new AbortController().signal,
              messages: [],
              executionSurface: Tool.executionSurface([panel.id], []),
              extra: { surface: "panel" },
              metadata() {},
              async ask() {},
            },
          )

          expect({ output: JSON.parse(result.output), control: toolResultControl(result.metadata) }).toEqual({
            output: {
              kind: "created",
              task_id: taskID,
              artifact_import_mappings: [],
              message: `Task accepted: \`${taskID}\``,
            },
            control: { kind: "immediate_park" },
          })
          expect(createSpy).toHaveBeenCalledTimes(1)
          expect(createSpy.mock.calls[0]?.[1]).toMatchObject({
            actor: "mission",
            sessionID: mission.id,
            openedOccurrence: {
              eventID: opened.eventID,
              operationID: opened.operationID,
            },
          })
        } finally {
          mappingSpy.mockRestore()
          createSpy.mockRestore()
        }
      },
    })
  })

  test("enumerates a terminal child catalog through Host-backed numbered pages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-numbered-artifact-pages",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const taskSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Paged terminal child",
        })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: taskSession,
          now,
          title: "Paged terminal child",
          request: "Publish a multi-page evidence catalog",
          productPillar: "work",
          source: "mission",
          metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
          projectID: Instance.project.id,
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
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: caller.id,
          type: "step-start",
        })
        const viewTasksLeaf = await panelLeaf("view_tasks")
        const queryTaskLeaf = await panelLeaf("query_task")
        const queryArtifactsLeaf = await panelLeaf("query_task_artifacts")
        const readArtifactLeaf = await panelLeaf("read_task_artifact")
        const context = (toolID: string, callID?: string, messageID = caller.id) => ({
          sessionID: mission.id,
          messageID,
          callID,
          agent: "mission",
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface([toolID], []),
          extra: { surface: "panel" },
          metadata() {},
          async ask() {},
        })
        const missionTasks = await viewTasksLeaf.tool.execute({}, context(viewTasksLeaf.id))
        expect({ output: missionTasks.output, metadata: missionTasks.metadata }).toEqual({
          output: `1. Paged terminal child [completed] (${taskID})`,
          metadata: { missionID: mission.missionID, count: 1, truncated: false },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: caller.id,
          type: "tool",
          callID: "view-mission-tasks-before-artifact-catalog",
          tool: viewTasksLeaf.id,
          state: {
            status: "completed",
            input: {},
            output: missionTasks.output,
            title: missionTasks.title,
            metadata: missionTasks.metadata,
            time: { start: now + 36, end: now + 37 },
          },
        })
        const unboundCatalogCallID = "query-terminal-artifacts-before-task-query"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: caller.id,
          type: "tool",
          callID: unboundCatalogCallID,
          tool: queryArtifactsLeaf.id,
          state: { status: "running", input: { taskID, page_number: 1 }, time: { start: now + 37 } },
        })
        await expect(
          queryArtifactsLeaf.tool.execute(
            { taskID, page_number: 1 },
            context(queryArtifactsLeaf.id, unboundCatalogCallID),
          ),
        ).rejects.toThrow(
          `requires a completed panel.query_task terminal row for Task ${taskID} earlier in the same Turn`,
        )
        const queriedTask = await queryTaskLeaf.tool.execute({ taskIDs: [taskID] }, context(queryTaskLeaf.id))
        expect(PanelQueryTaskOutput.parse(JSON.parse(queriedTask.output))).toEqual({
          tasks: [
            expect.objectContaining({
              taskID,
              status: "completed",
              terminal_lifecycle_reference: terminalReference,
            }),
          ],
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: caller.id,
          type: "tool",
          callID: "query-terminal-task-before-artifact-catalog",
          tool: queryTaskLeaf.id,
          state: {
            status: "completed",
            input: { taskIDs: [taskID] },
            output: queriedTask.output,
            title: queriedTask.title,
            metadata: queriedTask.metadata,
            time: { start: now + 37, end: now + 38 },
          },
        })
        const catalogMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 38 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const entries: Array<{ locator: unknown; artifact_locator_ref: string }> = []
        const visitedPageNumbers: number[] = []
        let pageNumber: number | null = 1
        while (pageNumber !== null) {
          const queryInput = {
            taskID,
            page_number: pageNumber,
            kinds: ["expert_output"] as const,
            sort: "oldest" as const,
          }
          const queryCallID = `query-terminal-artifact-page-${pageNumber}`
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: mission.id,
            messageID: catalogMessage.id,
            type: "step-start",
          })
          const queryPart = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: mission.id,
            messageID: catalogMessage.id,
            type: "tool",
            callID: queryCallID,
            tool: queryArtifactsLeaf.id,
            state: { status: "running", input: queryInput, time: { start: now + 38 + pageNumber } },
          })
          const result = await queryArtifactsLeaf.tool.execute(
            queryInput,
            context(queryArtifactsLeaf.id, queryCallID, catalogMessage.id),
          )
          expect(Buffer.byteLength(result.output, "utf8")).toBeLessThanOrEqual(
            ArtifactSchemaLimits.structuredOutputBytes,
          )
          const page = JSON.parse(result.output) as {
            taskID: string
            terminal_lifecycle_reference: typeof terminalReference
            page_number: number
            next_page_number: number | null
            entries: Array<{ locator: unknown; artifact_locator_ref: string }>
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
          await Session.updatePart({
            ...queryPart,
            state: {
              status: "completed",
              input: queryInput,
              output: result.output,
              title: result.title,
              metadata: result.metadata,
              time: { start: now + 38 + page.page_number, end: now + 39 + page.page_number },
            },
          })
          visitedPageNumbers.push(page.page_number)
          entries.push(...page.entries)
          pageNumber = page.next_page_number
        }
        expect(visitedPageNumbers).toEqual([1, 2, 3])
        expect(entries).toHaveLength(33)
        expect(new Set(entries.map((entry) => JSON.stringify(entry.locator))).size).toBe(33)
        expect(new Set(entries.map((entry) => entry.artifact_locator_ref)).size).toBe(33)
        const panelUI = await PanelTool.init({ agentID: "panel_ui" })
        const panelUIPage = await panelUI.execute(
          { action: "query_task_artifacts", taskID, page_number: 1, kinds: ["expert_output"], sort: "oldest" },
          createPanelUIRequestToolContext({
            surface: "gateway",
            requestID: "00000000-0000-4000-8000-000000000001",
          }),
        )
        expect(JSON.parse(panelUIPage.output)).toEqual(
          expect.objectContaining({
            taskID,
            terminal_lifecycle_reference: terminalReference,
            page_number: 1,
            filtered_total: 33,
          }),
        )
        const readMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 37 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const readInput = {
          taskID,
          artifact_transport_version: 2 as const,
          artifact_locator_ref: entries[0]!.artifact_locator_ref,
          byte_offset: 0,
          max_bytes: 65_536,
          delivery: "inline" as const,
        }
        const readCallID = "read-terminal-artifact"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: readMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: readMessage.id,
          type: "tool",
          callID: readCallID,
          tool: readArtifactLeaf.id,
          state: { status: "running", input: readInput, time: { start: now + 37 } },
        })
        const read = await readArtifactLeaf.tool.execute(readInput, {
          ...context(readArtifactLeaf.id),
          messageID: readMessage.id,
          callID: readCallID,
        })
        expect(JSON.parse(read.output)).toEqual(
          expect.objectContaining({
            taskID,
            terminal_lifecycle_reference: terminalReference,
            artifact_transport_version: 2,
            artifact_locator_ref: entries[0]!.artifact_locator_ref,
            artifact_read_ref: expect.stringMatching(/^ar_[A-Za-z0-9_-]{16}$/),
            locator: entries[0]!.locator,
            complete: true,
          }),
        )
        await updateTask(requireTask(taskID), { status: "active" }, "Task reopened after catalog read")
        await terminalTask(
          requireTask(taskID),
          { status: "completed", time_completed: now + 39 },
          "Replacement terminal occurrence",
        )
        const staleReadMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 40 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const staleReadCallID = "read-stale-terminal-artifact"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: staleReadMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: staleReadMessage.id,
          type: "tool",
          callID: staleReadCallID,
          tool: readArtifactLeaf.id,
          state: { status: "running", input: readInput, time: { start: now + 40 } },
        })
        let staleReadError: unknown
        try {
          await readArtifactLeaf.tool.execute(readInput, {
            ...context(readArtifactLeaf.id),
            messageID: staleReadMessage.id,
            callID: staleReadCallID,
          })
        } catch (error) {
          staleReadError = error
        }
        expect(staleReadError).toEqual(
          expect.objectContaining({
            message: expect.stringContaining(`terminal occurrence changed for Task ${taskID}`),
          }),
        )
      },
    })
  }, 30_000)

  test("completes a Mission from canonical terminal reads retained across Mission inputs", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-terminal-authority",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const taskSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Terminal child",
        })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: taskSession,
          now,
          title: "Terminal child",
          request: "Publish accepted evidence",
          productPillar: "work",
          source: "mission",
          metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
          projectID: Instance.project.id,
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
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const queryMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 3 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        const queryTaskLeaf = await panelLeaf("query_task")
        const completeMissionLeaf = await panelLeaf("complete_mission")
        const query = await queryTaskLeaf.tool.execute(
          { taskIDs: [taskID] },
          {
            sessionID: mission.id,
            messageID: queryMessage.id,
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface([queryTaskLeaf.id], []),
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
          tool: queryTaskLeaf.id,
          state: {
            status: "completed",
            input: { taskIDs: [taskID] },
            output: query.output,
            title: query.title,
            metadata: query.metadata,
            time: { start: now + 3, end: now + 4 },
          },
        })
        expect(queryPart.type).toBe("tool")
        const locatorRef = "al_1234567890abcdef"
        const readRef = "ar_1234567890abcdef"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: queryMessage.id,
          type: "tool",
          callID: "read-terminal-evidence",
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
              terminal_lifecycle_reference: initialReference,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              artifact_read_ref: readRef,
              locator,
              media_type: "application/json",
              byte_start: 0,
              byte_end: 2,
              next_offset: null,
              total_bytes: 2,
              complete: true,
              sha256: locator.expected_sha256,
              text: "xy",
              attachment: false,
            }),
            title: "Task Artifact",
            metadata: { truncated: false },
            time: { start: now + 4, end: now + 5 },
          },
        })
        await Session.updateMessage({
          ...queryMessage,
          time: { ...queryMessage.time, completed: now + 5 },
          finish: "tool-calls",
        })

        const completionUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: now + 5 },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const mutationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: completionUser.id,
          time: { created: now + 6 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        const missionSchema = panelActionSchemaForAgent("mission")
        expect(
          missionSchema.parse({
            action: "resume_task",
            taskID,
            acceptance_gap: {
              gap_id: "gap-audit-receipt",
              current_ledger_revision_artifact_id: null,
              criteria: [
                {
                  criterion_id: "audit-receipt",
                  state: "open",
                  disposition: "failed",
                  finding: "The audit receipt requires a corrected canonical revision.",
                  responsibility: { kind: "workflow_node", workflow_id: "repair", workflow_node_id: "builder" },
                  observation_evidence_read_refs: [readRef],
                  repair_evidence_read_refs: [],
                  resolution_evidence_read_refs: [],
                  invalidating_evidence_read_refs: [],
                  irreducible_blocker_evidence_read_refs: [],
                  repair_action: {
                    operation: "correct_artifact",
                    target: "audit-receipt",
                    expected_evidence_kind: "corrected-audit-receipt",
                    parameters: {},
                  },
                },
              ],
            },
          }),
        ).toEqual({
          action: "resume_task",
          taskID,
          acceptance_gap: {
            gap_id: "gap-audit-receipt",
            current_ledger_revision_artifact_id: null,
            criteria: [
              {
                criterion_id: "audit-receipt",
                state: "open",
                disposition: "failed",
                finding: "The audit receipt requires a corrected canonical revision.",
                responsibility: { kind: "workflow_node", workflow_id: "repair", workflow_node_id: "builder" },
                observation_evidence_read_refs: [readRef],
                repair_evidence_read_refs: [],
                resolution_evidence_read_refs: [],
                invalidating_evidence_read_refs: [],
                irreducible_blocker_evidence_read_refs: [],
                repair_action: {
                  operation: "correct_artifact",
                  target: "audit-receipt",
                  expected_evidence_kind: "corrected-audit-receipt",
                  parameters: {},
                },
              },
            ],
          },
        })
        expect(
          missionSchema.parse({
            action: "complete_mission",
            summary: "Accepted terminal evidence",
            task_acceptances: [{ task_id: taskID, evidence_read_refs: [readRef] }],
          }),
        ).toEqual({
          action: "complete_mission",
          summary: "Accepted terminal evidence",
          task_acceptances: [{ task_id: taskID, evidence_read_refs: [readRef] }],
        })
        const completionInput = MissionCompletionActionInput.parse({
          action: "complete_mission",
          summary: "Accepted terminal evidence",
          task_acceptances: [{ task_id: taskID, evidence_read_refs: [readRef] }],
        })
        const { action: _completionAction, ...completionArgs } = completionInput

        const completionCallID = "complete-terminal-mission"
        const completionPartID = Identifier.ascending("part")
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: mutationMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: completionPartID,
          sessionID: mission.id,
          messageID: mutationMessage.id,
          type: "tool",
          callID: completionCallID,
          tool: completeMissionLeaf.id,
          state: {
            status: "running",
            input: completionArgs,
            time: { start: now + 6 },
          },
        })
        const completion = await completeMissionLeaf.tool.execute(completionArgs, {
          sessionID: mission.id,
          messageID: mutationMessage.id,
          callID: completionCallID,
          agent: "mission",
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface([completeMissionLeaf.id], []),
          extra: { surface: "panel" },
          metadata() {},
          async ask() {},
        })
        const receipt = MissionCompletionReceipt.parse(JSON.parse(completion.output))
        expect(receipt).toEqual(
          expect.objectContaining({
            kind: "mission_completed",
            mission_id: mission.missionID,
            mission_session_id: mission.id,
            summary: completionInput.summary,
            task_acceptances: [
              {
                task_id: taskID,
                evidence_locators: [locator],
                terminal_lifecycle_reference: initialReference,
              },
            ],
            assistant_message_id: mutationMessage.id,
            tool_call_id: completionCallID,
            tool_part_id: completionPartID,
          }),
        )
        await Session.updatePart({
          id: completionPartID,
          sessionID: mission.id,
          messageID: mutationMessage.id,
          type: "tool",
          callID: completionCallID,
          tool: completeMissionLeaf.id,
          state: {
            status: "completed",
            input: completionArgs,
            output: completion.output,
            title: completion.title,
            metadata: completion.metadata,
            time: { start: now + 6, end: now + 7 },
          },
        })
        await Session.updateMessage({
          ...mutationMessage,
          time: { ...mutationMessage.time, completed: now + 7 },
          finish: "tool-calls",
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
          accepted: receipt.task_acceptances[0]!.terminal_lifecycle_reference,
          current: currentReference,
          sameOccurrence: sameTerminalLifecycleReference(initialReference, currentReference),
        }).toEqual({ accepted: initialReference, current: currentReference, sameOccurrence: false })

        const currentQueryMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 9 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const currentQuery = await queryTaskLeaf.tool.execute(
          { taskIDs: [taskID] },
          {
            sessionID: mission.id,
            messageID: currentQueryMessage.id,
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface([queryTaskLeaf.id], []),
            extra: { surface: "panel" },
            metadata() {},
            async ask() {},
          },
        )
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: currentQueryMessage.id,
          type: "tool",
          callID: "query-replacement-terminal-task",
          tool: queryTaskLeaf.id,
          state: {
            status: "completed",
            input: { taskIDs: [taskID] },
            output: currentQuery.output,
            title: currentQuery.title,
            metadata: currentQuery.metadata,
            time: { start: now + 9, end: now + 10 },
          },
        })
        const currentPartialReadRef = "ar_currentpartial00"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: currentQueryMessage.id,
          type: "tool",
          callID: "read-partial-current-terminal-task",
          tool: "panel_read_task_artifact",
          state: {
            status: "completed",
            input: {
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 0,
              max_bytes: 1,
              delivery: "inline",
            },
            output: JSON.stringify({
              taskID,
              terminal_lifecycle_reference: currentReference,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              artifact_read_ref: currentPartialReadRef,
              locator,
              media_type: "application/json",
              byte_start: 0,
              byte_end: 1,
              next_offset: 1,
              total_bytes: 2,
              complete: false,
              sha256: locator.expected_sha256,
              text: "x",
              attachment: false,
            }),
            title: "Partial current Task Artifact",
            metadata: { truncated: true },
            time: { start: now + 10, end: now + 11 },
          },
        })
        const currentFinalReadRef = "ar_currentfinal0000"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: currentQueryMessage.id,
          type: "tool",
          callID: "read-final-current-terminal-task",
          tool: "panel_read_task_artifact",
          state: {
            status: "completed",
            input: {
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 1,
              max_bytes: 1,
              delivery: "inline",
            },
            output: JSON.stringify({
              taskID,
              terminal_lifecycle_reference: currentReference,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              artifact_read_ref: currentFinalReadRef,
              locator,
              media_type: "application/json",
              byte_start: 1,
              byte_end: 2,
              next_offset: null,
              total_bytes: 2,
              complete: true,
              sha256: locator.expected_sha256,
              text: "y",
              attachment: false,
            }),
            title: "Final current Task Artifact chunk",
            metadata: { truncated: false },
            time: { start: now + 10, end: now + 11 },
          },
        })
        await Session.updateMessage({
          ...currentQueryMessage,
          time: { ...currentQueryMessage.time, completed: now + 11 },
          finish: "tool-calls",
        })
        const staleCompletionMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 11 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const staleCompletionCallID = "complete-with-prior-terminal-read"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: staleCompletionMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: staleCompletionMessage.id,
          type: "tool",
          callID: staleCompletionCallID,
          tool: completeMissionLeaf.id,
          state: { status: "running", input: completionArgs, time: { start: now + 11 } },
        })
        let staleCompletionError: unknown
        try {
          await completeMissionLeaf.tool.execute(completionArgs, {
            sessionID: mission.id,
            messageID: staleCompletionMessage.id,
            callID: staleCompletionCallID,
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface([completeMissionLeaf.id], []),
            extra: { surface: "panel" },
            metadata() {},
            async ask() {},
          })
        } catch (error) {
          staleCompletionError = error
        }
        expect(staleCompletionError).toBeInstanceOf(ArtifactReferenceResolutionError)
        expect(staleCompletionError).toEqual(
          expect.objectContaining({
            code: "ARTIFACT_REFERENCE_UNRESOLVED",
            reference: readRef,
          }),
        )

        const partialCompletionInput = MissionCompletionActionInput.parse({
          action: "complete_mission",
          summary: "Reject incomplete current evidence",
          task_acceptances: [{ task_id: taskID, evidence_read_refs: [currentPartialReadRef] }],
        })
        const { action: _partialCompletionAction, ...partialCompletionArgs } = partialCompletionInput
        const partialCompletionCallID = "complete-with-partial-current-read"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: staleCompletionMessage.id,
          type: "tool",
          callID: partialCompletionCallID,
          tool: completeMissionLeaf.id,
          state: { status: "running", input: partialCompletionArgs, time: { start: now + 12 } },
        })
        let partialCompletionError: unknown
        try {
          await completeMissionLeaf.tool.execute(partialCompletionArgs, {
            sessionID: mission.id,
            messageID: staleCompletionMessage.id,
            callID: partialCompletionCallID,
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface([completeMissionLeaf.id], []),
            extra: { surface: "panel" },
            metadata() {},
            async ask() {},
          })
        } catch (error) {
          partialCompletionError = error
        }
        expect(partialCompletionError).toBeInstanceOf(ArtifactReferenceResolutionError)
        expect(partialCompletionError).toEqual(
          expect.objectContaining({
            code: "ARTIFACT_REFERENCE_UNRESOLVED",
            reference: currentPartialReadRef,
          }),
        )

        const currentCompletionInput = MissionCompletionActionInput.parse({
          action: "complete_mission",
          summary: "Accept the complete current evidence sequence",
          task_acceptances: [
            { task_id: taskID, evidence_read_refs: [currentPartialReadRef, currentFinalReadRef] },
          ],
        })
        const { action: _currentCompletionAction, ...currentCompletionArgs } = currentCompletionInput
        const currentCompletionCallID = "complete-with-current-read-sequence"
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: staleCompletionMessage.id,
          type: "tool",
          callID: currentCompletionCallID,
          tool: completeMissionLeaf.id,
          state: { status: "running", input: currentCompletionArgs, time: { start: now + 13 } },
        })
        const currentCompletion = await completeMissionLeaf.tool.execute(currentCompletionArgs, {
          sessionID: mission.id,
          messageID: staleCompletionMessage.id,
          callID: currentCompletionCallID,
          agent: "mission",
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface([completeMissionLeaf.id], []),
          extra: { surface: "panel" },
          metadata() {},
          async ask() {},
        })
        expect(MissionCompletionReceipt.parse(JSON.parse(currentCompletion.output)).task_acceptances).toEqual([
          {
            task_id: taskID,
            evidence_locators: [locator],
            terminal_lifecycle_reference: currentReference,
          },
        ])
      },
    })
  }, 30_000)
})
