import { Tooltip } from "./ui/Tooltip"
import { Index, Show, createMemo, createSignal, onCleanup, type Accessor } from "solid-js"
import { cardTreeStore } from "../store/card-tree"
import { boardStore } from "../store/board"
import { conversationAgentRecordsForSource } from "../store/conversation-agents"
import { setCardExpanded } from "../store/conversation-ui"
import {
  conversationCardContainsMessage,
  loadConversationHistoryUntilCard,
  loadConversationSessionHistory,
} from "../services/conversation"
import { requestConversationCardScroll } from "../services/conversation-scroll"
import { formatErrorDetails, reportWarning } from "../services/diagnostics"
import { AppLog } from "../utils/log"
import {
  groupAdjacentAgentActivityRecordsByIdentity,
  type AgentActivityRecord,
  type AgentActivityStatus,
} from "../utils/agent-activity"
import { parentIDChainForCard } from "../utils/card-tree"
import { stageAccent } from "../utils/card-color"
import { avatarRole } from "./Avatar"
import { Button } from "./ui/Button"
import { t } from "../utils/i18n"
import { isSubagentActivityRecord, subagentProgressCardID } from "../utils/subagent-presentation"

const AGENT_RAIL_MINIMUM_VISIBLE_RECORDS = 3
const AGENT_RAIL_PROXIMITY_DEPTH = 3

const AGENT_RAIL_STATUS_LABELS: Record<AgentActivityStatus, () => string> = {
  pending: () => t("agent_rail.status.pending"),
  running: () => t("agent_rail.status.running"),
  idle: () => t("agent_rail.status.idle"),
  completed: () => t("agent_rail.status.completed"),
  error: () => t("agent_rail.status.error"),
  skipped: () => t("agent_rail.status.skipped"),
}

function agentRailStatusLabel(status: AgentActivityStatus): string {
  return AGENT_RAIL_STATUS_LABELS[status]()
}

function compactLabel(record: AgentActivityRecord): string {
  const parts = [record.agentID, agentRailStatusLabel(record.status)]
  const input = agentRailInput(record)
  if (input) parts.push(input)
  return parts.filter(Boolean).join(" · ")
}

interface AgentRailStack {
  id: string
  stage: string
  agentID: string
  records: AgentActivityRecord[]
}

function agentRailStage(record: AgentActivityRecord): string {
  return avatarRole(record.stage)
}

function agentRailInput(record: AgentActivityRecord): string {
  return String(record.inputPreview?.text || "").trim()
}

function buildAdjacentAgentRailStacks(records: AgentActivityRecord[]): AgentRailStack[] {
  return groupAdjacentAgentActivityRecordsByIdentity(records).map((group) => {
    const record = group[0]!
    const stage = agentRailStage(record)
    return {
      id: `${record.agentID}:${record.sessionID}`,
      stage,
      agentID: record.agentID,
      records: group,
    }
  })
}

function parentIDsForCard(cardID: string): string[] {
  return parentIDChainForCard(cardID)
}

function describeRecord(record: AgentActivityRecord, selector?: string): string {
  const lines = [
    t("agent_rail.detail.agent", { value: record.agentID }),
    t("agent_rail.detail.session_id", { value: record.sessionID }),
    t("agent_rail.detail.status", { value: agentRailStatusLabel(record.status) }),
  ]
  if (record.renderedCardID) lines.push(t("agent_rail.detail.rendered_card_id", { value: record.renderedCardID }))
  if (selector) lines.push(t("agent_rail.detail.selector", { value: selector }))
  return lines.join("\n")
}

