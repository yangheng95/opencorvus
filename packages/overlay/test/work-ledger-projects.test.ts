import { expect, test } from "bun:test"
import {
  retireWorkLedgerProjection,
  setWorkLedgerRuntimeRows,
  workLedgerProject,
  workLedgerProjectDirectories,
  workLedgerProjects,
  type WorkLedgerChatRow,
  type WorkLedgerProjectRow,
} from "../src/services/work-ledger"

test("the accepted project projection preserves names and exact directories for same-named projects", () => {
  const north = {
    kind: "project",
    id: "project-north",
    title: "Field notes",
    directory: "C:\\Review\\North\\site-notes",
    created: 1,
    updated: 2,
    pinned: false,
  } satisfies WorkLedgerProjectRow
  const south = {
    ...north,
    id: "project-south",
    directory: "C:\\Review\\South\\site-notes",
  } satisfies WorkLedgerProjectRow
  const chat = {
    kind: "chat",
    experience: "chat",
    id: "session-north",
    sessionID: "session-north",
    title: "North review",
    directory: north.directory,
    created: 1,
    started: 1,
    updated: 2,
    pinned: false,
    status: "idle",
  } satisfies WorkLedgerChatRow

  try {
    setWorkLedgerRuntimeRows([south, chat, north])
    expect(workLedgerProjects()).toEqual([south, north])
    expect(workLedgerProjectDirectories()).toEqual([north.directory, south.directory])
    expect(workLedgerProject("c:/review/south/site-notes")).toEqual(south)
  } finally {
    retireWorkLedgerProjection()
  }
})
