import { describe, expect, test } from "bun:test"
import {
  AgentCoordinationActionOutcomeFactSchema,
  AgentCoordinationRequestFactSchema,
  reduceAgentCoordinationFacts,
  type AgentCoordinationActionFact,
  type AgentCoordinationActionOutcomeFact,
  type AgentCoordinationRequestFact,
  type AgentCoordinationResponseFact,
} from "@/engine/agent-coordination-facts"
import { Identifier } from "@/id/id"

function requestFact(): AgentCoordinationRequestFact {
  const requestID = Identifier.ascending("artifact")
  const sessionID = Identifier.ascending("session")
  return {
    request_id: requestID,
    task_id: Identifier.ascending("task"),
    execution_epoch: 1,
    session_id: sessionID,
    agent: "review-worker",
    worker_binding: {
      identity: {
        agentID: "review-worker",
        baseRole: "delegated-worker",
        sessionKind: "delegated-worker",
        dispatchAdapterID: "delegated_worker",
        runtimeTemplateABIVersion: 1,
        dispatchAdapterABIVersion: 1,
        projectionHash: "a".repeat(64),
      },
      expertSquadID: "review-squad",
      workerTurnDescriptorID: "wtd_review",
      workerTurnDescriptorHash: "b".repeat(64),
    },
    origin: "operator_steer",
    operator_steer_id: requestID,
    operator_message: "Review the exact durable frontier",
    summary: `Operator steer for review-worker session ${sessionID}`,
    details: "Review the exact durable frontier",
    blocking: true,
    requested_decision: "operator_steer",
    severity: "blocked",
    created_at: 1,
    session_lineage_source: "dispatch_lineage",
    dispatch_lineage_id: Identifier.ascending("artifact"),
  }
}

function responseAction(input: {
  request: AgentCoordinationRequestFact
  frontierID: string
  failedOutcomeID?: string
  createdAt: number
}): { response: AgentCoordinationResponseFact; action: AgentCoordinationActionFact } {
  const responseID = Identifier.ascending("artifact")
  const actionID = Identifier.ascending("artifact")
  const response: AgentCoordinationResponseFact = {
    response_id: responseID,
    request_id: input.request.request_id,
    frontier_id: input.frontierID,
    previous_failed_outcome_id: input.failedOutcomeID ?? null,
    action_id: actionID,
    task_id: input.request.task_id,
    execution_epoch: 1,
    orchestrator_session_id: Identifier.ascending("session"),
    orchestrator_message_id: Identifier.ascending("message"),
    orchestrator_tool_call_id: `call_${input.createdAt}`,
    orchestrator_tool_part_id: Identifier.ascending("part"),
    decision: "cancel_worker",
    reason: "Settle the exact worker occurrence",
    created_at: input.createdAt,
  }
  return {
    response,
    action: {
      action_id: actionID,
      request_id: input.request.request_id,
      response_id: responseID,
      task_id: input.request.task_id,
      execution_epoch: 1,
      orchestrator_session_id: response.orchestrator_session_id,
      orchestrator_message_id: response.orchestrator_message_id,
      orchestrator_tool_call_id: response.orchestrator_tool_call_id,
      orchestrator_tool_part_id: response.orchestrator_tool_part_id,
      action: "cancel_worker",
      decision: "cancel_worker",
      target_session_id: input.request.session_id,
      target_agent: input.request.agent,
      reason: response.reason,
      created_at: input.createdAt,
    },
  }
}

function workerRequestFact(): AgentCoordinationRequestFact {
  const operator = requestFact()
  const { operator_steer_id: _operatorID, operator_message: _operatorMessage, ...shared } = operator
  const toolInput = {
    summary: "Worker needs one exact scheduler decision",
    details: "Continue only from the persisted worker occurrence.",
    blocking: true,
    requested_decision: "Choose the exact next worker action",
    severity: "blocked" as const,
  }
  return AgentCoordinationRequestFactSchema.parse({
    ...shared,
    request_id: Identifier.ascending("artifact"),
    origin: "worker_handoff",
    message_id: Identifier.ascending("message"),
    tool_call_id: "call_worker_coordination",
    tool_part_id: Identifier.ascending("part"),
    tool_input: toolInput,
    summary: toolInput.summary,
    details: toolInput.details,
    blocking: toolInput.blocking,
    requested_decision: toolInput.requested_decision,
    severity: toolInput.severity,
  })
}

