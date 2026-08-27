import { createSignal } from "solid-js"
import {
  advanceSseActiveElapsed,
  pauseSseActiveElapsed,
  type SseActiveElapsedState,
} from "../utils/sse-active-elapsed"

const [activityRevision, setActivityRevision] = createSignal(0)
const elapsedByKey = new Map<string, SseActiveElapsedState>()

export function taskRuntimeActivityKey(input: { taskID: string; startedAt: number }): string {
  const taskID = input.taskID.trim()
  if (!taskID) return ""
  if (!Number.isFinite(input.startedAt) || input.startedAt <= 0) {
    throw new Error(`task ${taskID} runtime activity requires a positive task.time.started timestamp`)
  }
  return `${taskID}:${input.startedAt}`
}

function eventProperties(event: any): Record<string, any> {
  const properties = event?.properties
  if (properties && typeof properties === "object" && !Array.isArray(properties)) return properties
  const payload = event?.payload
  if (payload && typeof payload === "object" && !Array.isArray(payload)) return payload
  return {}
}

function eventTaskID(event: any): string {
  const properties = eventProperties(event)
  return String(event?.taskID || event?.task_id || properties.taskID || properties.task_id || "")
}

export function selectedTaskSseActivityAt(event: any): number {
  const type = String(event?.type || "")
  const emittedAt = Number(event?.emittedAt || event?.emitted_at || event?.timestamp || 0)
  if (Number.isFinite(emittedAt) && emittedAt > 0) return emittedAt
  throw new Error(`selected-task SSE event ${type || "<unknown>"} missing positive emittedAt/timestamp`)
}

export function selectedTaskSseLifecycleStatus(event: any): string {
  const properties = eventProperties(event)
  const status = properties.status
  if (typeof status === "string" && status) return status
  const type = String(event?.type || "")
  if (type === "task.completed") return "completed"
  if (type === "task.failed") return "failed"
  if (type === "task.cancelled") return "cancelled"
  return ""
}

export function recordSelectedTaskSseActivity(input: {
  activityAt: number
  active: boolean
  key: string
  startedAt: number
}): void {
  if (!input.key) return
  const previous = elapsedByKey.get(input.key) ?? { key: input.key, elapsedMs: 0 }
  const next = advanceSseActiveElapsed(previous, input)
  elapsedByKey.set(input.key, next)
  if (next.elapsedMs !== previous.elapsedMs || next.observedAt !== previous.observedAt) {
    setActivityRevision((revision) => revision + 1)
  }
}

export function recordSelectedTaskSseEventActivity(input: {
  active: boolean
  event: any
  task: any
  taskID: string
}): void {
  const taskID = String(input.taskID || "")
  if (!taskID || String(input.task?.id || "") !== taskID) return
  if (eventTaskID(input.event) && eventTaskID(input.event) !== taskID) return
  const startedAt = Number(input.task?.time?.started)
  if ((!Number.isFinite(startedAt) || startedAt <= 0) && !input.active) return
  recordSelectedTaskSseActivity({
    key: taskRuntimeActivityKey({ taskID, startedAt }),
    active: input.active,
    startedAt,
    activityAt: selectedTaskSseActivityAt(input.event),
  })
}

export function recordSelectedTaskSseSnapshot(input: {
  active: boolean
  activityAt: number
  task: any
  taskID: string
}): void {
  const taskID = String(input.taskID || "")
  if (!taskID || String(input.task?.id || "") !== taskID) return
  if (!input.active) return
  if (!Number.isFinite(input.activityAt) || input.activityAt <= 0) return
  const startedAt = Number(input.task?.time?.started)
  recordSelectedTaskSseActivity({
    key: taskRuntimeActivityKey({ taskID, startedAt }),
    active: true,
    startedAt,
    activityAt: input.activityAt,
  })
}

export function pauseSelectedTaskSseActivity(key: string): void {
  if (!key) return
  const previous = elapsedByKey.get(key) ?? { key, elapsedMs: 0 }
  const next = pauseSseActiveElapsed(previous, key)
  elapsedByKey.set(key, next)
  if (next.observedAt !== previous.observedAt) {
    setActivityRevision((revision) => revision + 1)
  }
}

export function selectedTaskSseActiveElapsedMs(key: string): number {
  activityRevision()
  if (!key) return 0
  return elapsedByKey.get(key)?.elapsedMs ?? 0
}

export function __resetSelectedTaskSseActivityForTest(): void {
  elapsedByKey.clear()
  setActivityRevision((revision) => revision + 1)
}
