import { mkdirSync, appendFileSync } from "fs"
import { dirname } from "path"
import { requireTask } from "@/engine/store"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Log } from "@/util/log"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"

/**
 * Accumulated event logger.
 *
 * Instead of recording every streaming delta, accumulates tool calls and
 * flushes on stage / turn boundaries. Two files per task:
 *   .timeline.log  — human-readable progress timeline
 *   .events.ndjson  — machine-readable accumulated events (no deltas)
 */

const LOGGED_TYPES = new Set([
  "task.created",
  "task.updated",
  "task.cancellation.requested",
  "task.completed",
  "task.failed",
  "task.cancelled",
  "interaction.requested",
  "interaction.resolved",
  "task.infrastructure.failed",
  "agent.coordination.requested",
  "agent.coordination.responded",
  "agent.coordination.action",
  "agent.coordination.cancelled",
  "agent.execution.lifecycle",
  "session.error",
  "session.bridge.persist_failed",
])

// ---------------------------------------------------------------------------

type ToolBucket = { count: number; firstAt: number; lastAt: number }

type StageAcc = {
  stage: string
  startAt: number
  tools: Map<string, ToolBucket>
  toolOrder: string[]
}

type TurnAcc = {
  num: number
  startAt: number
  tools: Map<string, number>
  toolOrder: string[]
}

type TaskCtx = {
  ndjson: string
  timeline: string
  t0: number
  stage: StageAcc | null
  turn: TurnAcc | null
  turnSeq: number
}

// ---------------------------------------------------------------------------

export namespace EngineEventLog {
  const log = Log.create({ service: "engine.event-log" })
  const tasks = new Map<string, TaskCtx>()
  let stopProtocolSubscription: (() => void) | undefined

  // -- I/O helpers --

  export function eventLogPathsForTask(taskID: string) {
    const task = requireTask(taskID)
    const project = Project.get(task.project_id)
    if (!project) throw new Error(`Project not found for task ${taskID}: ${task.project_id}`)
    return ProjectRuntimePaths.eventLogPath(project.worktree, taskID)
  }

  export function appendPhysicalDeleteBreadcrumb(
    taskID: string,
    input: {
      origin: string
      projectID: string
      sessionID?: string
      status: string
      detail?: Record<string, unknown>
    },
  ) {
    const paths = eventLogPathsForTask(taskID)
    mkdirSync(dirname(paths.ndjson), { recursive: true })
    const now = new Date().toISOString()
    const sessionPart = input.sessionID ? ` session=${input.sessionID}` : ""
    appendFileSync(
      paths.timeline,
      `[delete] TASK physical_delete_pending task=${taskID} origin=${input.origin} status=${input.status}${sessionPart}\n`,
      "utf-8",
    )
    appendFileSync(
      paths.ndjson,
      JSON.stringify({
        at: now,
        type: "task.physical_delete_pending",
        taskID,
        origin: input.origin,
        projectID: input.projectID,
        sessionID: input.sessionID ?? null,
        status: input.status,
        detail: input.detail ?? {},
      }) + "\n",
      "utf-8",
    )
  }

