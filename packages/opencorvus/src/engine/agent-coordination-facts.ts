import z from "zod"
import { Identifier } from "@/id/id"
import { ProjectedWorkerBindingSchema } from "@/agent/projected-worker-binding"
import { EvidenceLocatorInputListSchema, EvidenceLocatorListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { AgentCoordinationRedispatchBindingSchema } from "./agent-coordination-redispatch"
import { AGENT_COORDINATION_DECISIONS } from "./agent-coordination-decision"
import { ProjectedAgentWorkScopeSchema } from "@/agent/projected-agent-work-scope"
import { TerminalLifecycleReferenceSchema } from "./terminal-lifecycle-reference-schema"

const NonEmptyString = z.string().min(1)
const PositiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const MetadataRecord = z.record(z.string(), z.unknown())

export const AgentCoordinationWorkerToolInputSchema = z
  .object({
    summary: NonEmptyString,
    details: NonEmptyString,
    blocking: z.boolean(),
    requested_decision: NonEmptyString,
    evidence_locators: EvidenceLocatorInputListSchema.optional(),
    severity: z.enum(["info", "blocked", "failure"]).optional(),
  })
  .strict()

export const AgentCoordinationRequestFactSchema = z
  .object({
    request_id: Identifier.schema("artifact"),
    task_id: Identifier.schema("task"),
    execution_epoch: PositiveSafeInteger,
    session_id: Identifier.schema("session"),
    agent: NonEmptyString,
    worker_binding: ProjectedWorkerBindingSchema,
    origin: z.enum(["worker_handoff", "operator_steer"]),
    message_id: Identifier.schema("message").optional(),
    tool_call_id: NonEmptyString.optional(),
    tool_part_id: Identifier.schema("part").optional(),
    tool_input: AgentCoordinationWorkerToolInputSchema.optional(),
    operator_steer_id: Identifier.schema("artifact").optional(),
    operator_message: NonEmptyString.optional(),
    delivery_slice_subject: NonEmptyString.optional(),
    summary: NonEmptyString,
    details: NonEmptyString,
    blocking: z.boolean(),
    requested_decision: NonEmptyString,
    evidence_locators: EvidenceLocatorListSchema.optional(),
    severity: z.enum(["info", "blocked", "failure"]),
    created_at: PositiveSafeInteger,
    session_lineage_source: z.enum(["task_session_tree", "dispatch_lineage"]),
    dispatch_lineage_id: Identifier.schema("artifact").optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.worker_binding.identity.agentID !== value.agent) {
      context.addIssue({ code: "custom", path: ["worker_binding", "identity", "agentID"], message: "must match agent" })
    }
    if (value.origin === "worker_handoff") {
      if (!value.message_id) context.addIssue({ code: "custom", path: ["message_id"], message: "required" })
      if (!value.tool_call_id) context.addIssue({ code: "custom", path: ["tool_call_id"], message: "required" })
      if (!value.tool_part_id) context.addIssue({ code: "custom", path: ["tool_part_id"], message: "required" })
      if (!value.tool_input) context.addIssue({ code: "custom", path: ["tool_input"], message: "required" })
      if (!value.dispatch_lineage_id) {
        context.addIssue({ code: "custom", path: ["dispatch_lineage_id"], message: "required" })
      }
      if (value.session_lineage_source !== "dispatch_lineage") {
        context.addIssue({ code: "custom", path: ["session_lineage_source"], message: "must be dispatch_lineage" })
      }
      if (value.operator_steer_id !== undefined || value.operator_message !== undefined) {
        context.addIssue({ code: "custom", path: ["origin"], message: "worker request cannot carry operator fields" })
      }
      const expectedSeverity = value.tool_input?.severity ?? (value.tool_input?.blocking ? "blocked" : "info")
      for (const [field, expected] of [
        ["summary", value.tool_input?.summary],
        ["details", value.tool_input?.details],
        ["blocking", value.tool_input?.blocking],
        ["requested_decision", value.tool_input?.requested_decision],
        ["severity", expectedSeverity],
      ] as const) {
        if (value[field] !== expected) {
          context.addIssue({ code: "custom", path: [field], message: `must match tool_input.${field}` })
        }
      }
    } else {
      if (value.operator_steer_id !== value.request_id) {
        context.addIssue({ code: "custom", path: ["operator_steer_id"], message: "must equal request_id" })
      }
      if (!value.operator_message) {
        context.addIssue({ code: "custom", path: ["operator_message"], message: "required" })
      }
      if (value.session_lineage_source !== "dispatch_lineage" || !value.dispatch_lineage_id) {
        context.addIssue({
          code: "custom",
          path: ["session_lineage_source"],
          message: "operator steer requires its exact dispatch_lineage",
        })
      }
      if (
        value.message_id !== undefined ||
        value.tool_call_id !== undefined ||
        value.tool_part_id !== undefined ||
        value.tool_input !== undefined ||
        value.evidence_locators !== undefined
      ) {
        context.addIssue({ code: "custom", path: ["origin"], message: "operator request cannot carry Tool fields" })
      }
      const expectedSummary = `Operator steer for ${value.agent} session ${value.session_id}`
      if (value.details !== value.operator_message) {
        context.addIssue({ code: "custom", path: ["details"], message: "must match operator_message" })
      }
      if (value.requested_decision !== "operator_steer") {
        context.addIssue({ code: "custom", path: ["requested_decision"], message: "must be operator_steer" })
      }
      if (!value.blocking) context.addIssue({ code: "custom", path: ["blocking"], message: "must be true" })
      if (value.severity !== "blocked") {
        context.addIssue({ code: "custom", path: ["severity"], message: "must be blocked" })
      }
      if (value.summary !== expectedSummary) {
        context.addIssue({ code: "custom", path: ["summary"], message: "must match operator target identity" })
      }
    }
  })

