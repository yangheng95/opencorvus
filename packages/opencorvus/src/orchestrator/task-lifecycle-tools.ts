import { tool } from "ai"
import z from "zod"
import { requireTask } from "@/engine/store"
import { deriveTaskStatus, isTaskTerminal } from "@/engine/task-status"
import { terminalTask } from "@/engine/state"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Instance } from "@/project/instance"
import { withImmediateParkToolResultControl } from "@/session/tool-result-control"
import type { OrchestratorToolExecutionContext } from "./tool-execution-context"
import { bindToolExecutionMode } from "@/tool/execution-mode"
import {
  allocateTaskCompletionDecisionTime,
  findTaskCompletionDecisionForTerminalTime,
  insertPreparedTaskCompletionDecision,
  prepareTaskCompletionDecision,
} from "@/engine/completion-decision"
import { ArtifactReadLocatorListSchema, EvidenceLocatorListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { TaskCancellationReason } from "@opencorvus-ai/transport-protocol"
import { Identifier } from "@/id/id"
import { selectedWorkflowBinding, type WorkflowProjection } from "@/engine/workflow-binding"
import { TaskLifecycleRuntime } from "./task-lifecycle-runtime"
import { assertTaskDispatchesSettledInTransaction } from "@/engine/dispatch-settlement"
import { Database } from "@/storage/db"
import {
  acquireTaskCompletionClosureInTransaction,
  assertTaskCompletionClosureOwnerInTransaction,
} from "@/engine/task-completion-closure"

export const CompleteTaskInputSchema = z
  .object({
    summary: z
      .string()
      .min(1)
      .describe(
        "Orchestrator-owned task decision summary. Cite the evidence you used, including IntegrityReview or VisualReview artifacts when relevant.",
      ),
    evidence_locators: EvidenceLocatorListSchema.default([]).describe(
      "Exact typed durable evidence locators used for this completion decision. Empty is explicit and remains visible; it is not a host-side completion gate. Raw IDs and artifact:<id> display strings are invalid.",
    ),
    deliverable_artifact_locators: ArtifactReadLocatorListSchema.default([]).describe(
      "Exact Artifact locators intentionally delivered to the user. Include every user-consumable report, document, screenshot set, structured result, or other published Artifact; use an empty list only when the Task produced no Artifact deliverable. Completion evidence belongs in evidence_locators instead.",
    ),
    accepted_delivery_slice_revision_ids: z
      .array(Identifier.schema("goal"))
      .default([])
      .describe(
        "Exact current Delivery Slice revision IDs accepted by this Task completion decision. Slice IDs are evidence subjects, not lifecycle owners; use an empty list only when the Task has no Delivery Slices.",
      ),
    workflow_id: z
      .string()
      .min(1)
      .nullable()
      .default(null)
      .describe(
        "Exact selected virtual workflow ID, or null for a direct Task with no selected virtual workflow. The persisted completion decision binds this ID to the active expert squad package revision and complete declared node graph.",
      ),
  })
  .strict()

export const FailTaskInputSchema = z.object({ error: z.string().describe("Why the task failed") }).strict()
export const CancelTaskInputSchema = z
  .object({ reason: TaskCancellationReason.describe("Why you are cancelling the task") })
  .strict()

export async function failTaskLifecycle(input: {
  taskID: string
  error: string
  a2aRequestID?: string
}): Promise<{ recoveredTerminalFailure: boolean }> {
  const task = requireTask(input.taskID)
  const recoveredTerminalFailure =
    input.a2aRequestID !== undefined &&
    deriveTaskStatus(task) === "failed" &&
    input.error.startsWith(`A2A request ${input.a2aRequestID}:`) &&
    task.error === input.error
  if (!recoveredTerminalFailure) {
    await terminalTask(
      task,
      { status: "failed", error: input.error },
      `Failed: ${input.error}`,
    )
  }
  return { recoveredTerminalFailure }
}

export function createTaskLifecycleTools(input: {
  taskID: string
  workflowProjection: WorkflowProjection
  requireExecutionContext: (options: unknown, toolName: string) => Promise<OrchestratorToolExecutionContext>
}) {
  return {
    complete_task: bindToolExecutionMode(tool({
      description:
        "Terminal task lifecycle decision: mark the task completed from the Orchestrator's current task evidence and explicit summary. " +
        "IntegrityReview, VisualReview, Host build observations, tests, and persisted task-root conversation messages are evidence inputs; none of them is a host-side completion lock. " +
        "When visual review was requested, cite the exact durable locators produced by the responsible review path: the latest core visual_review locator and its completeness_findings for a commissioned VisualReview, or the browser-preview capture locators when the selected expert-squad workflow assigns independent image review to its scheduler. Generic prose and unattached screenshot claims are not durable visual evidence. " +
        "Current Delivery Slice revisions, independent activity/evidence/review associations, and explicit Completion Decision acceptance are separate facts; none owns or gates Task lifecycle. " +
        "Call this only when you, the Orchestrator, have decided the task is complete from the current durable task snapshot.",
      inputSchema: CompleteTaskInputSchema,
      execute: async (
        {
          summary,
          evidence_locators,
          deliverable_artifact_locators,
          accepted_delivery_slice_revision_ids,
          workflow_id,
        },
        options,
      ) => {
        const execution = await input.requireExecutionContext(options, "complete_task")
        const task = requireTask(input.taskID)
        const taskStatus = deriveTaskStatus(task)
        if (isTaskTerminal(task)) {
          return `complete_task rejected: task ${input.taskID} is already terminal with status=${taskStatus}.`
        }
        const terminalSummary = summary.trim()
        if (!terminalSummary) return "complete_task rejected: summary is required."
        const closureOwnerID = `complete-task:${execution.toolPartID}`
        const closureTask = requireTask(input.taskID)
        const completedAt = allocateTaskCompletionDecisionTime(input.taskID)
        const preparedDecision = await prepareTaskCompletionDecision({
            taskID: input.taskID,
            payload: {
              orchestrator_session_id: execution.orchestratorSessionID,
              orchestrator_message_id: execution.orchestratorMessageID,
              tool_call_id: execution.toolCallID,
              tool_part_id: execution.toolPartID,
              evidence_locators,
              deliverable_artifact_locators,
              accepted_delivery_slice_revision_ids,
              workflow_binding: selectedWorkflowBinding({
                projection: input.workflowProjection,
                workflowID: workflow_id,
              }),
              time_recorded: completedAt,
            },
            visibleToolName: execution.visibleToolName,
        })
        Database.transaction((db) =>
          acquireTaskCompletionClosureInTransaction(db, {
            taskID: input.taskID,
            ownerID: closureOwnerID,
            orchestratorSessionID: execution.orchestratorSessionID,
            orchestratorMessageID: execution.orchestratorMessageID,
            toolCallID: execution.toolCallID,
            toolPartID: execution.toolPartID,
            timeAcquired: Date.now(),
          }),
        )
        const terminalResult = await terminalTask(
            closureTask,
            {
              status: "completed",
            },
            terminalSummary,
            {
              projectDir: taskPrimaryProjectRoot(input.taskID, { activeProjectID: Instance.project.id }),
              terminalAt: completedAt,
              transactionEffect: (db, terminalTask) => {
                assertTaskCompletionClosureOwnerInTransaction(db, {
                  taskID: input.taskID,
                  ownerID: closureOwnerID,
                })
                assertTaskDispatchesSettledInTransaction(db, input.taskID)
                insertPreparedTaskCompletionDecision(db, preparedDecision, terminalTask)
              },
            },
        )
        const actualStatus = deriveTaskStatus(terminalResult)
        const matchingDecision =
            actualStatus === "completed" && terminalResult.time_completed === completedAt
              ? findTaskCompletionDecisionForTerminalTime({
                  taskID: input.taskID,
                  timeCompleted: completedAt,
                })
              : undefined
        if (
            actualStatus !== "completed" ||
            terminalResult.time_completed !== completedAt ||
            matchingDecision?.id !== preparedDecision.artifactID
        ) {
          return `complete_task rejected: task ${input.taskID} became terminal with status=${actualStatus}; this call recorded no completion decision.`
        }
        return {
          title: "Task Completed",
          output: `Task ${input.taskID} completed: ${terminalSummary}.`,
          metadata: withImmediateParkToolResultControl({}),
        }
      },
    }), "turn_control_exclusive"),

    fail_task: bindToolExecutionMode(tool({
      description:
        "Exceptional force-majeure stop, never a normal Task outcome. A Task has only running and inactive public states and must remain under the same owner through every recoverable finding or interruption until accepted evidence supports completion. " +
        "Use only when the exact affected lineage proves completion requires unavailable external authority, refused destructive approval, a different fixed Squad, an irreducible operator product decision, or an external platform condition the Task cannot change or wait through. Preserve the exact evidence, closure result, and affected Delivery Slice revision IDs in the error.",
      inputSchema: FailTaskInputSchema,
      execute: async ({ error }, options) => {
        await input.requireExecutionContext(options, "fail_task")
        await failTaskLifecycle({
          taskID: input.taskID,
          error,
        })
        return {
          title: "Task Stopped",
          output: `Task ${input.taskID} became inactive because of force majeure: ${error}`,
          metadata: withImmediateParkToolResultControl({}),
        }
      },
    }), "turn_control_exclusive"),

    cancel_task: tool({
      description:
        "Cancel the task immediately. Use when the user explicitly asks to stop or abandon the current work.",
      inputSchema: CancelTaskInputSchema,
      execute: async ({ reason }, options) => {
        const execution = await input.requireExecutionContext(options, "cancel_task")
        await TaskLifecycleRuntime.cancelTask({
          taskID: input.taskID,
          origin: {
            actor: "orchestrator",
            source: "orchestrator.cancel_task",
            surface: "orchestrator",
            requestID: execution.toolCallID,
            reason,
            sessionID: execution.orchestratorSessionID,
            messageID: execution.orchestratorMessageID,
            toolCallID: execution.toolCallID,
            toolPartID: execution.toolPartID,
          },
        })
        return `Task ${input.taskID} cancelled. Reason: ${reason}`
      },
    }),
  }
}