describe("immutable agent coordination reduction", () => {
  test("validates canonical request fields and typed completed effect receipts at the fact boundary", () => {
    const operator = requestFact()
    expect(AgentCoordinationRequestFactSchema.parse(operator)).toEqual(operator)
    expect(
      AgentCoordinationRequestFactSchema.safeParse({ ...operator, details: "changed scheduler details" }),
    ).toMatchObject({ success: false, error: { issues: expect.arrayContaining([expect.objectContaining({ path: ["details"] })]) } })

    const worker = workerRequestFact()
    expect(AgentCoordinationRequestFactSchema.parse(worker)).toEqual(worker)
    expect(
      AgentCoordinationRequestFactSchema.safeParse({ ...worker, summary: "changed worker summary" }),
    ).toMatchObject({ success: false, error: { issues: expect.arrayContaining([expect.objectContaining({ path: ["summary"] })]) } })

    const attempt = responseAction({ request: operator, frontierID: operator.request_id, createdAt: 2 })
    const completed: AgentCoordinationActionOutcomeFact = {
      outcome_id: Identifier.ascending("artifact"),
      request_id: operator.request_id,
      response_id: attempt.response.response_id,
      action_id: attempt.action.action_id,
      task_id: operator.task_id,
      execution_epoch: 1,
      action: "cancel_worker",
      status: "completed",
      result: {
        session_id: operator.session_id,
        physical_cancelled: true,
        prompt_cancelled: true,
        summary: "cancelled exact worker prompt",
      },
      created_at: 3,
    }
    expect(AgentCoordinationActionOutcomeFactSchema.parse(completed)).toEqual(completed)
    expect(
      AgentCoordinationActionOutcomeFactSchema.safeParse({
        ...completed,
        result: { ...completed.result, prompt_cancelled: "true" },
      }),
    ).toMatchObject({
      success: false,
      error: { issues: expect.arrayContaining([expect.objectContaining({ path: ["result", "prompt_cancelled"] })]) },
    })
    expect(
      AgentCoordinationActionOutcomeFactSchema.safeParse({
        ...completed,
        result: { ...completed.result, unverified_presentation_metadata: "must not enter the receipt" },
      }),
    ).toMatchObject({
      success: false,
      error: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ["result"], message: expect.stringContaining("Unrecognized key") }),
        ]),
      },
    })
    const completedReceipts = {
      redispatch_worker: {
        dispatch_lineage_id: Identifier.ascending("artifact"),
        dispatch_id: Identifier.ascending("artifact"),
        dispatch_session_id: Identifier.ascending("session"),
        dispatch_agent_id: "review-worker",
        work_scope: { kind: "task" },
        dispatch_bound: true,
        awaiting_explicit_dispatch: false,
      },
      ask_user: {
        question_id: "que_agent_coordination_review",
        interaction_id: Identifier.ascending("interaction"),
        interaction_status: "answered",
      },
      fail_task: {
        task_id: operator.task_id,
        task_status: "failed",
        terminal_event_id: Identifier.ascending("protocol_event"),
      },
      acknowledge_terminal: {
        terminal_lifecycle_reference: { terminalEventID: Identifier.ascending("protocol_event") },
        terminal_ingress_id: Identifier.ascending("artifact"),
      },
      cancel_worker: completed.result,
    } as const
    for (const [action, result] of Object.entries(completedReceipts)) {
      const fact = {
        ...completed,
        outcome_id: Identifier.ascending("artifact"),
        action,
        result,
      }
      expect(AgentCoordinationActionOutcomeFactSchema.safeParse(fact).success).toBe(true)
      expect(
        AgentCoordinationActionOutcomeFactSchema.safeParse({
          ...fact,
          result: { ...result, unverified_presentation_metadata: "must not enter the receipt" },
        }),
      ).toMatchObject({ success: false })
    }
    expect(
      AgentCoordinationActionOutcomeFactSchema.safeParse({
        ...completed,
        outcome_id: Identifier.ascending("artifact"),
        action: "acknowledge_terminal",
        result: {
          ...completedReceipts.acknowledge_terminal,
          terminal_lifecycle_reference: {
            ...completedReceipts.acknowledge_terminal.terminal_lifecycle_reference,
            unverified_presentation_metadata: "must not enter nested authority",
          },
        },
      }),
    ).toMatchObject({
      success: false,
      error: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: ["result", "terminal_lifecycle_reference"],
            message: expect.stringContaining("Unrecognized key"),
          }),
        ]),
      },
    })
  })

  test("retries a failed attempt by appending a new frontier without changing earlier facts", () => {
    const request = requestFact()
    const first = responseAction({ request, frontierID: request.request_id, createdAt: 2 })
    const failed: AgentCoordinationActionOutcomeFact = {
      outcome_id: Identifier.ascending("artifact"),
      request_id: request.request_id,
      response_id: first.response.response_id,
      action_id: first.action.action_id,
      task_id: request.task_id,
      execution_epoch: 1,
      action: "cancel_worker",
      status: "failed",
      error: "temporary cancellation transport failure",
      created_at: 3,
    }
    const second = responseAction({
      request,
      frontierID: failed.outcome_id,
      failedOutcomeID: failed.outcome_id,
      createdAt: 4,
    })
    const completed: AgentCoordinationActionOutcomeFact = {
      outcome_id: Identifier.ascending("artifact"),
      request_id: request.request_id,
      response_id: second.response.response_id,
      action_id: second.action.action_id,
      task_id: request.task_id,
      execution_epoch: 1,
      action: "cancel_worker",
      status: "completed",
      result: {
        session_id: request.session_id,
        physical_cancelled: true,
        prompt_cancelled: true,
        summary: "cancelled",
      },
      created_at: 5,
    }
    const immutableBefore = JSON.stringify({ request, first, failed })
    const projection = reduceAgentCoordinationFacts({
      request,
      responses: [first.response, second.response],
      actions: [first.action, second.action],
      outcomes: [failed, completed],
      currentExecutionEpoch: 1,
    })
    expect(projection).toMatchObject({
      status: "responded",
      frontierID: failed.outcome_id,
      failedAttempts: 1,
      actionStatus: "completed",
      terminalOutcome: { outcome_id: completed.outcome_id },
    })
    expect(JSON.stringify({ request, first, failed })).toBe(immutableBefore)
  })

  test("supersedes only an unterminated old-epoch action while retaining a terminal settlement", () => {
    const request = requestFact()
    const attempt = responseAction({ request, frontierID: request.request_id, createdAt: 2 })
    expect(
      reduceAgentCoordinationFacts({
        request,
        responses: [attempt.response],
        actions: [attempt.action],
        outcomes: [],
        currentExecutionEpoch: 2,
      }),
    ).toMatchObject({ status: "superseded", actionStatus: "superseded" })

    const completed: AgentCoordinationActionOutcomeFact = {
      outcome_id: Identifier.ascending("artifact"),
      request_id: request.request_id,
      response_id: attempt.response.response_id,
      action_id: attempt.action.action_id,
      task_id: request.task_id,
      execution_epoch: 1,
      action: "cancel_worker",
      status: "completed",
      result: {
        session_id: request.session_id,
        physical_cancelled: false,
        prompt_cancelled: false,
        summary: "no live prompt",
      },
      created_at: 3,
    }
    expect(
      reduceAgentCoordinationFacts({
        request,
        responses: [attempt.response],
        actions: [attempt.action],
        outcomes: [completed],
        currentExecutionEpoch: 2,
      }),
    ).toMatchObject({ status: "responded", actionStatus: "completed" })
  })
})
