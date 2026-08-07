import {
  DispatchOutcome,
  type DispatchFailureIssue,
  type DispatchOutcome as DispatchOutcomeResult,
} from "@/agent/dispatch-outcome"
import { ResearchArtifactContractError } from "@/engine/persist"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import z from "zod"

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
  component: "deep-research" | "frontend-research"
  operation: "persist-research-brief" | "persist-partial-research-brief"
  sessionID: string
  finalMessageID: string
  persist: () => string
  recordInfrastructure?: typeof recordTaskInfrastructureErrorBestEffort
}): DispatchOutcomeResult {
  try {
    input.persist()
    return DispatchOutcome.terminal({
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
