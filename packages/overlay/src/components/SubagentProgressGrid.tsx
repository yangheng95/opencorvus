import { For, Show, Switch, Match, createEffect, createMemo, onCleanup } from "solid-js"
import { boardStore, selectedTaskDirectory } from "../store/board"
import {
  conversationAgentRecordForSourceSession,
  conversationAgentRecordsForSource,
} from "../store/conversation-agents"
import {
  subagentProgressCardID,
  subagentProgressEvents,
  type SubagentProgressEvent,
} from "../utils/subagent-presentation"
import { normalizeAgentRole } from "../utils/message"
import { stageAccent } from "../utils/card-color"
import { t } from "../utils/i18n"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { summarizeTodos } from "../utils/todos"
import { Avatar } from "./Avatar"
import { TodoProgress } from "./TodoProgress"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { isAgentActivityTerminalStatus } from "../utils/agent-activity"
import { DelegatedContextDisclosure } from "./DelegatedContextDisclosure"
import { StaticTextPart } from "./TextPart"

function SubagentProgressEventRow(props: { event: SubagentProgressEvent }) {
  return (
    <span
      class="subagent-progress-event"
      data-kind={props.event.kind}
      data-status={props.event.kind === "tool" ? props.event.status : undefined}
    >
      <Switch>
        <Match when={props.event.kind === "tool"}>
          {(_) => {
            const event = props.event as Extract<SubagentProgressEvent, { kind: "tool" }>
            return (
              <>
                <Icon name={event.icon} size="compact" />
                <span class="subagent-progress-event__main">
                  <span class="subagent-progress-event__label">{event.label}</span>
                  <Show when={event.detail}>
                    <span class="subagent-progress-event__detail">{event.detail}</span>
                  </Show>
                </span>
              </>
            )
          }}
        </Match>
        <Match when={props.event.kind === "patch"}>
          {(_) => {
            const event = props.event as Extract<SubagentProgressEvent, { kind: "patch" }>
            return (
              <>
                <Icon name="edit" size="compact" />
                <span class="subagent-progress-event__main">
                  {t("subagent.progress.edited_files", { files: event.files.join(", ") })}
                </span>
              </>
            )
          }}
        </Match>
        <Match when={props.event.kind === "file"}>
          {(_) => {
            const event = props.event as Extract<SubagentProgressEvent, { kind: "file" }>
            return (
              <>
                <Icon name="file-document" size="compact" />
                <span class="subagent-progress-event__main">{event.filename}</span>
              </>
            )
          }}
        </Match>
        <Match when={props.event.kind === "error"}>
          {(_) => {
            const event = props.event as Extract<SubagentProgressEvent, { kind: "error" }>
            return (
              <>
                <Icon name="status-failed" size="compact" />
                <span class="subagent-progress-event__main">{event.text}</span>
              </>
            )
          }}
        </Match>
        <Match when={props.event.kind === "text"}>
          {(_) => {
            const event = props.event as Extract<SubagentProgressEvent, { kind: "text" }>
            return (
              <>
                <Icon name="message" size="compact" />
                <span class="subagent-progress-event__main">{event.text}</span>
              </>
            )
          }}
        </Match>
      </Switch>
    </span>
  )
}

function SubagentProgressCard(props: { sessionID: string; onOpen: (sessionID: string) => void }) {
  let progressElement: HTMLDivElement | undefined
  const record = createMemo(() => {
    const item = conversationAgentRecordForSourceSession(boardStore.selectedSource, props.sessionID)
    if (!item) throw new Error(`subagent progress card missing activity record for ${props.sessionID}`)
    return item
  })
  const role = createMemo(() => normalizeAgentRole(record().stage))
  const events = createMemo(() =>
    subagentProgressEvents({
      record: record(),
      directory: selectedTaskDirectory(),
    }),
  )
  const todoSummary = createMemo(() => summarizeTodos(record().todos))
  const terminal = createMemo(() => isAgentActivityTerminalStatus(record().status))
  const emptyActivityLabel = createMemo(() =>
    record().status === "pending" || record().status === "running"
      ? t("subagent.progress.waiting")
      : t("subagent.progress.no_activity"),
  )
  const inputPreview = () => String(record().inputPreview?.text || "").trim()
  const scrollProgressToLatest = createAnimationFrameScheduler(() => {
    if (!progressElement) return
    progressElement.scrollTop = progressElement.scrollHeight
  })

  createEffect(() => {
    events()
      .map((event) => event.id)
      .join("|")
    if (record().status === "running" || record().status === "pending") {
      scrollProgressToLatest.schedule()
    }
  })
  onCleanup(scrollProgressToLatest.cancel)

  const open = () => props.onOpen(props.sessionID)

  return (
    <article
      class="subagent-progress-card"
      data-card-id={subagentProgressCardID(props.sessionID)}
      data-session-id={props.sessionID}
      data-status={record().status}
      data-agent={role()}
      style={{ "--card-stage": stageAccent(role()) }}
      onClick={open}
    >
      <Button
        type="button"
        class="subagent-progress-card__activation"
        variant="ghost"
        size="mini"
        tone="neutral"
        aria-label={t("subagent.progress.open", { agent: record().agentID })}
        onClick={(event) => {
          event.stopPropagation()
          open()
        }}
      />
      <header class="subagent-progress-card__header">
        <span class="subagent-progress-card__identity">
          <Avatar role={role()} />
          <strong>{record().agentID}</strong>
        </span>
      </header>
      <div
        ref={progressElement}
        class="subagent-progress-card__events"
        role="log"
        aria-label={t("subagent.progress.activity", { agent: record().agentID })}
      >
        <Show when={inputPreview()}>
          {(preview) => (
            <DelegatedContextDisclosure id={`delegated-context:subagent:${props.sessionID}`}>
              <StaticTextPart text={preview()} />
            </DelegatedContextDisclosure>
          )}
        </Show>
        <Show
          when={events().length > 0}
          fallback={<span class="subagent-progress-card__waiting">{emptyActivityLabel()}</span>}
        >
          <For each={events()}>{(event) => <SubagentProgressEventRow event={event} />}</For>
        </Show>
      </div>
      <Show when={todoSummary().total > 0}>
        <footer class="subagent-progress-card__footer">
          <TodoProgress summary={todoSummary()} variant="subagent" terminal={terminal()} />
        </footer>
      </Show>
    </article>
  )
}

export function SubagentProgressGrid(props: { sessionIDs: string[]; onOpen: (sessionID: string) => void }) {
  return (
    <section class="subagent-progress-grid" aria-label={t("subagent.progress.grid_label")}>
      <For each={props.sessionIDs}>
        {(sessionID) => <SubagentProgressCard sessionID={sessionID} onOpen={props.onOpen} />}
      </For>
    </section>
  )
}
