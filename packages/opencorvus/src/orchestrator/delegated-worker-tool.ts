import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { DelegatedWorkerAgent } from "@/delegated-worker/agent"
import { delegatedWorkerContextSections } from "@/delegated-worker/context"
import type { TaskRow } from "@/engine/store"
import { tool } from "ai"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import { projectedAdapterError } from "./projected-adapter-error"

const DelegatedWorkerInputSchema = DispatchAdapterContractRegistry.inputSchema("delegated_worker")

export function delegatedWorkerSessionTitle(agentID: string, instruction: string) {
  return `${agentID}: ${instruction.slice(0, 80)}`
}

export function createDelegatedWorkerTool(input: {
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
  requireCurrentTaskAndAgentSessionLineage: () => Promise<TaskRow>
}) {
  return {
    delegated_worker: tool({
      description:
        "Dispatch a projected general delegated worker through its exact runtime template. The worker returns its outcome in the visible final assistant message.",
      inputSchema: DelegatedWorkerInputSchema,
      execute: async ({ instruction, reason, goal_ids }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const agentID = execution.agentID
        try {
          const task = await input.requireCurrentTaskAndAgentSessionLineage()
          const run = await DelegatedWorkerAgent.run({
            agentID,
            packageRevision: execution.projectedAgent.packageRevision,
            workScope: execution.workScope,
            newSessionID: execution.newSessionID,
            existingSessionID: execution.existingSessionID,
            continuationPrompt: dispatchAdapterContinuationPrompt(execution),
            dispatchTurn: execution.dispatch.turn,
            instruction,
            contextSections: delegatedWorkerContextSections({
              reason,
              task,
              workScope: execution.workScope,
              deliverySliceRevisionIDs: goal_ids,
            }),
            sessionTitle: delegatedWorkerSessionTitle(agentID, instruction),
            taskID: input.taskID,
            parentSessionID: input.agentSessionID,
            signal: execution.signal,
            onSessionCreated: async (sessionID) => {
              execution.dispatch.observeSession(sessionID)
            },
            onDispatchAuthorityCommit: (sessionID, descriptor) => execution.dispatch.commitSession(sessionID, descriptor),
          })
          if (isAgentCoordinationHandoffResult(run)) {
            return DispatchOutcome.coordination(run)
          }
          return DispatchOutcome.terminal({
            sessionID: run.sessionID,
            finalMessageID: run.finalMessageID,
          })
        } catch (error) {
          throw projectedAdapterError(agentID, "delegated_worker", error)
        }
      },
    }),
  }
}
