import {
  CoordinationRequestEvidenceLocatorSchema,
  EngineArtifactLocatorSchema,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import z from "zod"
import {
  DispatchOccurrenceAuthoritySchema,
  type DispatchOccurrenceAuthority,
} from "@/engine/dispatch-occurrence-authority"

const IdentifierSchema = z.string().min(1).max(512)
const MESSAGE_LIMIT = 4_096

export const DispatchFailureIssueSchema = z
  .object({
    code: IdentifierSchema.optional(),
    path: z.array(z.union([z.string(), z.number().int()])),
    message: z.string().min(1).max(MESSAGE_LIMIT),
  })
  .strict()
  .describe(
    "Exact structured issue reported by the failed operation. An empty path identifies the operation root; path segments are never inferred from error text.",
  )

export type DispatchFailureIssue = z.infer<typeof DispatchFailureIssueSchema>

function normalizeIdentifier(value: string, fallback: string): string {
  const normalized = value.trim()
  return (normalized.length > 0 ? normalized : fallback).slice(0, 512)
}

function normalizeInfrastructureMessage(value: string): string {
  const normalized = value.trim()
  return (normalized.length > 0 ? normalized : "Unknown infrastructure failure").slice(0, MESSAGE_LIMIT)
}

function normalizeFailureIssues(
  issues: readonly DispatchFailureIssue[] | undefined,
): DispatchFailureIssue[] | undefined {
  if (!issues || issues.length === 0) return undefined
  return issues.map((issue) => ({
    ...(issue.code ? { code: normalizeIdentifier(issue.code, "infrastructure_failure") } : {}),
    path: [...issue.path],
    message: normalizeInfrastructureMessage(issue.message),
  }))
}

const TerminalSessionSchema = z
  .object({
    session_id: IdentifierSchema,
    final_message_id: IdentifierSchema,
  })
  .strict()

const WorkerTurnSettlementEvidenceSchema = z
  .object({
    descriptor_id: IdentifierSchema,
    descriptor_hash: IdentifierSchema,
    input_message_id: IdentifierSchema,
    current_dispatch_id: IdentifierSchema.optional(),
  })
  .strict()

export const DispatchOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("accepted"),
      session_id: IdentifierSchema,
      dispatch_lineage_id: IdentifierSchema,
    })
    .strict()
    .describe("The worker Turn has a durable lineage and is running independently of the root Orchestrator Turn."),
  TerminalSessionSchema.extend({
    kind: z.literal("terminal_success"),
  }).strict(),
  z
    .object({
      kind: z.literal("coordination"),
      session_id: IdentifierSchema,
      coordination_request: CoordinationRequestEvidenceLocatorSchema,
      dispatch_lineage_id: IdentifierSchema,
    })
    .strict(),
  TerminalSessionSchema.extend({
    kind: z.literal("partial"),
    failed_operation: IdentifierSchema,
    infrastructure_error: EngineArtifactLocatorSchema.optional(),
  })
    .strict()
    .describe(
      "A real terminal worker Turn exists, but a required post-Turn operation did not complete without typed deterministic contract-failure evidence.",
    ),
  z
    .object({
      kind: z.literal("infrastructure_failure"),
      operation: IdentifierSchema,
      message: z.string().min(1).max(MESSAGE_LIMIT),
      recovery_authority: DispatchOccurrenceAuthoritySchema,
      session_id: IdentifierSchema.optional(),
      final_message_id: IdentifierSchema.optional().describe(
        "Visible final specialist message when the failed operation happened after a real terminal worker Turn.",
      ),
      error_name: IdentifierSchema.optional(),
      failure_issues: z
        .array(DispatchFailureIssueSchema)
        .min(1)
        .optional()
        .describe(
          "Typed contract or validation issues supplied by the thrown error. Absence means no exact structured issue evidence was available.",
        ),
      infrastructure_error: EngineArtifactLocatorSchema.optional(),
      worker_turn: WorkerTurnSettlementEvidenceSchema.optional(),
    })
    .strict()
    .describe(
      "A dispatch or post-Turn operation failed. failure_issues, when present, are typed deterministic contract evidence; this terminal outcome never authorizes an automatic retry.",
    ),
])

export type DispatchOutcome = z.infer<typeof DispatchOutcomeSchema>

/**
 * One validated model-visible result protocol for every dispatch adapter.
 * Domain Artifact locators are intentionally absent from successful outcomes:
 * same-Task consumers discover facts through the Artifact Catalog.
 */
export namespace DispatchOutcome {
  export function parse(input: unknown): DispatchOutcome {
    return DispatchOutcomeSchema.parse(input)
  }

  export function accepted(input: { sessionID: string; dispatchLineageID: string }): DispatchOutcome {
    return parse({
      kind: "accepted",
      session_id: input.sessionID,
      dispatch_lineage_id: input.dispatchLineageID,
    })
  }

  export function terminal(input: { sessionID: string; finalMessageID: string }): DispatchOutcome {
    return parse({
      kind: "terminal_success",
      session_id: input.sessionID,
      final_message_id: input.finalMessageID,
    })
  }

  export function coordination(input: {
    sessionID: string
    requestID: string
    dispatchLineageID: string
  }): DispatchOutcome {
    return parse({
      kind: "coordination",
      session_id: input.sessionID,
      coordination_request: {
        source: "coordination_request",
        request_id: input.requestID,
      },
      dispatch_lineage_id: input.dispatchLineageID,
    })
  }

  export function partial(input: {
    sessionID: string
    finalMessageID: string
    failedOperation: string
    infrastructureError?: EngineArtifactLocator
  }): DispatchOutcome {
    return parse({
      kind: "partial",
      session_id: input.sessionID,
      final_message_id: input.finalMessageID,
      failed_operation: normalizeIdentifier(input.failedOperation, "persist_domain_artifact"),
      ...(input.infrastructureError ? { infrastructure_error: input.infrastructureError } : {}),
    })
  }

  export function infrastructureFailure(input: {
    operation: string
    message: string
    sessionID?: string
    finalMessageID?: string
    errorName?: string
    failureIssues?: readonly DispatchFailureIssue[]
    infrastructureError?: EngineArtifactLocator
    recoveryAuthority: DispatchOccurrenceAuthority
    workerTurn?: {
      descriptorID: string
      descriptorHash: string
      inputMessageID: string
      currentDispatchID?: string
    }
  }): DispatchOutcome {
    const failureIssues = normalizeFailureIssues(input.failureIssues)
    return parse({
      kind: "infrastructure_failure",
      operation: normalizeIdentifier(input.operation, "dispatch_adapter"),
      message: normalizeInfrastructureMessage(input.message),
      recovery_authority: DispatchOccurrenceAuthoritySchema.parse(input.recoveryAuthority),
      ...(input.sessionID ? { session_id: input.sessionID } : {}),
      ...(input.finalMessageID ? { final_message_id: input.finalMessageID } : {}),
      ...(input.errorName ? { error_name: normalizeIdentifier(input.errorName, "Error") } : {}),
      ...(failureIssues ? { failure_issues: failureIssues } : {}),
      ...(input.infrastructureError ? { infrastructure_error: input.infrastructureError } : {}),
      ...(input.workerTurn
        ? {
            worker_turn: {
              descriptor_id: input.workerTurn.descriptorID,
              descriptor_hash: input.workerTurn.descriptorHash,
              input_message_id: input.workerTurn.inputMessageID,
              ...(input.workerTurn.currentDispatchID
                ? { current_dispatch_id: input.workerTurn.currentDispatchID }
                : {}),
            },
          }
        : {}),
    })
  }
}
