import { tool } from "ai"
import type z from "zod"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { BuildAgent, buildUserPrompt } from "@/build/agent"
import { requireTask } from "@/engine/store"
import { Instance } from "@/project/instance"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { isExecutionCancellationError } from "@/session/prompt/cancellation"
import { Log } from "@/util/log"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import { projectedAdapterError } from "./projected-adapter-error"

const log = Log.create({ service: "build-tool" })

export async function failBuildAdapterExecution(input: {
  taskID: string
  agentID: string
  failure: unknown
}): Promise<never> {
  if (isExecutionCancellationError(input.failure)) throw input.failure

  const message = input.failure instanceof Error ? input.failure.message : String(input.failure)
  log.error("build tool failed", { taskID: input.taskID, error: message })
  throw projectedAdapterError(input.agentID, "build", input.failure)
}

type BuildToolInput = {
  goal_ids: string[]
  request?: string
  reason: string
  worktreeUsage?: "managed_worktree" | "current_project"
}

type BuildToolDependencies = {
  inputSchema: z.ZodType<BuildToolInput>
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
  buildAgentContextSections: (
    entries: Array<{
      title: string
      body: string | undefined
    }>,
  ) => string[]
}

export function createBuildTool(dependencies: BuildToolDependencies) {
  const taskID = dependencies.taskID
  const input = { agentSessionID: dependencies.parentSessionID, signal: dependencies.signal }

  return {
    build: tool({
      description:
        "Task-scoped implementation adapter. Runs one projected implementation agent with read, write, edit, and shell tools " +
        "against the current Task. `current_project` edits the Task project directory directly; `managed_worktree` lets the " +
        "Build runtime create a Task-owned worktree and expose its merge contract. The adapter waits for the child Session to " +
        "finish and returns one terminal typed outcome with the exact child Session/final-message references. It does not own " +
        "execution-attempt state, acceptance, review routing, or Task completion. Workers discover durable evidence through " +
        "artifact_search, artifact_locator_ref reads, and artifact_read_ref selections.",
      inputSchema: dependencies.inputSchema,
      execute: async ({ goal_ids, request = "", reason, worktreeUsage = "current_project" }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const agentID = execution.agentID
        try {
          const task = requireTask(taskID)
          const taskProjectDir = taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id })
          const implementationGuidance = request.trim()
          const contextSections = dependencies.buildAgentContextSections([
            {
              title: "Artifact Catalog Selection",
              body:
                "Search the Task Artifact catalog yourself by exact name/kind, current or historical version, recency, and fuzzy relevance. " +
                "Completely read every Artifact you use with artifact_read. No upstream participant selected or copied an Artifact body into this prompt; missing evidence must remain visible.",
            },
            {
              title: "Delivery Slice Subjects",
              body:
                goal_ids.length > 0
                  ? `This physical implementation Session is evidence for these exact immutable Delivery Slice revisions: ${goal_ids.join(", ")}. Treat them as work and evidence subjects, not lifecycle or scheduling owners.`
                  : "No Delivery Slice revision was selected for this physical implementation Session.",
            },
            ...(implementationGuidance
              ? [
                  {
                    title: "Current Implementation Guidance",
                    body: implementationGuidance,
                  },
                ]
              : []),
          ])
          const target = { kind: "request" as const, text: task.request }
          const context =
            contextSections.length > 0
              ? {
                  contextSections,
                  projectDir: taskProjectDir,
                }
              : undefined
          let boundSessionID = execution.existingSessionID

          log.info("build tool invoked", {
            taskID,
            reason,
            requestLen: request.length,
            workScope: execution.workScope,
            worktreeUsage,
          })

          const result = await BuildAgent.run({
            agentID,
            packageRevision: execution.projectedAgent.packageRevision,
            existingSessionID: execution.existingSessionID,
            continuationPrompt: dispatchAdapterContinuationPrompt(execution),
            dispatchTurn: execution.dispatch.turn,
            taskID: task.id,
            workScope: execution.workScope,
            message: {
              text: buildUserPrompt(target, context, task.id),
              attachmentRefs: [],
            },
            parentSessionID: input.agentSessionID,
            signal: input.signal,
            workDir: worktreeUsage === "current_project" ? taskProjectDir : undefined,
            onSessionCreated: async (sessionID) => {
              if (boundSessionID && boundSessionID !== sessionID) {
                throw new Error(`Created Build Session ${sessionID} does not match bound Session ${boundSessionID}`)
              }
              boundSessionID = sessionID
              execution.dispatch.observeSession(sessionID)
            },
            onRuntimeReady: async (sessionID) => {
              if (boundSessionID !== sessionID) {
                throw new Error(
                  `Runtime-ready Session ${sessionID} does not match bound Build Session ${boundSessionID ?? "<unset>"}`,
                )
              }
            },
            onDispatchAuthorityCommit: (sessionID, descriptor) => execution.dispatch.commitSession(sessionID, descriptor),
          })

          if (isAgentCoordinationHandoffResult(result)) {
            return DispatchOutcome.coordination(result)
          }
          const { sessionID, finalMessageID, infrastructureObservationLocators } = result
          return infrastructureObservationLocators?.length
            ? DispatchOutcome.partial({
                sessionID,
                finalMessageID,
                failedOperation: "persist-build-terminal-facts",
                infrastructureError: infrastructureObservationLocators[0],
              })
            : DispatchOutcome.terminal({ sessionID, finalMessageID })
        } catch (failure) {
          return failBuildAdapterExecution({ taskID, agentID, failure })
        }
      },
    }),
  }
}