export type AgentCoordinationRequestFact = z.infer<typeof AgentCoordinationRequestFactSchema>

export const AgentCoordinationResponseFactSchema = z
  .object({
    response_id: Identifier.schema("artifact"),
    request_id: Identifier.schema("artifact"),
    frontier_id: Identifier.schema("artifact"),
    previous_failed_outcome_id: Identifier.schema("artifact").nullable(),
    action_id: Identifier.schema("artifact"),
    task_id: Identifier.schema("task"),
    execution_epoch: PositiveSafeInteger,
    orchestrator_session_id: Identifier.schema("session"),
    orchestrator_message_id: Identifier.schema("message"),
    orchestrator_tool_call_id: NonEmptyString,
    orchestrator_tool_part_id: Identifier.schema("part"),
    decision: z.enum(AGENT_COORDINATION_DECISIONS),
    reason: NonEmptyString,
    message: NonEmptyString.optional(),
    created_at: PositiveSafeInteger,
  })
  .strict()
  .superRefine((value, context) => {
    const expectedFrontier = value.previous_failed_outcome_id ?? value.request_id
    if (value.frontier_id !== expectedFrontier) {
      context.addIssue({ code: "custom", path: ["frontier_id"], message: "must identify the claimed request frontier" })
    }
  })

export type AgentCoordinationResponseFact = z.infer<typeof AgentCoordinationResponseFactSchema>

export const AgentCoordinationActionFactSchema = z
  .object({
    action_id: Identifier.schema("artifact"),
    request_id: Identifier.schema("artifact"),
    response_id: Identifier.schema("artifact"),
    task_id: Identifier.schema("task"),
    execution_epoch: PositiveSafeInteger,
    orchestrator_session_id: Identifier.schema("session"),
    orchestrator_message_id: Identifier.schema("message"),
    orchestrator_tool_call_id: NonEmptyString,
    orchestrator_tool_part_id: Identifier.schema("part"),
    action: z.enum(["cancel_worker", "redispatch_worker", "fail_task", "ask_user", "acknowledge_terminal"]),
    decision: z.enum(AGENT_COORDINATION_DECISIONS),
    target_session_id: Identifier.schema("session"),
    target_agent: NonEmptyString,
    delivery_slice_subject: NonEmptyString.optional(),
    reason: NonEmptyString,
    redispatch_binding: AgentCoordinationRedispatchBindingSchema.optional(),
    created_at: PositiveSafeInteger,
  })
  .strict()
  .superRefine((value, context) => {
    const expectedAction = value.decision === "redispatch" ? "redispatch_worker" : value.decision
    if (value.action !== expectedAction) {
      context.addIssue({ code: "custom", path: ["action"], message: "must match decision" })
    }
    if ((value.action === "redispatch_worker") !== (value.redispatch_binding !== undefined)) {
      context.addIssue({ code: "custom", path: ["redispatch_binding"], message: "must exist only for redispatch" })
    }
  })

