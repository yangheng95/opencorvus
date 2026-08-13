// ── TaskStatusHeader ──
// Replaces the previous imperative createEffects in main.tsx that toggled
// `#taskStatus[hidden]`, wrote `#statusIcon.innerHTML`, set `#statusLabel`'s
// textContent, and ticked `#taskElapsed` every second via getElementById.
// The whole block is now driven by Solid signals: a single reactive subtree
// that updates only the affected text/attribute when boardStore changes.

import { createEffect, createMemo, Show } from "solid-js"
import { boardStore } from "../store/board"
import { formatDuration } from "../utils/time"
import { AppLog } from "../utils/log"
import { selectedTaskSseActiveElapsedMs, taskRuntimeActivityKey } from "../services/task-runtime-activity"
import {
  workLedgerPresentationLabel,
  workLedgerPresentationStatus,
  workLedgerSessionExecution,
  workLedgerStatusVisible,
  workLedgerTaskExecution,
} from "../services/work-ledger"

const ACTIVE_STATUS = "active"
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

export function TaskStatusHeader() {
  let loggedRuntimeTimeError = ""
  const execution = createMemo(() => {
    const source = boardStore.selectedSource
    if (!source) return null
    return source.kind === "task" ? workLedgerTaskExecution(source.id) : workLedgerSessionExecution(source.id)
  })
  const task = createMemo(() => {
    const current = execution()
    return current?.kind === "task" ? current : null
  })
  const status = createMemo(() => {
    const current = execution()
    return current ? workLedgerPresentationStatus(current) : ""
  })
  const startedTime = createMemo<number>(() => {
    return Number(task()?.started || 0)
  })
  const completedTime = createMemo<number>(() => task()?.completed || 0)
  const isActive = createMemo(() => status() === ACTIVE_STATUS)
  const lifecycleStatus = createMemo(() => {
    const current = execution()
    return current?.kind === "task" ? current.lifecycleStatus : ""
  })
  const visible = createMemo(() => Boolean(execution()) && workLedgerStatusVisible(status()))
  const timedTaskVisible = createMemo(() => execution()?.kind === "task")
  const elapsedKey = createMemo(() => {
    const taskID = String(task()?.id || "")
    if (!taskID || !startedTime()) return ""
    return taskRuntimeActivityKey({ taskID, startedAt: startedTime() })
  })
  const missingStartedTime = createMemo(() => {
    const taskID = String(task()?.id || "")
    return Boolean(
      visible() && taskID && (isActive() || TERMINAL_STATUSES.has(lifecycleStatus())) && !(startedTime() > 0),
    )
  })
  const missingCompletionTime = createMemo(() => {
    const taskID = String(task()?.id || "")
    return Boolean(
      visible() &&
        taskID &&
        startedTime() > 0 &&
        TERMINAL_STATUSES.has(lifecycleStatus()) &&
        !(completedTime() > 0),
    )
  })
  const invalidCompletionTime = createMemo(() => {
    const taskID = String(task()?.id || "")
    return Boolean(
      visible() &&
        taskID &&
        startedTime() > 0 &&
        TERMINAL_STATUSES.has(lifecycleStatus()) &&
        completedTime() > 0 &&
        completedTime() < startedTime(),
    )
  })
  const runtimeTimeError = createMemo(() => {
    if (missingStartedTime()) return "missing start time"
    if (missingCompletionTime()) return "missing completion time"
    if (invalidCompletionTime()) return "invalid completion time"
    return ""
  })

  const elapsedText = createMemo(() => {
    const start = startedTime()
    if (!timedTaskVisible()) return ""
    const timeError = runtimeTimeError()
    if (timeError) return timeError
    if (isActive()) return formatDuration(selectedTaskSseActiveElapsedMs(elapsedKey()))
    if (TERMINAL_STATUSES.has(lifecycleStatus())) return formatDuration(completedTime() - start)
    return ""
  })

  createEffect(() => {
    const timeError = runtimeTimeError()
    if (!timeError) {
      loggedRuntimeTimeError = ""
      return
    }
    const taskID = String(task()?.id || "")
    const key = `${taskID}:${status()}:${startedTime()}:${completedTime()}:${timeError}`
    if (loggedRuntimeTimeError === key) return
    loggedRuntimeTimeError = key
    AppLog.error("ui", `Task status ${timeError}`, {
      taskID,
      status: status(),
      lifecycleStatus: lifecycleStatus(),
      startedAt: startedTime() || undefined,
      completedAt: completedTime() || undefined,
      diagnosticID: `task-status:${timeError.replace(/\s+/g, "-")}:${taskID}`,
      diagnosticTitle: "Task status timestamp invalid",
      diagnosticMessage: `Task ${taskID} has an invalid runtime timestamp.`,
      diagnosticDetails:
        timeError === "missing start time"
          ? `work-ledger task started is required for task lifecycle ${lifecycleStatus() || status()}.`
          : timeError === "missing completion time"
            ? `work-ledger task completed is required for terminal task lifecycle ${lifecycleStatus()}.`
            : `work-ledger task completed must not precede started for terminal task lifecycle ${lifecycleStatus()}.`,
    })
  })

  const labelText = createMemo(() => {
    const current = execution()
    return current ? workLedgerPresentationLabel(current) : ""
  })
  const statusTitle = createMemo(() => [labelText(), elapsedText()].filter(Boolean).join(" · "))

  return (
    <Show when={visible()}>
      <div class="task-status chat-task-status" id="taskStatus" title={statusTitle()} aria-label={statusTitle()}>
        <span class="status-copy">
          <span class="status-label" id="statusLabel">
            {labelText()}
          </span>
          <span class="elapsed" id="taskElapsed">
            {elapsedText()}
          </span>
        </span>
      </div>
    </Show>
  )
}
