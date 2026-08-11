import { beforeEach, expect, test } from "bun:test"
import { classifyPanelMessageTarget } from "../src/services/chat"
import { applyTasks, setBoardStore, setOrphanedSelectionHandler } from "../src/store/board"

beforeEach(() => {
  setBoardStore("board", null as any)
  setBoardStore("tasks", [])
  setBoardStore("pendingTasks", [])
  setBoardStore("selectedSource", null)
  setBoardStore("taskSwitching", false)
  setOrphanedSelectionHandler(null)
})

test("applyTasks clears orphaned selection even when board is missing", () => {
  let orphaned = 0
  setOrphanedSelectionHandler(() => {
    orphaned += 1
  })
  setBoardStore("selectedSource", { kind: "task", id: "tsk_orphaned" })
  setBoardStore("board", null as any)

  applyTasks([])

  expect(orphaned).toBe(1)
})

test("applyTasks does not clear selection during an in-flight task switch", () => {
  let orphaned = 0
  setOrphanedSelectionHandler(() => {
    orphaned += 1
  })
  setBoardStore("selectedSource", { kind: "task", id: "tsk_loading" })
  setBoardStore("taskSwitching", true)

  applyTasks([])

  expect(orphaned).toBe(0)
})

test("classifyPanelMessageTarget treats stale selected task as orphan", () => {
  expect(
    classifyPanelMessageTarget({
      selectedTaskID: "tsk_missing",
      boardTaskID: "",
      tasks: [],
    }),
  ).toBe("orphan")
})

test("classifyPanelMessageTarget forces reload when task exists but board is stale", () => {
  expect(
    classifyPanelMessageTarget({
      selectedTaskID: "tsk_live",
      boardTaskID: "",
      tasks: [{ task: { id: "tsk_live" } }],
    }),
  ).toBe("reload")
})

test("classifyPanelMessageTarget sends directly when board already matches", () => {
  expect(
    classifyPanelMessageTarget({
      selectedTaskID: "tsk_live",
      boardTaskID: "tsk_live",
      tasks: [],
    }),
  ).toBe("task")
})
