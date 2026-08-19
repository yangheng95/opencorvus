import { expect, test } from "bun:test"
import type { AgentActivityRecord } from "../src/utils/agent-activity"
import { buildSubagentConversationItems, subagentSessionRecords } from "../src/utils/subagent-presentation"

function pad(value: number): string {
  return String(value).padStart(16, "0")
}

function record(input: {
  sessionID: string
  occurrence: string
  startedAt: number
  lastObservedAt: number
  status?: AgentActivityRecord["status"]
}): AgentActivityRecord {
  return {
    id: input.occurrence,
    inputMessageID: input.occurrence,
    sessionID: input.sessionID,
    parentSessionID: "ses_orchestrator",
    agentID: "test-engineer",
    stage: "delegated-worker",
    status: input.status ?? "completed",
    orderKey: `v1:${pad(input.startedAt)}:${pad(50)}:${pad(0)}:session:${input.sessionID}`,
    startedAt: input.startedAt,
    lastObservedAt: input.lastObservedAt,
    attempts: 1,
    depth: 0,
    activity: [],
    todos: [],
    todoUpdatedAt: 0,
  }
}

/**
 * A Session that ran more than once carries one activity record per execution
 * occurrence. Every sub-agent surface addresses one agent per Session, so the
 * repeated occurrences must collapse to the newest one.
 */
test("a Session that ran twice contributes one record, its newest occurrence", () => {
  const records = [
    record({ sessionID: "ses_a", occurrence: "run-1", startedAt: 1_000, lastObservedAt: 2_000, status: "error" }),
    record({ sessionID: "ses_b", occurrence: "run-1", startedAt: 1_500, lastObservedAt: 2_500 }),
    record({ sessionID: "ses_a", occurrence: "run-2", startedAt: 3_000, lastObservedAt: 4_000, status: "completed" }),
  ]

  expect(
    subagentSessionRecords(records).map((entry) => ({
      sessionID: entry.sessionID,
      occurrence: entry.id,
      status: entry.status,
    })),
  ).toEqual([
    { sessionID: "ses_a", occurrence: "run-2", status: "completed" },
    { sessionID: "ses_b", occurrence: "run-1", status: "completed" },
  ])
})

/** Ties on the last observation fall to the occurrence that started later. */
test("occurrences observed at the same moment resolve to the later start", () => {
  const records = [
    record({ sessionID: "ses_a", occurrence: "early", startedAt: 1_000, lastObservedAt: 5_000 }),
    record({ sessionID: "ses_a", occurrence: "late", startedAt: 2_000, lastObservedAt: 5_000 }),
  ]

  expect(subagentSessionRecords(records).map((entry) => entry.id)).toEqual(["late"])
})

/** Ordering follows each Session's first appearance, so a later occurrence
 *  arriving does not reshuffle the surfaces that are keyed by Session. */
test("Session order follows first appearance, not the newest occurrence", () => {
  const records = [
    record({ sessionID: "ses_first", occurrence: "run-1", startedAt: 1_000, lastObservedAt: 1_000 }),
    record({ sessionID: "ses_second", occurrence: "run-1", startedAt: 2_000, lastObservedAt: 2_000 }),
    record({ sessionID: "ses_first", occurrence: "run-2", startedAt: 9_000, lastObservedAt: 9_000 }),
  ]

  expect(subagentSessionRecords(records).map((entry) => entry.sessionID)).toEqual(["ses_first", "ses_second"])
})

/** The progress grid is keyed by Session too, so a repeated Session must take
 *  one tile rather than one per occurrence. */
test("the progress grid lists a repeated Session once", () => {
  const records = [
    record({ sessionID: "ses_a", occurrence: "run-1", startedAt: 1_000, lastObservedAt: 2_000 }),
    record({ sessionID: "ses_a", occurrence: "run-2", startedAt: 3_000, lastObservedAt: 4_000 }),
    record({ sessionID: "ses_b", occurrence: "run-1", startedAt: 5_000, lastObservedAt: 6_000 }),
  ]

  const items = buildSubagentConversationItems({ order: [], cards: {}, records })

  expect(items).toEqual([
    {
      id: "subagent-grid:ses_a",
      kind: "subagent-grid",
      sessionIDs: ["ses_a", "ses_b"],
    },
  ])
})
