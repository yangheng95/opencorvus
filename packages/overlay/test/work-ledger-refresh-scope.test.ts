import { expect, test } from "bun:test"
import { workLedgerRefreshScope } from "../src/services/work-ledger"

const selected = { kind: "session", id: "ses_selected" } as const

test("a selected Session update refreshes both its exact reader and the global list", () => {
  expect(workLedgerRefreshScope({ sessionID: selected.id }, selected)).toBe("list-and-selection")
})

test("a different Session update belongs to the global list", () => {
  const change = { sessionID: "ses_different" }
  expect(workLedgerRefreshScope(change, selected)).toBe("list")
  expect(workLedgerRefreshScope(change, { kind: "task", id: "task_selected" })).toBe("list")
})

test("Task events can refresh a selected Mission and its child projections", () => {
  expect(workLedgerRefreshScope({
    taskID: "task_child",
    sessionID: "ses_task_root",
  }, selected)).toBe("list-and-selection")
})

test("connection and project notifications refresh the selected and global projections", () => {
  expect(workLedgerRefreshScope(undefined, selected)).toBe("list-and-selection")
  expect(workLedgerRefreshScope({}, selected)).toBe("list-and-selection")
})
