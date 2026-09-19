import { afterEach, describe, expect, test } from "bun:test"
import { orchestratorDecisionToolCompletionEffect } from "@/orchestrator/decision-tool-names"
import { createNoActionTool, NoActionInputSchema, noActionTaskObservation, TaskLifecycleObservationConflictError } from "@/orchestrator/no-action-tool"
import { appendTaskReopenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { requireTask } from "@/engine/store"
import { ProtocolStore } from "@/protocol/store"
import { Database } from "@/storage/db"
import { Instance } from "@/project/instance"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { toolResultControl } from "@/session/tool-result-control"
import { toolExecutionModeOf } from "@/tool/execution-mode"

afterEach(async () => { await Instance.disposeAll(); await resetMemoryDatabase() })

describe("Orchestrator no_action decision", () => {
  test("returns verified active and terminal receipts or exact lifecycle conflict facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: "Observed Task lifecycle" })
      const definition = createNoActionTool({ taskID }).no_action
      const input = NoActionInputSchema.parse({
        reason: "The current conversation-only status question is answered.",
        observed_task: noActionTaskObservation(taskLifecycleProjection(taskID)),
      })
      const result = await definition.execute!(input, {} as never)

      expect({
        executionMode: toolExecutionModeOf(definition as object),
        effect: orchestratorDecisionToolCompletionEffect({ tool: "no_action", stateInput: input }),
        result,
        control: toolResultControl((result as { metadata: Record<string, unknown> }).metadata),
      }).toEqual({
        executionMode: "turn_control_exclusive",
        effect: "satisfies_current_epoch",
        result: {
          title: "Current Ingress Reconciled",
          output: JSON.stringify({ reason: input.reason, observed_task: input.observed_task }),
          metadata: expect.any(Object),
        },
        control: { kind: "immediate_park" },
      })
      const completed = Database.immediateTransaction((db) => ProtocolStore.appendEventInTransaction({
        kind: "event", type: "task.completed", aggregate: "task", aggregate_id: taskID, task_id: null,
        session_id: requireTask(taskID).session_id!, source: "test.no-action", emitted_at: Date.now(),
        payload: { execution_epoch: 1 },
      }))
      const current = noActionTaskObservation(taskLifecycleProjection(taskID))
      expect(current).toMatchObject({ epoch: 1, status: "completed", terminalEventID: completed.id })
      let conflict: unknown
      try { await definition.execute!(input, {} as never) } catch (error) { conflict = error }
      expect(conflict).toBeInstanceOf(TaskLifecycleObservationConflictError)
      expect((conflict as TaskLifecycleObservationConflictError).actual).toEqual(current)
      const terminal = await definition.execute!({ ...input, observed_task: current }, {} as never)
      expect(JSON.parse((terminal as { output: string }).output).observed_task).toEqual(current)
      Database.immediateTransaction((db) => appendTaskReopenedInTransaction({
        db, taskID, sessionID: requireTask(taskID).session_id!, now: Date.now(), source: "test.no-action",
      }))
      const reopened = noActionTaskObservation(taskLifecycleProjection(taskID))
      conflict = undefined
      try { await definition.execute!({ ...input, observed_task: current }, {} as never) } catch (error) { conflict = error }
      expect(conflict).toBeInstanceOf(TaskLifecycleObservationConflictError)
      expect((conflict as TaskLifecycleObservationConflictError).actual).toEqual(reopened)
      const active = await definition.execute!({ ...input, observed_task: reopened }, {} as never)
      expect(JSON.parse((active as { output: string }).output).observed_task).toEqual(reopened)
    } })
  })
})