  function elapsed(ctx: TaskCtx) {
    const ms = Date.now() - ctx.t0
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`
  }

  function tl(ctx: TaskCtx, line: string) {
    try {
      appendFileSync(ctx.timeline, line + "\n", "utf-8")
    } catch (err) {
      log.warn("timeline append failed", { path: ctx.timeline, error: String(err) })
    }
  }

  function nd(ctx: TaskCtx, entry: Record<string, unknown>) {
    try {
      appendFileSync(ctx.ndjson, JSON.stringify(entry) + "\n", "utf-8")
    } catch (err) {
      log.warn("ndjson append failed", { path: ctx.ndjson, error: String(err) })
    }
  }

  function clip(s: string, max = 120) {
    return s.length <= max ? s : s.slice(0, max - 3) + "..."
  }

  // -- Flush accumulators --

  function flushStage(ctx: TaskCtx) {
    const acc = ctx.stage
    if (!acc || acc.tools.size === 0) return
    for (const name of acc.toolOrder) {
      const b = acc.tools.get(name)!
      const dur = ((b.lastAt - b.firstAt) / 1000).toFixed(1)
      tl(ctx, `[${elapsed(ctx)}]   ${name} ×${b.count}  (${dur}s)`)
      nd(ctx, {
        at: new Date().toISOString(),
        elapsed_ms: Date.now() - ctx.t0,
        type: "agent.tool_calls",
        stage: acc.stage,
        tool: name,
        count: b.count,
        duration_ms: b.lastAt - b.firstAt,
      })
    }
  }

  function flushTurn(ctx: TaskCtx) {
    const t = ctx.turn
    if (!t || t.toolOrder.length === 0) {
      ctx.turn = null
      return
    }
    const parts = t.toolOrder.map((n) => {
      const c = t.tools.get(n)!
      return c > 1 ? `${n} ×${c}` : n
    })
    const dur = ((Date.now() - t.startAt) / 1000).toFixed(1)
    tl(ctx, `[${elapsed(ctx)}]   Turn ${t.num}: ${parts.join(", ")}  (${dur}s)`)
    nd(ctx, {
      at: new Date().toISOString(),
      elapsed_ms: Date.now() - ctx.t0,
      type: "exec.turn",
      turn: t.num,
      tools: Object.fromEntries(t.tools),
      duration_ms: Date.now() - t.startAt,
    })
    ctx.turn = null
  }

  // -- Event routing --

  function handleMilestone(ctx: TaskCtx, event: ProtocolEventView) {
    const type = event.type
    const p = event.payload ?? {}
    const summary = String(p.summary ?? "")
    const status = String(p.status ?? "")
    const taskID = String(p.taskID ?? "")
    const now = new Date().toISOString()
    const ms = Date.now() - ctx.t0

    switch (type) {
      case "task.created":
        tl(ctx, `[${elapsed(ctx)}] TASK created  ${taskID}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, status, summary })
        break
      case "task.updated":
        flushStage(ctx)
        ctx.stage = null
        flushTurn(ctx)
        tl(ctx, `[${elapsed(ctx)}] TASK → ${status}  ${summary}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, status, summary })
        break
      case "task.cancellation.requested": {
        const actor = String(p.actor ?? "")
        const surface = String(p.surface ?? "")
        const reason = String(p.reason ?? "")
        tl(
          ctx,
          `[${elapsed(ctx)}] CANCEL requested actor=${actor} surface=${surface} source=${event.source}  ${clip(reason)}`,
        )
        nd(ctx, {
          at: now,
          elapsed_ms: ms,
          type,
          eventID: event.id,
          taskID,
          actor,
          surface,
          reason,
          source: event.source,
          correlationID: event.correlationID ?? null,
          sessionID: event.sessionID ?? null,
          summary,
        })
        break
      }
      case "task.completed":
      case "task.failed":
      case "task.cancelled": {
        const verb = type.slice("task.".length).toUpperCase()
        tl(ctx, `[${elapsed(ctx)}] TASK ${verb}  ${summary}`)
        nd(ctx, {
          at: now,
          elapsed_ms: ms,
          type,
          eventID: event.id,
          taskID,
          status,
          summary,
          source: event.source,
          correlationID: event.correlationID ?? null,
          causationID: event.causationID ?? null,
          sessionID: event.sessionID ?? null,
        })
        break
      }
      case "interaction.requested":
        tl(ctx, `[${elapsed(ctx)}] INTERACTION requested  ${summary}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, summary })
        break
      case "interaction.resolved":
        tl(ctx, `[${elapsed(ctx)}] INTERACTION resolved  ${summary}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, summary })
        break
      case "task.infrastructure.failed":
        tl(
          ctx,
          `[${elapsed(ctx)}] INFRASTRUCTURE ${String(p.component ?? "unknown")}/${String(p.operation ?? "unknown")}  ${summary}`,
        )
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, summary, details: p.details ?? null })
        break
      case "agent.coordination.requested":
      case "agent.coordination.responded":
      case "agent.coordination.action":
      case "agent.coordination.cancelled":
        tl(ctx, `[${elapsed(ctx)}] A2A ${type.replace("agent.coordination.", "")}  ${summary}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, summary })
        break
      case "agent.execution.lifecycle": {
        const sessionID = String(p.sessionID ?? p.session_id ?? "")
        const value = p.status
        const statusType =
          value && typeof value === "object" && typeof (value as Record<string, unknown>).type === "string"
            ? String((value as Record<string, unknown>).type)
            : "unknown"
        const reason =
          value && typeof value === "object" && typeof (value as Record<string, unknown>).reason === "string"
            ? String((value as Record<string, unknown>).reason)
            : ""
        tl(ctx, `[${elapsed(ctx)}] SESSION ${sessionID} status=${statusType}${reason ? ` reason=${reason}` : ""}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, sessionID, status: value ?? null, summary })
        break
      }
      case "session.error": {
        const sessionID = String(p.sessionID ?? p.session_id ?? "")
        tl(ctx, `[${elapsed(ctx)}] SESSION ${sessionID} error  ${clip(summary)}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, sessionID, summary, error: p.error ?? null })
        break
      }
      case "session.bridge.persist_failed": {
        const sessionID = String(p.sessionID ?? p.session_id ?? "")
        const failedType = String(p.failed_type ?? "")
        const error = String(p.error ?? "")
        tl(ctx, `[${elapsed(ctx)}] BRIDGE failed ${failedType}  ${clip(error || summary)}`)
        nd(ctx, { at: now, elapsed_ms: ms, type, taskID, sessionID, failedType, error, summary })
        break
      }
    }
  }

  // -- Entry point --

  export function init() {
    if (stopProtocolSubscription) return
    stopProtocolSubscription = ProtocolStore.subscribeEvents(
      (event) => {
        const type = event?.type as string | undefined
        if (!type || !LOGGED_TYPES.has(type)) return
        const p = event.payload ?? {}
        const taskID = event.taskID ?? String(p.taskID ?? p.task_id ?? "")
        if (!taskID) return

        if (!tasks.has(taskID)) {
          try {
            const paths = eventLogPathsForTask(taskID)
            mkdirSync(dirname(paths.ndjson), { recursive: true })
            tasks.set(taskID, {
              ndjson: paths.ndjson,
              timeline: paths.timeline,
              t0: Date.now(),
              stage: null,
              turn: null,
              turnSeq: 0,
            })
            log.info("task log started", { taskID })
          } catch (e) {
            log.warn("failed to init task log", { error: String(e) })
            return
          }
        }

        const ctx = tasks.get(taskID)!

        handleMilestone(ctx, event)
      },
      { aggregate: "task" },
    )
  }

  export function disposeForTest() {
    stopProtocolSubscription?.()
    stopProtocolSubscription = undefined
    tasks.clear()
  }
}
