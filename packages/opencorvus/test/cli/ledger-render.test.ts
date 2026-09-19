import { expect, test } from "bun:test"
import type { WorkLedgerRow } from "@opencorvus-ai/transport-protocol"
import { renderLedgerRow } from "../../src/cli/cmd/ledger"

const task = {
  kind: "task",
  id: "tsk_one",
  title: "Ship the migration",
  description: "",
  directory: "C:\\repo",
  created: 1,
  started: 1,
  completed: 2,
  updated: 2,
  pinned: false,
  lifecycleStatus: "completed",
  cancellationStatus: "none",
  activityStatus: "inactive",
  priority: "normal",
  source: "api",
  productPillar: "code",
  pendingInteractions: 0,
} satisfies WorkLedgerRow

test("a Task row reports lifecycle and activity as distinct facts", () => {
  expect(renderLedgerRow(task)).toEqual(["task     tsk_one  completed/inactive  Ship the migration"])
})

test("a Task blocked on an operator decision is marked, not silently listed as running", () => {
  const blocked = { ...task, lifecycleStatus: "active", activityStatus: "running", pendingInteractions: 2 } as const
  const [line] = renderLedgerRow(blocked satisfies WorkLedgerRow)

  expect(line).toContain("active/running")
  expect(line).toContain("2 pending interaction(s)")
})

test("a cancelling Task is distinguished from a settled one", () => {
  const cancelling = { ...task, lifecycleStatus: "active", cancellationStatus: "cancelling" } as const
  expect(renderLedgerRow(cancelling satisfies WorkLedgerRow)[0]).toContain("(cancelling)")
})

test("Mission tasks render nested under their Mission rather than flattened", () => {
  const mission = {
    kind: "mission",
    id: "m1",
    missionID: "m1",
    sessionID: "ses_1",
    title: "Quarterly review",
    directory: "C:\\repo",
    created: 1,
    started: 1,
    updated: 2,
    pinned: true,
    interruptible: true,
    productPillar: "work",
    taskStats: { total: 1, running: 1, inactive: 0 },
    pendingInteractions: 1,
    tasks: [{ ...task, missionID: "m1", missionSessionID: "ses_1" }],
  } satisfies WorkLedgerRow

  const lines = renderLedgerRow(mission)

  expect(lines).toHaveLength(2)
  expect(lines[0]).toContain("📌 mission  m1")
  expect(lines[0]).toContain("1 running / 1 tasks")
  expect(lines[0]).toContain("1 pending interaction(s)")
  // The nested Task keeps its Mission's indentation so ownership stays visible.
  expect(lines[1]).toStartWith("  task     tsk_one")
})