export type AgentCoordinationActionFact = z.infer<typeof AgentCoordinationActionFactSchema>

const CompletedOutcomeReceiptSchemas = {
  redispatch_worker: z
    .object({
      dispatch_lineage_id: Identifier.schema("artifact"),
      dispatch_id: Identifier.schema("artifact"),
      dispatch_session_id: Identifier.schema("session"),
      dispatch_agent_id: NonEmptyString,
      work_scope: ProjectedAgentWorkScopeSchema,
      dispatch_bound: z.literal(true),
      awaiting_explicit_dispatch: z.literal(false),
    })
    .strict(),
  ask_user: z
    .object({
      question_id: NonEmptyString,
      interaction_id: Identifier.schema("interaction"),
      interaction_status: z.enum(["answered", "rejected", "expired"]),
    })
    .strict(),
  fail_task: z
    .object({
      task_id: Identifier.schema("task"),
      task_status: z.literal("failed"),
      terminal_event_id: NonEmptyString,
    })
    .strict(),
  acknowledge_terminal: z
    .object({
      terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
      terminal_ingress_id: NonEmptyString,
    })
    .strict(),
  cancel_worker: z
    .object({
      session_id: Identifier.schema("session"),
      physical_cancelled: z.boolean(),
      prompt_cancelled: z.boolean(),
      summary: NonEmptyString,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.physical_cancelled !== value.prompt_cancelled) {
        context.addIssue({ code: "custom", path: ["prompt_cancelled"], message: "must match physical_cancelled" })
      }
    }),
} as const

export const AgentCoordinationActionOutcomeFactSchema = z
  .object({
    outcome_id: Identifier.schema("artifact"),
    request_id: Identifier.schema("artifact"),
    response_id: Identifier.schema("artifact"),
    action_id: Identifier.schema("artifact"),
    task_id: Identifier.schema("task"),
    execution_epoch: PositiveSafeInteger,
    action: z.enum(["cancel_worker", "redispatch_worker", "fail_task", "ask_user", "acknowledge_terminal"]),
    status: z.enum(["completed", "failed"]),
    result: MetadataRecord.optional(),
    error: NonEmptyString.optional(),
    created_at: PositiveSafeInteger,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "failed" && !value.error) {
      context.addIssue({ code: "custom", path: ["error"], message: "required for failed outcome" })
    }
    if (value.status !== "failed" && value.error !== undefined) {
      context.addIssue({ code: "custom", path: ["error"], message: "allowed only for failed outcome" })
    }
    if (value.status === "completed" && value.result === undefined) {
      context.addIssue({ code: "custom", path: ["result"], message: "completed outcome requires effect receipt" })
      return
    }
    if (value.status !== "completed" || !value.result) return
    const receipt = CompletedOutcomeReceiptSchemas[value.action].safeParse(value.result)
    if (!receipt.success) {
      for (const issue of receipt.error.issues) {
        context.addIssue({ code: "custom", path: ["result", ...issue.path], message: issue.message })
      }
    }
  })

export type AgentCoordinationActionOutcomeFact = z.infer<typeof AgentCoordinationActionOutcomeFactSchema>

export type AgentCoordinationProjection = {
  status: "pending" | "responded" | "superseded"
  frontierID: string
  previousFailedOutcomeID?: string
  response?: AgentCoordinationResponseFact
  action?: AgentCoordinationActionFact
  actionStatus?: "pending" | "completed" | "failed" | "superseded"
  actionResult?: Record<string, unknown>
  terminalOutcome?: AgentCoordinationActionOutcomeFact
  lastFailedResponse?: AgentCoordinationResponseFact
  lastFailedAction?: AgentCoordinationActionFact
  lastFailedOutcome?: AgentCoordinationActionOutcomeFact
  failedAttempts: number
}

function factOrder(left: { created_at: number; outcome_id: string }, right: { created_at: number; outcome_id: string }) {
  return left.created_at - right.created_at || (left.outcome_id < right.outcome_id ? -1 : left.outcome_id > right.outcome_id ? 1 : 0)
}

export type AgentCoordinationActionProjection = {
  status: "pending" | "completed" | "failed" | "superseded"
  result: Record<string, unknown>
  terminalOutcome?: AgentCoordinationActionOutcomeFact
}

