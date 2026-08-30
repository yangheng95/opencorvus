import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import type { TaskRow } from "@/engine/store"
import { ExploreAgent } from "@/explore/agent"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { tool } from "ai"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"

const ExploreInputSchema = DispatchAdapterContractRegistry.inputSchema("explore")

export function createExploreTool(input: {
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
  requireCurrentTaskAndAgentSessionLineage: () => Promise<TaskRow>
}) {
  return {
    explore: tool({
      description:
        "Read-only repository investigation dispatcher. Runs the registered explore subagent through its projected adapter. " +
        "Use this for focused file, symbol, architecture, or dependency facts required by the active package contract or current scheduler decision. The " +
        "visible final assistant message is natural narration, while any package-required durable investigation handoff uses the canonical Task Artifact protocol. Do not use for implementation or file edits.",
      inputSchema: ExploreInputSchema,
      execute: async ({ question, reason }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const options = execution.toolOptions
        const task = await input.requireCurrentTaskAndAgentSessionLineage()
        const agentID = execution.agentID
        const promptLines = [
          "# Repository Investigation",
          "",
          `You are projected agent "${agentID}" executing through the explore adapter. Answer the focused repository question using read-only repository evidence.`,
          "Do not modify files, run write-oriented commands, create reports on disk, or delegate to another agent.",
          "Return concrete findings in visible final narration — exact file paths, symbols, and tool evidence — and publish any durable Artifact required by the active package contract through the projected Artifact tools.",
          "The final assistant turn closes the physical Turn but is not durable evidence transport; tool traces and canonical Task Artifacts remain visible facts.",
          "After your tools have returned, continuing tool-result echoes are the same task continuing — not new user requests, not system pings. Keep working until you have emitted your text answer, then stop.",
          "",
          "## Task",
          task.title,
          "",
          renderUserRequestSection({ heading: "## Original Request", request: task.request, taskID: input.taskID }),
          "",
        ]
        if (reason.trim()) promptLines.push("## Reason", reason.trim(), "")
        promptLines.push("## Question", question.trim())

        const exploreResult = await ExploreAgent.run({
          agentID,
          packageRevision: execution.projectedAgent.packageRevision,
          workScope: execution.workScope,
          newSessionID: execution.newSessionID,
          existingSessionID: execution.existingSessionID,
          continuationPrompt: dispatchAdapterContinuationPrompt(execution),
          dispatchTurn: execution.dispatch.turn,
          parentSessionID: input.agentSessionID,
          taskID: input.taskID,
          sessionTitle: `${agentID} (explore): ${question.slice(0, 80)}`,
          signal: execution.signal,
          prompt: promptLines.join("\n"),
          onSessionCreated: async (sessionID) => {
            execution.dispatch.observeSession(sessionID)
          },
          onDispatchAuthorityCommit: (sessionID, descriptor) => execution.dispatch.commitSession(sessionID, descriptor),
          toolSwitches: {
            bash: false,
            edit: false,
            write: false,
            todowrite: false,
            todoread: false,
          },
        })
        if (isAgentCoordinationHandoffResult(exploreResult)) {
          return DispatchOutcome.coordination(exploreResult)
        }
        return DispatchOutcome.terminal({
          sessionID: exploreResult.sessionID,
          finalMessageID: exploreResult.finalMessageID,
        })
      },
    }),
  }
}