function reportLocateFailure(record: AgentActivityRecord, error: unknown): void {
  const details = `${describeRecord(record)}\n\n${formatErrorDetails(error)}`
  AppLog.error("ui", "Agent rail locate failed", {
    sessionID: record.sessionID,
    renderedCardID: record.renderedCardID,
    targetMessageID: record.targetMessageID,
    error: formatErrorDetails(error),
    diagnosticID: `agent-rail:locate-failed:${record.sessionID}`,
    diagnosticTitle: t("agent_rail.card_unavailable_title"),
    diagnosticMessage: t("agent_rail.locate_failed", { agent: record.agentID }),
    diagnosticDetails: details,
  })
  reportWarning({
    id: `agent-rail:locate-failed:${record.sessionID}`,
    title: t("agent_rail.card_unavailable_title"),
    message: t("agent_rail.locate_failed", { agent: record.agentID }),
    details,
  })
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export function agentRailLocateCompletionIsCurrent(
  generation: number,
  currentGeneration: number,
  sourceIdentity: string,
  currentSourceIdentity: string,
): boolean {
  return generation === currentGeneration && sourceIdentity === currentSourceIdentity
}

export function agentRailLocateErrorShouldReport(error: unknown, ownerCurrent: boolean): boolean {
  return ownerCurrent && !isAbortError(error)
}

interface AgentRailLocateOwner {
  isCurrent: () => boolean
}

function selectedSourceIdentity(): string {
  const source = boardStore.selectedSource
  if (!source) return ""
  const directory =
    source.directory?.trim() || (source.kind === "task" ? String(boardStore.board?.task?.directory || "").trim() : "")
  return `${source.kind}:${source.id}:${directory}`
}

function currentRecordForExecution(executionID: string): AgentActivityRecord | undefined {
  const targetExecutionID = String(executionID || "")
  if (!targetExecutionID) return undefined
  return conversationAgentRecordsForSource(boardStore.selectedSource).find((record) => record.id === targetExecutionID)
}

async function materializeRecordTarget(
  record: AgentActivityRecord,
  owner: AgentRailLocateOwner,
): Promise<AgentActivityRecord> {
  if (record.renderedCardID) return record
  const sessionID = String(record.sessionID || "")
  const source = boardStore.selectedSource
  if (!sessionID || source?.kind !== "task") return record
  const directory = String(boardStore.board?.task?.directory || "").trim()
  if (!directory) return record
  const loaded = await loadConversationSessionHistory(sessionID, source.id, { directory })
  if (!owner.isCurrent()) return record
  if (!loaded) return currentRecordForExecution(record.id) || record
  return currentRecordForExecution(record.id) || record
}

async function locateRecord(record: AgentActivityRecord, owner: AgentRailLocateOwner): Promise<void> {
  if (!owner.isCurrent()) return
  if (isSubagentActivityRecord(record)) {
    const cardID = subagentProgressCardID(record.sessionID)
    const found = await requestConversationCardScroll({
      cardID,
      block: "center",
      highlight: true,
    })
    if (!owner.isCurrent()) return
    if (found) return
    const selector = `[data-card-id="${CSS.escape(cardID)}"]`
    reportWarning({
      title: t("agent_rail.card_unavailable_title"),
      message: t("agent_rail.rendered_card_missing", { id: cardID }),
      details: describeRecord(record, selector),
    })
    return
  }
  const targetRecord = await materializeRecordTarget(record, owner)
  if (!owner.isCurrent()) return
  if (!targetRecord.renderedCardID) {
    reportWarning({
      title: t("agent_rail.card_unavailable_title"),
      message: t("agent_rail.no_rendered_card_target", { agent: targetRecord.agentID }),
      details: describeRecord(targetRecord),
    })
    return
  }
  const targetMessageID = String(targetRecord.targetMessageID || "")
  const needsHistory =
    !cardTreeStore.cards[targetRecord.renderedCardID] ||
    (!!targetMessageID && !conversationCardContainsMessage(targetRecord.renderedCardID, targetMessageID))
  if (needsHistory) {
    const directory = String(boardStore.board?.task?.directory || "").trim()
    if (!directory) {
      reportWarning({
        title: t("agent_rail.card_unavailable_title"),
        message: t("agent_rail.no_rendered_card_target", { agent: targetRecord.agentID }),
        details: describeRecord(targetRecord),
      })
      return
    }
    await loadConversationHistoryUntilCard(targetRecord.renderedCardID, undefined, {
      messageID: targetMessageID,
      sessionID: targetRecord.sessionID,
      directory,
    })
    if (!owner.isCurrent()) return
  }
  if (!owner.isCurrent()) return
  setCardExpanded(targetRecord.renderedCardID, true)
  for (const parentID of parentIDsForCard(targetRecord.renderedCardID)) {
    setCardExpanded(parentID, true)
  }
  window.requestAnimationFrame(() => {
    if (!owner.isCurrent()) return
    window.requestAnimationFrame(() => {
      if (!owner.isCurrent()) return
      void requestConversationCardScroll({
        cardID: targetRecord.renderedCardID!,
        block: "start",
        highlight: true,
      })
        .then((found) => {
          if (!owner.isCurrent()) return
          if (found) return
          const selector = `[data-card-id="${CSS.escape(targetRecord.renderedCardID!)}"]`
          reportWarning({
            title: t("agent_rail.card_unavailable_title"),
            message: t("agent_rail.rendered_card_missing", { id: targetRecord.renderedCardID }),
            details: describeRecord(targetRecord, selector),
          })
        })
        .catch((error) => {
          if (!owner.isCurrent() || isAbortError(error)) return
          reportLocateFailure(targetRecord, error)
        })
    })
  })
}

function AgentRailRow(props: {
  record: Accessor<AgentActivityRecord>
  proximity: Accessor<number | undefined>
  onPointerActivate: (record: AgentActivityRecord) => void
  onFocusActivate: (record: AgentActivityRecord) => void
  onFocusDeactivate: (record: AgentActivityRecord) => void
  onLocate: (record: AgentActivityRecord) => Promise<void>
}) {
  const record = props.record
  const input = () => agentRailInput(record())
  const accessibleLabel = () => compactLabel(record())
  const proximity = () => {
    const value = props.proximity()
    return value === undefined ? undefined : String(value)
  }

  return (
    <div
      class="conversation-agent-rail__row"
      data-agent={agentRailStage(record())}
      data-status={record().status}
      data-proximity={proximity()}
      style={{ "--card-stage": stageAccent(agentRailStage(record())) }}
    >
      <Tooltip.Root openDelay={80} closeDelay={80} placement="right" gutter={8} flip={false}>
        <Tooltip.Trigger
          as={Button}
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-ui="conversation-agent-rail-locate"
          data-session-id={record().sessionID}
          data-target-message-id={record().targetMessageID || ""}
          data-rendered-card-id={
            isSubagentActivityRecord(record())
              ? subagentProgressCardID(record().sessionID)
              : record().renderedCardID || ""
          }
          aria-label={accessibleLabel()}
          onPointerEnter={() => props.onPointerActivate(record())}
          onFocus={() => props.onFocusActivate(record())}
          onBlur={() => props.onFocusDeactivate(record())}
          onClick={() => {
            const current = record()
            void props.onLocate(current).catch((error) => reportLocateFailure(current, error))
          }}
        >
          <span class="conversation-agent-rail__tick" aria-hidden="true">
            <span class="conversation-agent-rail__tick-line" />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content class="conversation-agent-rail-tooltip" data-ui="conversation-agent-rail-tooltip">
            <div class="conversation-agent-rail-tooltip__header oc-section-heading">
              <strong>{record().agentID}</strong>
            </div>
            <Show when={input()}>
              <section class="conversation-agent-rail-tooltip__section" data-kind="input">
                <span>{t("agent_rail.detail.user_input")}</span>
                <p>{input()}</p>
              </section>
            </Show>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </div>
  )
}

export function ConversationAgentRail() {
  const records = createMemo(() => conversationAgentRecordsForSource(boardStore.selectedSource))
  const stacks = createMemo(() => buildAdjacentAgentRailStacks(records()))
  const hasVisibleRecords = createMemo(() => records().length >= AGENT_RAIL_MINIMUM_VISIBLE_RECORDS)
  const [pointerExecutionID, setPointerExecutionID] = createSignal<string | undefined>()
  const [focusedExecutionID, setFocusedExecutionID] = createSignal<string | undefined>()
  let locateGeneration = 0
  onCleanup(() => {
    locateGeneration += 1
  })
  const activeExecutionID = createMemo(() => pointerExecutionID() ?? focusedExecutionID())
  const activeIndex = createMemo(() => {
    const executionID = activeExecutionID()
    if (!executionID) return -1
    return records().findIndex((record) => record.id === executionID)
  })
  const proximityForRecord = (record: AgentActivityRecord): number | undefined => {
    const index = activeIndex()
    if (index < 0) return undefined
    const recordIndex = records().findIndex((candidate) => candidate.id === record.id)
    if (recordIndex < 0) return undefined
    const distance = Math.abs(recordIndex - index)
    return distance <= AGENT_RAIL_PROXIMITY_DEPTH ? distance : undefined
  }
  const activatePointerRecord = (record: AgentActivityRecord) => setPointerExecutionID(record.id)
  const activateFocusedRecord = (record: AgentActivityRecord) => setFocusedExecutionID(record.id)
  const deactivateFocusedRecord = (record: AgentActivityRecord) => {
    if (focusedExecutionID() === record.id) setFocusedExecutionID(undefined)
  }
  const runLocate = async (record: AgentActivityRecord): Promise<void> => {
    const generation = ++locateGeneration
    const sourceIdentity = selectedSourceIdentity()
    const owner: AgentRailLocateOwner = {
      isCurrent: () =>
        agentRailLocateCompletionIsCurrent(
          generation,
          locateGeneration,
          sourceIdentity,
          selectedSourceIdentity(),
        ),
    }
    try {
      await locateRecord(record, owner)
    } catch (error) {
      if (!agentRailLocateErrorShouldReport(error, owner.isCurrent())) return
      reportLocateFailure(record, error)
    }
  }

  return (
    <Show when={hasVisibleRecords()}>
      <aside class="conversation-agent-rail" aria-label={t("agent_rail.activity_label")}>
        <div class="conversation-agent-rail__lanes" role="list" onPointerLeave={() => setPointerExecutionID(undefined)}>
          <Index each={stacks()}>
            {(stack) => (
              <div
                class="conversation-agent-rail__stack"
                data-stack-id={stack().id}
                data-agent={stack().stage}
                data-agent-id={stack().agentID}
                data-count={stack().records.length}
                role="listitem"
                style={{ "--card-stage": stageAccent(stack().stage) }}
              >
                <Index each={stack().records}>
                  {(record) => (
                    <AgentRailRow
                      record={record}
                      proximity={() => proximityForRecord(record())}
                      onPointerActivate={activatePointerRecord}
                      onFocusActivate={activateFocusedRecord}
                      onFocusDeactivate={deactivateFocusedRecord}
                      onLocate={runLocate}
                    />
                  )}
                </Index>
              </div>
            )}
          </Index>
        </div>
      </aside>
    </Show>
  )
}