/** The only action-state reducer used by request, action, replay, and UI projections. */
export function reduceAgentCoordinationActionFacts(input: {
  action: AgentCoordinationActionFact
  outcomes: readonly AgentCoordinationActionOutcomeFact[]
  currentExecutionEpoch: number
}): AgentCoordinationActionProjection {
  const ordered = input.outcomes.toSorted(factOrder)
  if (ordered.length > 1) throw new Error(`Coordination action ${input.action.action_id} has multiple terminal outcomes`)
  const terminalOutcome = ordered[0]
  const status = terminalOutcome
    ? terminalOutcome.status === "completed"
      ? "completed"
      : "failed"
    : input.action.execution_epoch === input.currentExecutionEpoch
      ? "pending"
      : "superseded"
  return {
    status,
    result: Object.assign({}, ...ordered.map((outcome) => outcome.result ?? {})) as Record<string, unknown>,
    ...(terminalOutcome ? { terminalOutcome } : {}),
  }
}

export function reduceAgentCoordinationFacts(input: {
  request: AgentCoordinationRequestFact
  responses: readonly AgentCoordinationResponseFact[]
  actions: readonly AgentCoordinationActionFact[]
  outcomes: readonly AgentCoordinationActionOutcomeFact[]
  currentExecutionEpoch: number
}): AgentCoordinationProjection {
  const responses = new Map<string, AgentCoordinationResponseFact>()
  const actions = new Map(input.actions.map((action) => [action.response_id, action]))
  const outcomes = new Map<string, AgentCoordinationActionOutcomeFact[]>()
  for (const response of input.responses) {
    if (response.request_id !== input.request.request_id) continue
    if (responses.has(response.frontier_id)) throw new Error(`Coordination frontier ${response.frontier_id} has multiple responses`)
    responses.set(response.frontier_id, response)
  }
  for (const outcome of input.outcomes) {
    if (outcome.request_id !== input.request.request_id) continue
    const list = outcomes.get(outcome.action_id) ?? []
    list.push(outcome)
    outcomes.set(outcome.action_id, list)
  }

  let frontierID = input.request.request_id
  let previousFailedOutcomeID: string | undefined
  let failedAttempts = 0
  let lastFailedResponse: AgentCoordinationResponseFact | undefined
  let lastFailedAction: AgentCoordinationActionFact | undefined
  let lastFailedOutcome: AgentCoordinationActionOutcomeFact | undefined
  const visited = new Set<string>()
  while (true) {
    if (visited.has(frontierID)) throw new Error(`Coordination request ${input.request.request_id} has a frontier cycle`)
    visited.add(frontierID)
    const response = responses.get(frontierID)
    if (!response) {
      return {
        status: input.request.execution_epoch === input.currentExecutionEpoch ? "pending" : "superseded",
        frontierID,
        previousFailedOutcomeID,
        lastFailedResponse,
        lastFailedAction,
        lastFailedOutcome,
        failedAttempts,
      }
    }
    const action = actions.get(response.response_id)
    if (!action || action.action_id !== response.action_id) {
      throw new Error(`Coordination response ${response.response_id} has no exact action plan`)
    }
    const actionProjection = reduceAgentCoordinationActionFacts({
      action,
      outcomes: outcomes.get(action.action_id) ?? [],
      currentExecutionEpoch: input.currentExecutionEpoch,
    })
    const terminalOutcome = actionProjection.terminalOutcome
    if (actionProjection.status === "pending" || actionProjection.status === "superseded") {
      const superseded = actionProjection.status === "superseded"
      return {
        status: superseded ? "superseded" : "responded",
        frontierID,
        previousFailedOutcomeID,
        response,
        action,
        actionStatus: superseded ? "superseded" : "pending",
        actionResult: actionProjection.result,
        lastFailedResponse,
        lastFailedAction,
        lastFailedOutcome,
        failedAttempts,
      }
    }
    if (actionProjection.status === "completed" && terminalOutcome) {
      return {
        status: "responded",
        frontierID,
        previousFailedOutcomeID,
        response,
        action,
        actionStatus: "completed",
        actionResult: actionProjection.result,
        terminalOutcome,
        lastFailedResponse,
        lastFailedAction,
        lastFailedOutcome,
        failedAttempts,
      }
    }
    failedAttempts += 1
    lastFailedResponse = response
    lastFailedAction = action
    lastFailedOutcome = terminalOutcome!
    previousFailedOutcomeID = terminalOutcome!.outcome_id
    frontierID = terminalOutcome!.outcome_id
  }
}
