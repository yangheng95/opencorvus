// ── TracePanel ──
//
// Renders AgentTrace events. Each event collapses to a one-line headline
// that extracts the semantic meaning of the event (which agent, what it
// produced, did it succeed) so the operator can scan the trace without
// expanding everything. Click to expand for the raw JSON payload — the
// source-of-truth dump that drove the headline. The header carries three
// actions: Copy (dump the entire trace as JSON to clipboard), Refresh,
// Close (when an `onClose` is supplied).
//
// Active entry point:
//   <TracePanel sessionID="..." directory="..." /> — per-session, mounted by
//                                                   the trace button on each
//                                                   card (see Card.tsx).
//
// The taskID mode of the prop is preserved for future cross-session views
// but is currently unused — the panel-level "Show all session trace" bar
// and the right-panel task-trace surface were both removed in 2026-04-26
// (see Board.tsx for the rationale). Operators wanting cross-session
// context dump JSON via the per-session Copy button instead.

import { Index, Show, createMemo, createResource, createSignal, onCleanup } from "solid-js"
import {
  fetchSessionTrace,
  fetchTaskTrace,
  invalidateTraceCache,
  type TraceEvent,
  type TraceFetchResult,
} from "../services/trace"
import { Panel } from "./ui/Panel"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { t } from "../utils/i18n"
import { createVisibilityInterval } from "../utils/visibility-interval"

type TracePanelProps =
  | { sessionID: string; taskID?: never; directory: string; onClose?: () => void }
  | { taskID: string; sessionID?: never; directory: string; onClose?: () => void }

function formatTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "—"
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  const ms = String(d.getMilliseconds()).padStart(3, "0")
  return `${hh}:${mm}:${ss}.${ms}`
}

function payloadJson(event: TraceEvent): string {
  const { ts: _ts, kind: _kind, ...rest } = event
  try {
    return JSON.stringify(rest, null, 2)
  } catch {
    return String(rest)
  }
}

// ── Per-kind headline extractors ─────────────────────────────────────────
// Trace events are heterogeneous (session_open / llm_request / agent_turn /
// agent_turn_failure / helper_llm_call / orchestrator_wake / ...). Each kind
// stores its own shape under `payload`. The headline below pulls the
// fields that matter for at-a-glance scanning, leaving the raw JSON to
// the expanded view for full inspection.

function eventHeadline(event: TraceEvent): string {
  const kind = event.kind
  const agent = event.agentName ? event.agentName : ""
  const payload = (event.payload ?? {}) as Record<string, unknown>
  switch (kind) {
    case "session_open": {
      const first = typeof payload.firstEvent === "string" ? ` · ${payload.firstEvent}` : ""
      return `${t("trace.event.open")} · ${agent || t("trace.event.session")}${first}`
    }
    case "llm_request": {
      const requestMessageID =
        typeof payload.requestMessageID === "string" ? payload.requestMessageID : t("trace.event.session")
      const toolCount = Array.isArray(payload.tools) ? payload.tools.length : 0
      return `llm_request · ${agent || "?"} · request_message=${requestMessageID} · tools=${toolCount}`
    }
    case "agent_turn": {
      const errs = Array.isArray(payload.streamErrors) ? (payload.streamErrors as unknown[]).length : 0
      const finalMessageID = typeof payload.finalMessageID === "string" ? payload.finalMessageID : ""
      const tail = [
        finalMessageID ? `final_message=${finalMessageID}` : "",
        errs ? t("trace.event.stream_errors", { count: errs }) : "",
      ]
        .filter(Boolean)
        .join(" · ")
      return `agent_turn · ${agent || "?"}${tail ? ` · ${tail}` : ""}`
    }
    case "agent_turn_failure":
    case "orchestrator_wake_failure": {
      const err = (payload.error ?? (payload as any).reason ?? t("trace.event.no_message")) as unknown
      return `${kind} · ${agent || "?"} · ${String(err).slice(0, 120)}`
    }
    case "orchestrator_wake": {
      const reason = typeof (payload as any).reason === "string" ? (payload as any).reason : ""
      return `orchestrator_wake${reason ? ` · ${reason}` : ""}`
    }
    case "helper_llm_call": {
      const purpose = (payload as any).purpose ?? (payload as any).label ?? ""
      return `helper_llm_call${purpose ? ` · ${purpose}` : ""}`
    }
    default:
      return `${kind}${agent ? ` · ${agent}` : ""}`
  }
}

