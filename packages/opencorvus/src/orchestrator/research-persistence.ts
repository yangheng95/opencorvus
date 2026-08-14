import {
  DispatchOutcome,
  type DispatchFailureIssue,
  type DispatchOutcome as DispatchOutcomeResult,
} from "@/agent/dispatch-outcome"
import { ResearchArtifactContractError } from "@/engine/persist"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import z from "zod"
import { resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"
import { exactEngineArtifactLocator } from "@/artifact-catalog"

function issuePathSegment(segment: PropertyKey): string | number {
  return typeof segment === "number" || typeof segment === "string"
    ? segment
    : String(segment)
}

function deterministicContractIssues(error: unknown): DispatchFailureIssue[] | undefined {
  if (error instanceof ResearchArtifactContractError) {
    return error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.map(issuePathSegment),
      message: issue.message,
    }))
  }
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.map(issuePathSegment),
      message: issue.message,
    }))
  }
  return undefined
}

export function persistResearchArtifactBestEffort(input: {
  taskID: string
  dispatchID: string
  component: "deep-research" | "frontend-research"
  operation: "persist-research-brief" | "persist-partial-research-brief"
  delivery: "complete" | "incomplete"
  sessionID: string
  finalMessageID: string
  persist: () => string
  recordInfrastructure?: typeof recordTaskInfrastructureErrorBestEffort
}): DispatchOutcomeResult {
  try {
    const artifactID = input.persist()
    return input.delivery === "incomplete"
      ? DispatchOutcome.domainIncomplete({
          sessionID: input.sessionID,
          finalMessageID: input.finalMessageID,
          domain: input.component.replaceAll("-", "_"),
          domainArtifact: exactEngineArtifactLocator({ taskID: input.taskID, artifactID }),
        })
      : DispatchOutcome.terminal({
          sessionID: input.sessionID,
          finalMessageID: input.finalMessageID,
        })
  } catch (error) {
    const failureIssues = deterministicContractIssues(error)
    const reason = error instanceof Error ? error.message : String(error)
    const errorName = error instanceof Error ? error.name : undefined
    const infrastructureRef = (input.recordInfrastructure ?? recordTaskInfrastructureErrorBestEffort)({
      taskID: input.taskID,
      component: input.component,
      operation: input.operation,
      reason,
      errorName,
      sessionID: input.sessionID,
      context: {
        final_message_id: input.finalMessageID,
        ...(failureIssues ? { failure_issues: failureIssues } : {}),
      },
    })
    if (failureIssues) {
      return DispatchOutcome.infrastructureFailure({
        operation: input.operation,
        message: reason,
        sessionID: input.sessionID,
        finalMessageID: input.finalMessageID,
        errorName,
        failureIssues,
        infrastructureError: infrastructureRef,
        recoveryAuthority: resolveDispatchOccurrenceAuthority({
          taskID: input.taskID,
          dispatchID: input.dispatchID,
        }),
      })
    }
    return DispatchOutcome.partial({
      sessionID: input.sessionID,
      finalMessageID: input.finalMessageID,
      failedOperation: input.operation,
      infrastructureError: infrastructureRef,
    })
  }
}
