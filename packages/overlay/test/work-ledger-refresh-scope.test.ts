import { expect, test } from "bun:test"
import { workLedgerRefreshScope } from "../src/services/work-ledger"

const selected = { kind: "session", id: "ses_selected" } as const

test("a selected Mission Session update refreshes its exact reader and the Mission board", () => {
  expect(workLedgerRefreshScope({ sessionID: selected.id }, selected)).toEqual({ selection: true, missionBoard: true })
})

test("identified sidebar conversations refresh the exact selected conversation", () => {
  for (const experience of ["chat", "work"] as const) {
    const change = { sessionID: selected.id, conversationExperience: experience }
    expect(workLedgerRefreshScope(change, selected)).toEqual({ selection: true, missionBoard: false })
  }
})

test("a peer Mission Session update refreshes the global Mission board", () => {
  expect(workLedgerRefreshScope({ sessionID: "ses_peer" }, selected)).toEqual({
    selection: false, missionBoard: true,
  })
})

test("Task events can refresh a selected Mission and its child projections", () => {
  expect(workLedgerRefreshScope({
    taskID: "task_child",
    sessionID: "ses_task_root",
  }, selected)).toEqual({ selection: true, missionBoard: true })
})

test("connection and project notifications refresh the selected and global projections", () => {
  expect(workLedgerRefreshScope(undefined, selected)).toEqual({ selection: true, missionBoard: true })
  expect(workLedgerRefreshScope({}, selected)).toEqual({ selection: true, missionBoard: true })
  expect(workLedgerRefreshScope(undefined, null)).toEqual({ selection: false, missionBoard: true })
})