function traceEventBodyElementID(event: TraceEvent): string {
  const raw = `trace-event-${event.kind}-${event.ts}-${event.sessionID ?? "task"}-body`
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "trace-event-body"
}

function TraceEventRow(props: { event: TraceEvent; defaultOpen?: boolean }) {
  const [open, setOpen] = createSignal(!!props.defaultOpen)
  const bodyElementID = () => traceEventBodyElementID(props.event)
  return (
    <div class="trace-event" data-kind={props.event.kind} data-open={open() ? "true" : "false"}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        tone="neutral"
        class="trace-event-head"
        data-ui="trace-event-head"
        aria-expanded={open()}
        aria-controls={open() ? bodyElementID() : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span class="trace-event-ts">{formatTime(props.event.ts)}</span>
        <span class="trace-event-kind">{eventHeadline(props.event)}</span>
        <Show when={props.event.sessionID}>
          <span class="trace-event-sid" title={props.event.sessionID}>
            {String(props.event.sessionID).slice(-8)}
          </span>
        </Show>
        <span class="trace-event-chevron" aria-hidden="true">
          <Icon name={open() ? "chevron-down" : "chevron"} />
        </span>
      </Button>
      <Show when={open()}>
        <pre id={bodyElementID()} class="trace-event-body">
          {payloadJson(props.event)}
        </pre>
      </Show>
    </div>
  )
}

export function TracePanel(props: TracePanelProps) {
  const cacheKey = createMemo(() => `${props.directory}:${props.sessionID ?? `task:${props.taskID ?? ""}`}`)
  const [refreshTick, setRefreshTick] = createSignal(0)

  const [data] = createResource<TraceFetchResult, { key: string; tick: number }>(
    () => ({ key: cacheKey(), tick: refreshTick() }),
    async () => {
      if ("sessionID" in props && props.sessionID) {
        return fetchSessionTrace(
          { sessionID: props.sessionID, directory: props.directory },
          { force: refreshTick() > 0 },
        )
      }
      if ("taskID" in props && props.taskID) {
        return fetchTaskTrace({ taskID: props.taskID, directory: props.directory }, { force: refreshTick() > 0 })
      }
      return { ok: true, events: [], traceDir: "", enabled: true }
    },
  )
  const events = createMemo<TraceEvent[]>(() => data()?.events ?? [])
  const traceError = createMemo(() => {
    const result = data()
    return result?.ok === false ? result.error : ""
  })

  const refresh = () => {
    if ("sessionID" in props && props.sessionID) {
      invalidateTraceCache({ sessionID: props.sessionID, directory: props.directory })
    } else if ("taskID" in props && props.taskID) {
      invalidateTraceCache({ taskID: props.taskID, directory: props.directory })
    }
    setRefreshTick((v) => v + 1)
  }

  // ── Copy trace as JSON ────────────────────────────────────────────────
  // The full event array (post-fetch, in chronological order) goes onto the
  // clipboard so the operator can paste it into a log viewer / issue / LLM.
  // Includes traceDir + target metadata so the dump is self-describing.
  const [copyState, setCopyState] = createSignal<"idle" | "ok" | "err">("idle")
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined
  const copyTrace = async () => {
    const result = data()
    const target =
      "sessionID" in props && props.sessionID
        ? { kind: "session" as const, id: props.sessionID }
        : "taskID" in props && props.taskID
          ? { kind: "task" as const, id: props.taskID }
          : null
    if (!target) return
    const dump = {
      kind: target.kind,
      id: target.id,
      traceDir: result?.traceDir ?? "",
      enabled: result?.enabled ?? null,
      ok: result?.ok ?? null,
      error: result?.ok === false ? result.error : undefined,
      events: result?.events ?? [],
      copiedAt: Date.now(),
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(dump, null, 2))
      setCopyState("ok")
    } catch {
      setCopyState("err")
    }
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => setCopyState("idle"), 1500)
  }
  onCleanup(() => {
    if (copyResetTimer) clearTimeout(copyResetTimer)
  })

  // Auto-refresh: when a task / session is bound, poll every 4s so the panel
  // picks up new events without the operator having to hit ↻. Cleanup ensures
  // the timer dies when the panel unmounts (task switch / panel close). Tick
  // is skipped while the overlay window is hidden — the operator can't see
  // the panel anyway, and we don't want to wake the JS event loop on a
  // battery laptop while alt-tabbed away.
  const hasTarget = createMemo(() =>
    Boolean(("sessionID" in props && props.sessionID) || ("taskID" in props && props.taskID)),
  )
  const polling = createVisibilityInterval(
    () => {
      if (hasTarget()) void refresh()
    },
    4_000,
    {
      onVisible: () => {
        if (hasTarget()) void refresh()
      },
    },
  )
  if (hasTarget()) polling.start()
  onCleanup(() => {
    polling.dispose()
  })

  const titleText = createMemo(() => {
    if ("sessionID" in props && props.sessionID) {
      return t("trace.title_session", { id: String(props.sessionID).slice(-12) })
    }
    if ("taskID" in props && props.taskID) {
      return t("trace.title_task", { id: String(props.taskID).slice(-12) })
    }
    return t("trace.title_unselected")
  })

  return (
    <Panel
      class="trace-panel"
      header={
        <>
          <span class="trace-panel-title oc-section-heading">{titleText()}</span>
          <span class="trace-panel-actions">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-ui="trace-copy"
              onClick={copyTrace}
              disabled={!hasTarget() || (events().length === 0 && !data())}
              data-state={copyState()}
              title={
                copyState() === "ok"
                  ? t("common.copied")
                  : copyState() === "err"
                    ? t("trace.copy_failed")
                    : t("trace.copy_json")
              }
              aria-label={t("trace.copy_json")}
            >
              <Icon name={copyState() === "ok" ? "check" : copyState() === "err" ? "cancel" : "copy"} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-ui="trace-refresh"
              onClick={refresh}
              title={t("trace.refresh_title")}
              aria-label={t("trace.refresh_title")}
            >
              <Icon name="refresh" />
            </Button>
            <Show when={props.onClose}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-ui="trace-close"
                onClick={() => props.onClose?.()}
                title={t("trace.close_title")}
                aria-label={t("trace.close_title")}
              >
                <Icon name="close" />
              </Button>
            </Show>
          </span>
        </>
      }
    >
      <Show when={!hasTarget()}>
        <div class="trace-panel-empty">{t("trace.empty_select_task")}</div>
      </Show>
      <Show when={hasTarget() && data.loading}>
        <div class="trace-panel-empty" role="status" aria-live="polite" aria-busy="true">
          {t("trace.loading")}
        </div>
      </Show>
      <Show when={hasTarget() && !data.loading && traceError()}>
        <div class="trace-panel-empty trace-panel-empty--error">
          <p>{t("trace.fetch_failed")}</p>
          <p>{traceError()}</p>
        </div>
      </Show>
      <Show when={hasTarget() && !data.loading && data()?.ok !== false && events().length === 0}>
        <div class="trace-panel-empty">
          <p>{t("trace.empty_no_events")}</p>
          <Show when={data()?.enabled === false}>
            <p>
              <strong>{t("trace.disabled_server")}</strong> — <code>OPENCORVUS_AGENT_TRACE=0</code>{" "}
              {t("trace.disabled_server_hint")}
            </p>
          </Show>
          <Show when={data()?.enabled !== false && data()?.traceDir}>
            <p>
              {t("trace.server_trace_dir")} <code>{data()!.traceDir}</code>
            </p>
            <p>
              {t("trace.trace_dir_mismatch_before")} <code>OPENCORVUS_AGENT_TRACE_DIR</code>
              {t("trace.trace_dir_mismatch_after")}
            </p>
          </Show>
          <p class="trace-panel-empty-foot">{t("trace.auto_refresh")}</p>
        </div>
      </Show>
      <Show when={hasTarget() && events().length > 0}>
        <div class="trace-panel-body">
          {/* Index over For: trace events are append-only (4s polling adds
              new entries to the tail; existing rows never reorder or move).
              Index reuses DOM nodes by position, so a single new event
              appends without re-keying every prior row. */}
          <Index each={events()}>{(event) => <TraceEventRow event={event()} />}</Index>
        </div>
      </Show>
    </Panel>
  )
}
