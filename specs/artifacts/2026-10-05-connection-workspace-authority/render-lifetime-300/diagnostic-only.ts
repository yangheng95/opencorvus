import { createEffect, createMemo, on, onCleanup, onMount, untrack } from "solid-js"
import type { SubagentConversationTranscript } from "../services/subagent-conversation"
import { AppLog } from "./log"

let owners = 0
const counts = { lifecycle: 0, projection: 0 }
const limits = { lifecycle: 400, projection: 1000 }
const recent: unknown[] = []
const priorText = new Map<string, { owner: number; text: string }>()
let childTarget = ""
let childBase = new Map<string, string>()
let childRegression = ""
type SnapshotReader = (sessionID: string, partID: string) => Record<string, unknown> | undefined
function emit(group: keyof typeof counts, message: string, facts: unknown) {
  if (counts[group] >= limits[group]) return
  counts[group]++
  untrack(() => AppLog.info("render-lifetime-300", message, { at: performance.now(), counts: { ...counts }, facts }))
  if (counts[group] === limits[group]) untrack(() => AppLog.info("render-lifetime-300", "Diagnostic cap reached", { group, limit: limits[group] }))
}
function remember(value: unknown) {
  recent.push({ at: performance.now(), value })
  if (recent.length > 24) recent.shift()
}
function eventFact(event: any) {
  const data = event?.properties ?? event?.payload ?? {}
  return { type: event?.type, sequence: event?.live_sequence, epoch: event?.live_epoch,
    sessionID: data.sessionID ?? data.info?.sessionID ?? data.part?.sessionID,
    messageID: data.messageID ?? data.info?.id ?? data.part?.messageID,
    partID: data.partID ?? data.part?.id, textLength: data.part?.text?.length, deltaLength: data.delta?.length }
}
export function observeMainEvent300(event: any, read: SnapshotReader) {
  const fact = eventFact(event)
  remember(fact)
  const part = (event?.properties ?? event?.payload)?.part
  if (event?.type !== "message.part.updated" || part?.type !== "text") return
  const previous = read(fact.sessionID, fact.partID)
  if (typeof previous?.text === "string" && typeof part.text === "string" && !part.text.startsWith(previous.text)) {
    emit("lifecycle", "Incoming main text replacement", { ...fact, previous: previous.text, incoming: part.text, recent: [...recent] })
  }
}
export function observeMainSnapshot300(messages: any[], read: SnapshotReader) {
  const parts = messages.flatMap(message => (message.parts ?? []).filter((part: any) => part.type === "text"))
  const facts = parts.map(part => { const previous = read(part.sessionID, part.id); return {
    partID: part.id, messageID: part.messageID, sessionID: part.sessionID,
    previousLength: typeof previous?.text === "string" ? previous.text.length : undefined,
    incomingLength: part.text?.length,
    replacement: typeof previous?.text === "string" && typeof part.text === "string" && !part.text.startsWith(previous.text)
      ? { previous: previous.text, incoming: part.text } : undefined,
  } })
  remember({ kind: "full-view-commit", facts })
  emit("projection", "Incoming full view", { facts, recent: [...recent] })
}
export function observeChildEvent300(event: any, sessionID: string) {
  const fact = eventFact(event)
  if (fact.sessionID === sessionID && fact.type !== "message.part.delta") remember({ surface: "child", ...fact })
}
export function observeChildProjection300(base: SubagentConversationTranscript, displayed: SubagentConversationTranscript) {
  if (base.targetKey !== childTarget) { childTarget = base.targetKey; childBase = new Map(); childRegression = "" }
  const texts = (value: SubagentConversationTranscript) => value.messages.flatMap(message => message.parts
    .filter(part => part.type === "text").map(part => ({ messageID: message.messageID, partID: part.id, text: String(part.text ?? "") })))
  const persisted = texts(base)
  const projection = new Map(texts(displayed).map(part => [part.partID, part.text]))
  const changed = persisted.filter(part => childBase.get(part.partID) !== part.text)
  const regressions = persisted.filter(part => part.text.length > (projection.get(part.partID)?.length ?? 0)
    && part.text.startsWith(projection.get(part.partID) ?? ""))
  const regression = JSON.stringify(regressions.map(part => [part.partID, part.text, projection.get(part.partID)]))
  if (changed.length || regression !== childRegression) emit("projection", "Actual child projection", {
    sessionID: base.sessionID, sequence: base.lastLiveSequence, epoch: base.liveEpoch,
    changed: changed.map(part => ({partID:part.partID,messageID:part.messageID,persistedLength:part.text.length,displayedLength:projection.get(part.partID)?.length})),
    regressions: regressions.map(part => ({...part,displayed:projection.get(part.partID)})),
  })
  childBase = new Map(persisted.map(part => [part.partID, part.text]))
  childRegression = regression
}
export function observeTextOwner300(element: () => HTMLElement | undefined, text: () => string, streaming: () => boolean,
  pending: () => boolean, blocks: () => number) {
  const owner = ++owners
  let identity: { messageID: string | undefined; partID: string | undefined; sessionID: string | undefined; surface: string } | undefined
  let latest = ""
  const stage = createMemo(() => pending() && blocks() === 0 ? "rendering" : streaming() ? "streaming" : "content")
  const record = (phase: string) => { if (identity) emit("lifecycle", "Actual text owner", {
    owner, phase, stage: stage(), pending: pending(), length: latest.length, blocks: blocks(), ...identity, recent: [...recent],
  }) }
  const observe = () => {
    if (!identity?.partID) return
    const key = `${identity.sessionID}:${identity.partID}`
    const previous = priorText.get(key)
    if (previous && !latest.startsWith(previous.text)) emit("lifecycle", "Actual rendered text replacement", {
      owner, previousOwner:previous.owner, ...identity, previous:previous.text, displayed:latest, recent:[...recent],
    })
    priorText.set(key,{owner,text:latest})
  }
  createEffect(() => { latest=text(); untrack(observe) })
  onMount(() => {
    const node = element()
    const part = node?.closest<HTMLElement>("[data-quotation-part]")
    if (!part) return
    identity = {messageID:part.dataset.quotationMessage,partID:part.dataset.quotationPart,sessionID:part.dataset.quotationSession,
      surface:node?.closest(".subagent-conversation-panel") ? "child" : "main-or-side"}
    observe()
    record("mounted")
  })
  createEffect(on(stage, () => untrack(() => record("stage-changed")), {defer:true}))
  onCleanup(() => untrack(() => record("retired")))
}
