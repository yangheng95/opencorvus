import { createEffect, on, onCleanup, onMount, untrack } from "solid-js"
import type { SubagentConversationTranscript } from "../services/subagent-conversation"
import { AppLog } from "./log"

let entries = 0
let owners = 0
let target = ""
let previousBase = new Map<string, string>()
let previousRegression = ""
const recentEvents: unknown[] = []
const emit = (kind: string, facts: unknown) => {
  if (entries++ >= 500) return
  untrack(() => AppLog.info("child-live-298", kind, { at: performance.now(), facts }))
}

export function observeChildEvent298(event: any, sessionID: string): void {
  const data = event?.properties ?? event?.payload ?? {}
  const actual = data.sessionID ?? data.info?.sessionID ?? data.part?.sessionID
  if (actual !== sessionID) return
  recentEvents.push({ type: event.type, sequence: event.live_sequence, epoch: event.live_epoch,
    messageID: data.messageID ?? data.info?.id ?? data.part?.messageID,
    partID: data.partID ?? data.part?.id, textLength: data.part?.text?.length, deltaLength: data.delta?.length })
  if (recentEvents.length > 12) recentEvents.shift()
}

export function observeChildProjection298(base: SubagentConversationTranscript, displayed: SubagentConversationTranscript): void {
  if (base.targetKey !== target) {
    target = base.targetKey
    previousBase = new Map()
    previousRegression = ""
    recentEvents.length = 0
  }
  const texts = (value: SubagentConversationTranscript) => value.messages.flatMap(message => message.parts
    .filter(part => part.type === "text")
    .map(part => ({ messageID: message.messageID, partID: part.id, text: String(part.text ?? "") })))
  const persisted = texts(base)
  const projection = new Map(texts(displayed).map(part => [part.partID, part.text]))
  const changed = persisted.filter(part => previousBase.get(part.partID) !== part.text)
  const regressions = persisted.filter(part => part.text.length > (projection.get(part.partID)?.length ?? 0)
    && part.text.startsWith(projection.get(part.partID) ?? ""))
  const regression = JSON.stringify(regressions.map(part => [part.partID, part.text, projection.get(part.partID)]))
  if (changed.length || regression !== previousRegression) {
    emit("Actual child projection", { sessionID: base.sessionID, sequence: base.lastLiveSequence, epoch: base.liveEpoch,
      changed: changed.map(part => ({ ...part, displayed: projection.get(part.partID) })),
      regressions: regressions.map(part => ({ ...part, displayed: projection.get(part.partID) })), recentEvents: [...recentEvents] })
  }
  previousBase = new Map(persisted.map(part => [part.partID, part.text]))
  previousRegression = regression
}

export function observeTextOwner298(
  element: () => HTMLElement | undefined,
  text: () => string,
  initial: () => boolean,
): void {
  const owner = ++owners
  let identity: { messageID: string | undefined; partID: string | undefined; surface: string } | undefined
  let length = 0
  createEffect(() => { length = text().length })
  const record = (phase: string) => { if (identity) emit("Actual text owner", { owner, phase, length, ...identity }) }
  onMount(() => {
    const node = element()
    const part = node?.closest<HTMLElement>("[data-quotation-part]")
    if (!part) return
    identity = { messageID: part.dataset.quotationMessage, partID: part.dataset.quotationPart,
      surface: node?.closest(".subagent-conversation-panel") ? "child" : "main-or-side" }
    record(initial() ? "mounted-rendering" : "mounted-content")
  })
  createEffect(on(initial, value => record(value ? "initial-rendering" : "content"), { defer: true }))
  onCleanup(() => record("retired"))
}
