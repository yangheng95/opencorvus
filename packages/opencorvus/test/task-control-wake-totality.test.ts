import { describe, expect, test } from "bun:test"
import {
  CANCELLATION_RECONCILE_WAKE_MS,
  classifyTaskRootIngressWake,
  taskRootIngressWakeInstant,
  type TaskRootIngressProjection,
} from "@/engine/task-root-ingress-reducer"

const NOW = 1_000_000

/**
 * Every arm of the projection union, keyed by state so the compiler refuses a
 * new arm that this table does not cover. Wake totality is the property that
 * every one of these classifies as either a finite instant or an explicitly
 * surfaced operator gate — a state with neither is a silent permanent stall.
 */
const FIXTURES: Record<TaskRootIngressProjection["state"], readonly TaskRootIngressProjection[]> = {
  resolved: [{ state: "resolved", decisionIDs: ["decision-1"] }],
  terminal_inapplicable: [
    { state: "terminal_inapplicable", boundary: "cancelled" },
    { state: "terminal_inapplicable", boundary: "closed" },
    { state: "terminal_inapplicable", boundary: "reopened" },
    { state: "terminal_inapplicable", boundary: "deleted" },
  ],
  leased: [{ state: "leased", activationID: "act-1", ownerOccurrenceID: "owner-1", expiresAt: NOW + 120_000 }],
  waiting: [
    { state: "waiting", interactionID: "int-1", resumeAt: NOW + 5_000 },
    { state: "waiting", interactionID: "int-2" },
  ],
  cancelling: [{ state: "cancelling", requestEventID: "evt-1" }],
  closing: [{ state: "closing", requestEventID: "evt-2" }],
  reconcile_required: [{ state: "reconcile_required", requestIDs: ["req-1"] }],
  blocked: [{ state: "blocked", reason: "integrity_conflict" }],
  exhausted: [
    { state: "exhausted", reason: "semantic_limit" },
    { state: "exhausted", reason: "activation_limit" },
    { state: "exhausted", reason: "deadline" },
  ],
  ready: [{ state: "ready" }],
}

describe("Task-root ingress wake classification", () => {
  test("classifies every projection arm as a finite wake, an absorbing state or a surfaced gate", () => {
    const classified = Object.values(FIXTURES)
      .flat()
      .map((projection) => {
        const classification = classifyTaskRootIngressWake(projection, undefined, NOW)
        return classification.class === "finite_wake"
          ? `${projection.state}:finite(+${classification.wakeAt - NOW})`
          : classification.class === "operator_gated"
            ? `${projection.state}:gated(${classification.surface})`
            : `${projection.state}:${classification.class}`
      })
    expect(classified).toEqual([
      "resolved:absorbing",
      "terminal_inapplicable:absorbing",
      "terminal_inapplicable:absorbing",
      "terminal_inapplicable:absorbing",
      "terminal_inapplicable:absorbing",
      "leased:finite(+120000)",
      "waiting:finite(+5000)",
      "waiting:gated(interaction)",
      `cancelling:finite(+${CANCELLATION_RECONCILE_WAKE_MS})`,
      `closing:finite(+${CANCELLATION_RECONCILE_WAKE_MS})`,
      "reconcile_required:gated(interaction)",
      "blocked:gated(infrastructure_fact)",
      "exhausted:gated(infrastructure_fact)",
      "exhausted:gated(infrastructure_fact)",
      "exhausted:gated(infrastructure_fact)",
      "ready:fifo_deferred",
    ])
  })

  test("no non-absorbing arm rests without either a wake or a durable surface", () => {
    const silent = Object.values(FIXTURES)
      .flat()
      .filter((projection) => classifyTaskRootIngressWake(projection, undefined, NOW).class === "fifo_deferred")
      .map((projection) => projection.state)
    // `ready` is the sole FIFO-owned arm: the scan activates it in the same
    // pass, so it owes no timer. Every other arm must be finite or surfaced.
    expect(silent).toEqual(["ready"])
  })

  test("an absolute deadline paces the states a clock can still change", () => {
    const deadline = NOW + 1_000
    const paced = Object.values(FIXTURES)
      .flat()
      .map((projection) => {
        const classification = classifyTaskRootIngressWake(projection, deadline, NOW)
        return `${projection.state}:${classification.class === "finite_wake" ? classification.wakeAt - NOW : classification.class}`
      })
    expect(paced).toEqual([
      // Absorbing states cannot be changed by a deadline.
      "resolved:absorbing",
      "terminal_inapplicable:absorbing",
      "terminal_inapplicable:absorbing",
      "terminal_inapplicable:absorbing",
      "terminal_inapplicable:absorbing",
      // The deadline is earlier than the lease expiry, so it wins.
      "leased:1000",
      "waiting:1000",
      "waiting:1000",
      "cancelling:1000",
      "closing:1000",
      "reconcile_required:1000",
      // Blocked and exhausted are absorbing under the reduction: a deadline
      // would only re-derive the same value, so the surfaced gate stays the
      // only exit.
      "blocked:operator_gated",
      "exhausted:operator_gated",
      "exhausted:operator_gated",
      "exhausted:operator_gated",
      "ready:1000",
    ])
  })

  test("the wake-instant projection keeps reporting only finite instants", () => {
    expect({
      leased: taskRootIngressWakeInstant(
        { state: "leased", activationID: "a", ownerOccurrenceID: "o", expiresAt: NOW + 42 },
        undefined,
        NOW,
      ),
      waitingOpen: taskRootIngressWakeInstant({ state: "waiting", interactionID: "i" }, undefined, NOW),
      blocked: taskRootIngressWakeInstant({ state: "blocked", reason: "integrity_conflict" }, undefined, NOW),
      cancelling: taskRootIngressWakeInstant({ state: "cancelling", requestEventID: "e" }, undefined, NOW),
    }).toEqual({
      leased: NOW + 42,
      waitingOpen: undefined,
      blocked: undefined,
      cancelling: NOW + CANCELLATION_RECONCILE_WAKE_MS,
    })
  })
})
