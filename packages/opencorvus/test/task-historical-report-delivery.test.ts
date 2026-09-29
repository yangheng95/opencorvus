import { afterEach, expect, test } from "bun:test"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { recordEngineArtifact } from "@/engine/artifact"
import { EngineTaskTable } from "@/engine/engine.sql"
import { prepareTaskCompletionDecision, insertPreparedTaskCompletionDecision } from "@/engine/completion-decision"
import { requireTask, viewTask } from "@/engine/store"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import { taskLifecycleProjection, taskTerminalOccurrences } from "@/engine/task-lifecycle"
import { requireTaskPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { EngineRoutes } from "@/server/routes/orchestrator"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

// Explicit participant inputs for a backend integration contract. The real
// publication, completion writers, HTTP projection and byte reader execute;
// this does not stand in for autonomous model or visual acceptance.
test("historical report HTTP delivery keeps its exact completed owner across reopen and later failure", async () => {
  await using project = await memoryProject()
  let taskID = ""
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Historical report" })
      Database.use((db) =>
        db
          .update(EngineTaskTable)
          .set({ metadata: { actor: "user" } })
          .where(eq(EngineTaskTable.id, taskID))
          .run(),
      )
      const rootID = requireTask(taskID).session_id!
      await Session.mergeMetadata({
        sessionID: rootID,
        patch: { configOverlay: { prompt_profile: { active: "base" } } },
      })
      const scheduler = await Session.create({ kind: "orchestrator", parentID: rootID, title: "Report delivery" })
      const binding = requireTaskPackageRevisionBinding(taskID)
      const artifactID = recordEngineArtifact({
        taskID,
        kind: "expert_output",
        label: "Existing screening report",
        payload: {
          artifact_type: "base/development-report",
          schema_version: 1,
          producer: {
            owner_kind: "projected-worker",
            expert_squad_id: "base",
            package_revision: binding,
            agent_id: "base-developer",
            projection_hash: "b".repeat(64),
            session_id: scheduler.id,
            message_id: Identifier.ascending("message"),
            tool_call_id: "publish-report-fixture",
          },
          payload: { report: "# Screening report\nSample A: quality 8, value 7, growth 6, momentum 5." },
          resources: [],
          observed_artifact_locators: [],
          source_artifact_locators: [],
        },
      })
      const locator = exactEngineArtifactLocator({ taskID, artifactID })
      async function completeReport() {
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: scheduler.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test" },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: scheduler.id,
          messageID: user.id,
          type: "text",
          text: "Show the existing report.",
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: scheduler.id,
          parentID: user.id,
          role: "assistant",
          author: "orchestrator",
          time: { created: Date.now() },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: scheduler.id,
          messageID: assistant.id,
          type: "text",
          text: "Screening report: Sample A scores 8, 7, 6, 5.",
        })
        const tool = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: scheduler.id,
          messageID: assistant.id,
          type: "tool",
          tool: "complete_task",
          callID: `complete-${assistant.id}`,
          state: { status: "running", input: {}, time: { start: Date.now() } },
        })
        const now = Date.now()
        const prepared = await prepareTaskCompletionDecision({
          taskID,
          visibleToolName: "complete_task",
          payload: {
            orchestrator_session_id: scheduler.id,
            orchestrator_message_id: assistant.id,
            tool_call_id: tool.callID,
            tool_part_id: tool.id,
            evidence_locators: [locator],
            deliverable_artifact_locators: [locator],
            accepted_delivery_slice_revision_ids: [],
            workflow_binding: { kind: "direct", package_revision: binding },
            time_recorded: now,
          },
        })
        Database.immediateTransaction((db) => {
          const terminal = writeTaskUpdateInTransaction({
            db,
            taskID,
            values: { status: "completed" },
            summary: "Report delivered",
            now,
          })
          insertPreparedTaskCompletionDecision(db, prepared, terminal.task)
        })
        return { messageID: assistant.id, userMessageID: user.id }
      }
      const first = await completeReport()
      const api = EngineRoutes()
      const summaries = async () => {
        const response = await api.request(`/task/${taskID}/turn-artifacts`)
        expect(response.status).toBe(200)
        return (await response.json()) as any[]
      }
      const expected = { ...first, task: { id: taskID, status: "completed" }, entries: [{ locator }] }
      expect(await summaries()).toMatchObject([expected])
      const initialTerminal = taskLifecycleProjection(taskID)
      EngineService.OperatorMessageResumeTestHooks.reopenTerminalTaskForOperatorMessage(taskID)
      expect(viewTask(requireTask(taskID))).toMatchObject({
        status: "active",
        executionLifecycle: {
          epoch: 2,
          status: "active",
          previousTerminal: {
            epoch: 1,
            status: "completed",
            terminalEventID: initialTerminal.terminalEventID,
            terminalAt: initialTerminal.terminalAt,
          },
        },
      })
      expect(await summaries()).toMatchObject([expected])
      const bytes = await api.request(`/task/${taskID}/artifact-read`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locator, byte_offset: 0, max_bytes: 65536 }),
      })
      expect(bytes.status).toBe(200)
      expect((await bytes.json()).payload.report).toBe(
        "# Screening report\nSample A: quality 8, value 7, growth 6, momentum 5.",
      )
      const hydrated = await api.request(`/task/${taskID}/conversation`)
      expect(hydrated.status).toBe(200)
      expect(await hydrated.json()).toMatchObject({
        board: { task: { status: "active", executionLifecycle: { epoch: 2 } } },
        turnArtifacts: [expected],
      })
      const second = await completeReport()
      expect(await summaries()).toMatchObject([expected, { ...expected, ...second }])
      EngineService.OperatorMessageResumeTestHooks.reopenTerminalTaskForOperatorMessage(taskID)
      Database.immediateTransaction((db) =>
        writeTaskUpdateInTransaction({
          db,
          taskID,
          values: { status: "failed", error: "New request cannot be fulfilled" },
          summary: "Explicit new failure",
          now: Date.now(),
        }),
      )
      expect(await summaries()).toMatchObject([expected, { ...expected, ...second }])
      expect(taskTerminalOccurrences(taskID).map(({ epoch, status }) => ({ epoch, status }))).toEqual([
        { epoch: 1, status: "completed" },
        { epoch: 2, status: "completed" },
        { epoch: 3, status: "failed" },
      ])
    },
  })
  await using other = await memoryProject()
  await Instance.provide({
    directory: other.path,
    fn: async () => {
      const response = await EngineRoutes().request(`/task/${taskID}/turn-artifacts`)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe(`Task not found: ${taskID}`)
    },
  })
}, 60_000)
