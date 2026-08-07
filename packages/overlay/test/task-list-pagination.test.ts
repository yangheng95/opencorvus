import { afterEach, expect, test } from "bun:test"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"

const { __setHostTransportForTest } = await import("../src/services/host-transport-runtime")
const { boardStore, loadMoreTasks, loadTasks, setBoardStore, setTasksData, TASK_LIST_PAGE_SIZE } = await import(
  "../src/store/board"
)

function taskItem(index: number): any {
  const created = 10_000 + index
  const updated = 20_000 - index
  return {
    task: {
      id: `tsk_${String(index).padStart(2, "0")}`,
      requestID: `req_${index}`,
      title: `Task ${index}`,
      request: `Task ${index}`,
      status: "queued",
      time: {
        created,
        updated,
      },
    },
  }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  setBoardStore({
    tasks: [],
    pendingTasks: [],
    tasksHasMore: false,
    tasksLoadedLimit: 0,
    tasksCursorUpdated: null,
    tasksCursorTaskID: "",
    tasksLoadingMore: false,
    tasksError: "",
    tasksLoaded: false,
  })
})

test("loadTasks fetches one sentinel row and keeps only the first ten task records", async () => {
  const requests: TransportRequest[] = []
  const firstPage = Array.from({ length: TASK_LIST_PAGE_SIZE + 1 }, (_, index) => taskItem(index))
  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      return { status: 200, ok: true, headers: {}, body: { tasks: firstPage } as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } satisfies HostTransport)

  await loadTasks()

  expect(requests).toHaveLength(1)
  expect(requests[0].path).toBe("global/tasks")
  expect(String(requests[0].query?.limit)).toBe(String(TASK_LIST_PAGE_SIZE + 1))
  expect(boardStore.tasks).toHaveLength(TASK_LIST_PAGE_SIZE)
  expect(boardStore.tasksHasMore).toBe(true)
  expect(boardStore.tasksCursorTaskID).toBe("tsk_09")
})

test("loadMoreTasks fetches the next page from the database using the last visible task cursor", async () => {
  const requests: TransportRequest[] = []
  const firstPage = Array.from({ length: TASK_LIST_PAGE_SIZE + 1 }, (_, index) => taskItem(index))
  const secondPage = [taskItem(10), taskItem(11), taskItem(12)]
  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      const body = requests.length === 1 ? { tasks: firstPage } : { tasks: secondPage }
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } satisfies HostTransport)

  await loadTasks()
  await loadMoreTasks()

  expect(requests).toHaveLength(2)
  expect(requests[1].path).toBe("global/tasks")
  expect(String(requests[1].query?.limit)).toBe(String(TASK_LIST_PAGE_SIZE + 1))
  expect(String(requests[1].query?.cursor)).toBe(String(firstPage[9].task.time.updated))
  expect(requests[1].query?.cursorTaskID).toBe(firstPage[9].task.id)
  expect(boardStore.tasks.map((item: any) => item.task.id)).toEqual([
    ...firstPage.slice(0, TASK_LIST_PAGE_SIZE).map((item) => item.task.id),
    ...secondPage.map((item) => item.task.id),
  ])
  expect(boardStore.tasksHasMore).toBe(false)
})

test("pagination follows updated-time order across every page without duplicates or omissions", async () => {
  const requests: TransportRequest[] = []
  const allTasks = Array.from({ length: TASK_LIST_PAGE_SIZE * 2 + 3 }, (_, index) => taskItem(index))
  allTasks[9].task.time.updated = allTasks[10].task.time.updated
  allTasks.sort((a, b) => {
    const updatedDelta = b.task.time.updated - a.task.time.updated
    return updatedDelta || (a.task.id === b.task.id ? 0 : a.task.id < b.task.id ? 1 : -1)
  })

  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      const cursor = req.query?.cursor === undefined ? undefined : Number(req.query.cursor)
      const cursorTaskID = req.query?.cursorTaskID === undefined ? undefined : String(req.query.cursorTaskID)
      const page = allTasks
        .filter(
          (item) =>
            cursor === undefined ||
            item.task.time.updated < cursor ||
            (item.task.time.updated === cursor && item.task.id < cursorTaskID!),
        )
        .slice(0, TASK_LIST_PAGE_SIZE + 1)
      return { status: 200, ok: true, headers: {}, body: { tasks: page } as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } satisfies HostTransport)

  await loadTasks()
  while (boardStore.tasksHasMore) await loadMoreTasks()

  const loadedIDs = boardStore.tasks.map((item: any) => item.task.id)
  expect(requests).toHaveLength(3)
  expect(loadedIDs).toEqual(allTasks.map((item) => item.task.id))
  expect(new Set(loadedIDs).size).toBe(allTasks.length)
  expect(boardStore.tasksCursorUpdated).toBe(allTasks.at(-1)!.task.time.updated)
  expect(boardStore.tasksCursorTaskID).toBe(allTasks.at(-1)!.task.id)
})

test("loadTasks refresh stays first-page sized after older pages were appended", async () => {
  const requests: TransportRequest[] = []
  const firstPage = Array.from({ length: TASK_LIST_PAGE_SIZE + 1 }, (_, index) => taskItem(index))
  const secondPage = [taskItem(10), taskItem(11), taskItem(12)]
  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      const body = requests.length === 2 ? { tasks: secondPage } : { tasks: firstPage }
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } satisfies HostTransport)

  await loadTasks()
  await loadMoreTasks()
  expect(boardStore.tasks).toHaveLength(TASK_LIST_PAGE_SIZE + secondPage.length)

  await loadTasks()

  expect(requests).toHaveLength(3)
  expect(requests[2].path).toBe("global/tasks")
  expect(String(requests[2].query?.limit)).toBe(String(TASK_LIST_PAGE_SIZE + 1))
  expect(requests[2].query?.cursor).toBeUndefined()
  expect(requests[2].query?.cursorTaskID).toBeUndefined()
  expect(boardStore.tasks.map((item: any) => item.task.id)).toEqual(
    firstPage.slice(0, TASK_LIST_PAGE_SIZE).map((item) => item.task.id),
  )
})

test("local task list updates do not prevent an in-flight first-page load from completing", async () => {
  let releaseFirst!: () => void
  const firstPending = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const requests: TransportRequest[] = []
  const firstPage = [taskItem(1), taskItem(2)]
  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      await firstPending
      return { status: 200, ok: true, headers: {}, body: { tasks: firstPage } as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } satisfies HostTransport)

  const loading = loadTasks()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(requests).toHaveLength(1)

  setTasksData([taskItem(99)])
  expect(boardStore.tasks.map((item: any) => item.task.id)).toEqual(["tsk_99"])
  expect(boardStore.tasksLoaded).toBe(false)

  releaseFirst()
  await loading

  expect(boardStore.tasks.map((item: any) => item.task.id)).toEqual(["tsk_01", "tsk_02"])
  expect(boardStore.tasksLoaded).toBe(true)
  expect(boardStore.tasksError).toBe("")
})
