import { describe, expect, test } from "bun:test"
import {
  reduceTaskRootIngressFacts,
  type TaskRootIngressFacts,
} from "@/engine/task-root-ingress-reducer"

function facts(overrides: Partial<TaskRootIngressFacts> = {}): TaskRootIngressFacts {
  return {
    ingress: { id: "ing_1", taskID: "tsk_1", executionEpoch: 1, sequence: 1, policyID: "pol_1", timeAccepted: 10 },
    policy: { id: "pol_1", semanticTurnLimit: 3, activationLimit: 4 },
    lifecycle: [{ id: "evt_open", kind: "opened", epoch: 1, time: 1 }],
    leases: [],
    turns: [],
    decisions: [],
    interactions: [],
    activityRequests: [],
    activityOutcomes: [],
    ...overrides,
  }
}

describe("Task-root fact reducer", () => {
  test("keeps prose-only Turns on the same unresolved ingress", () => {
    const input = facts({
      leases: [{ id: "act_1", targetID: "ing_1", ownerOccurrenceID: "occ_1", timeActivated: 20, expiresAt: 100 }],
      turns: [{ id: "msg_prose", activationID: "act_1", predecessorID: "ing_1", timeCompleted: 30, boundary: "final" }],
    })

    expect(reduceTaskRootIngressFacts(input, 31)).toEqual({ state: "ready" })
    expect(input.ingress.id).toBe("ing_1")
  })

  test("resolves only from one exact decision receipt", () => {
    const input = facts({
      leases: [{ id: "act_1", targetID: "ing_1", ownerOccurrenceID: "occ_1", timeActivated: 20, expiresAt: 100 }],
      turns: [{ id: "msg_decision", activationID: "act_1", predecessorID: "ing_1", timeCompleted: 30, boundary: "final" }],
      decisions: [{ id: "dec_1", assistantMessageID: "msg_decision", command: "dispatch" }],
    })

    expect(reduceTaskRootIngressFacts(input, 31)).toEqual({ state: "resolved", decisionID: "dec_1" })
  })

  test("conflict wins over an apparent decision receipt", () => {
    const input = facts({
      leases: [{ id: "act_1", targetID: "ing_1", ownerOccurrenceID: "occ_1", timeActivated: 20, expiresAt: 100 }],
      turns: [{ id: "msg_decision", activationID: "act_1", predecessorID: "ing_1", timeCompleted: 30, boundary: "final" }],
      decisions: [
        { id: "dec_1", assistantMessageID: "msg_decision", command: "dispatch" },
        { id: "dec_2", assistantMessageID: "msg_decision", command: "close" },
      ],
    })

    expect(reduceTaskRootIngressFacts(input, 31)).toEqual({ state: "blocked", reason: "integrity_conflict" })
  })

  test("does not consume an activation at an intermediate tool-call boundary", () => {
    const input = facts({
      leases: [{ id: "act_1", targetID: "ing_1", ownerOccurrenceID: "occ_1", timeActivated: 20, expiresAt: 100 }],
      turns: [{ id: "msg_tool", activationID: "act_1", predecessorID: "ing_1", timeCompleted: 30, boundary: "tool_calls" }],
      activityRequests: [{ id: "tool_1", activationID: "act_1", assistantMessageID: "msg_tool", idempotency: "stable_key" }],
      activityOutcomes: [{ id: "tool_out_1", requestID: "tool_1", outcome: "completed" }],
    })

    expect(reduceTaskRootIngressFacts(input, 31)).toEqual({
      state: "leased",
      activationID: "act_1",
      ownerOccurrenceID: "occ_1",
      expiresAt: 100,
    })
  })

  test("requires reconciliation for an unreceipted irreversible request", () => {
    const input = facts({
      leases: [{ id: "act_1", targetID: "ing_1", ownerOccurrenceID: "occ_1", timeActivated: 20, expiresAt: 40 }],
      turns: [{ id: "msg_tool", activationID: "act_1", predecessorID: "ing_1", timeCompleted: 30, boundary: "tool_calls" }],
      activityRequests: [{ id: "tool_1", activationID: "act_1", assistantMessageID: "msg_tool", idempotency: "query_required" }],
    })

    expect(reduceTaskRootIngressFacts(input, 41)).toEqual({ state: "reconcile_required", requestIDs: ["tool_1"] })
  })

  test("derives budget and lifecycle fences without blocker rows", () => {
    const semantic = facts({
      policy: { id: "pol_1", semanticTurnLimit: 1, activationLimit: 4 },
      leases: [{ id: "act_1", targetID: "ing_1", ownerOccurrenceID: "occ_1", timeActivated: 20, expiresAt: 100 }],
      turns: [{ id: "msg_prose", activationID: "act_1", predecessorID: "ing_1", timeCompleted: 30, boundary: "final" }],
    })
    const reopened = facts({
      lifecycle: [
        { id: "evt_open", kind: "opened", epoch: 1, time: 1 },
        { id: "evt_closed", kind: "closed", epoch: 1, time: 30 },
        { id: "evt_reopen", kind: "reopened", epoch: 2, time: 40 },
      ],
    })

    expect(reduceTaskRootIngressFacts(semantic, 31)).toEqual({ state: "exhausted", reason: "semantic_limit" })
    expect(reduceTaskRootIngressFacts(reopened, 41)).toEqual({ state: "terminal_inapplicable", boundary: "reopened" })
  })

  test("admits a same-epoch conversation accepted after the terminal boundary", () => {
    const postTerminalConversation = facts({
      ingress: { id: "ing_terminal_chat", taskID: "tsk_1", executionEpoch: 1, sequence: 2, policyID: "pol_1", timeAccepted: 40 },
      lifecycle: [
        { id: "evt_open", kind: "opened", epoch: 1, time: 1 },
        { id: "evt_closed", kind: "closed", epoch: 1, time: 30 },
      ],
    })
    const interruptedIngress = facts({
      lifecycle: [
        { id: "evt_open", kind: "opened", epoch: 1, time: 1 },
        { id: "evt_closed", kind: "closed", epoch: 1, time: 30 },
      ],
    })

    expect(reduceTaskRootIngressFacts(postTerminalConversation, 41)).toEqual({ state: "ready" })
    expect(reduceTaskRootIngressFacts(interruptedIngress, 31)).toEqual({ state: "terminal_inapplicable", boundary: "closed" })
  })

  test("lets lifecycle fences and the absolute deadline preempt an unresolved wait", () => {
    const interaction = {
      id: "int_wait",
      ingressID: "ing_1",
      assistantMessageID: "msg_wait",
      resumeAt: 500,
    }
    const cancelling = facts({
      lifecycle: [
        { id: "evt_open", kind: "opened", epoch: 1, time: 1 },
        { id: "evt_cancel", kind: "cancellation_requested", epoch: 1, time: 40 },
      ],
      interactions: [interaction],
    })
    const closing = facts({
      lifecycle: [
        { id: "evt_open", kind: "opened", epoch: 1, time: 1 },
        { id: "evt_close", kind: "close_requested", epoch: 1, time: 40 },
      ],
      interactions: [interaction],
    })
    const deadline = facts({
      policy: { id: "pol_1", semanticTurnLimit: 3, activationLimit: 4, absoluteDeadline: 50 },
      interactions: [interaction],
    })

    expect(reduceTaskRootIngressFacts(cancelling, 41)).toEqual({ state: "cancelling", requestEventID: "evt_cancel" })
    expect(reduceTaskRootIngressFacts(closing, 41)).toEqual({ state: "closing", requestEventID: "evt_close" })
    expect(reduceTaskRootIngressFacts(deadline, 51)).toEqual({ state: "exhausted", reason: "deadline" })
  })
})
