import { beforeEach, expect, test } from "bun:test"
import { classifyPanelMessageTarget } from "../src/services/chat"
import { applyTasks, boardStore, setBoardStore, setOrphanedSelectionHandler } from "../src/store/board"
import { supersedePendingWorkspaceSelection } from "../src/services/workspace"

beforeEach(() => {
  globalThis.requestAnimationFrame = (callback) => {
    callback(0)
    return 1
  }
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

test("supersedePendingWorkspaceSelection clears a partial selection and transfers epoch ownership", () => {
  setBoardStore("selectEpoch", 4)
  setBoardStore("selectedSource", { kind: "task", id: "tsk_loading" })
  setBoardStore("board", { task: { id: "tsk_loading" } } as any)
  setBoardStore("taskSwitching", true)

  const epoch = supersedePendingWorkspaceSelection()

  expect({
    epoch,
    selectedSource: boardStore.selectedSource,
    board: boardStore.board,
    taskSwitching: boardStore.taskSwitching,
  }).toEqual({
    epoch: 5,
    selectedSource: null,
    board: null,
    taskSwitching: false,
  })
})

test("supersedePendingWorkspaceSelection preserves a stable selection under the new epoch", () => {
  setBoardStore("selectEpoch", 7)
  setBoardStore("selectedSource", { kind: "task", id: "tsk_stable" })
  setBoardStore("board", { task: { id: "tsk_stable" } } as any)
  setBoardStore("taskSwitching", false)

  const epoch = supersedePendingWorkspaceSelection()

  expect({
    epoch,
    selectedSource: boardStore.selectedSource,
    boardTaskID: boardStore.board?.task?.id,
    taskSwitching: boardStore.taskSwitching,
  }).toEqual({
    epoch: 8,
    selectedSource: { kind: "task", id: "tsk_stable" },
    boardTaskID: "tsk_stable",
    taskSwitching: false,
  })
})
