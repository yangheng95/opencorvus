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

type ResearchPersistenceInput = {
  taskID: string
  dispatchID: string
  component: "deep-research" | "frontend-research"
  sessionID: string
  finalMessageID: string
  persist: () => string
  recordInfrastructure?: typeof recordTaskInfrastructureErrorBestEffort
}

/** A brief that stands on its own: the dispatch is done. */
export function persistCompleteResearchBrief(input: ResearchPersistenceInput): DispatchOutcomeResult {
  return persistResearchArtifactBestEffort({
    ...input,
    operation: "persist-research-brief",
    succeeded: () => DispatchOutcome.terminal({ sessionID: input.sessionID, finalMessageID: input.finalMessageID }),
  })
}

/** A brief the worker could not finish: the domain stays incomplete. */
export function persistPartialResearchBrief(input: ResearchPersistenceInput): DispatchOutcomeResult {
  return persistResearchArtifactBestEffort({
    ...input,
    operation: "persist-partial-research-brief",
    succeeded: (artifactID) =>
      DispatchOutcome.domainIncomplete({
        sessionID: input.sessionID,
        finalMessageID: input.finalMessageID,
        domain: input.component.replaceAll("-", "_"),
        domainArtifact: exactEngineArtifactLocator({ taskID: input.taskID, artifactID }),
      }),
  })
}

/**
 * Shared failure handling for both. The success shape and the operation name
 * used to be two separate parameters that every caller had to keep in
 * agreement — `delivery: "incomplete"` was only ever passed together with
 * `operation: "persist-partial-research-brief"`, and nothing checked that.
 */
function persistResearchArtifactBestEffort(
  input: ResearchPersistenceInput & {
    operation: "persist-research-brief" | "persist-partial-research-brief"
    succeeded: (artifactID: string) => DispatchOutcomeResult
  },
): DispatchOutcomeResult {
  try {
    return input.succeeded(input.persist())
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
