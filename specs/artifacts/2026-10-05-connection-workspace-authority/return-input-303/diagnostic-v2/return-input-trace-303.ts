import { untrack } from "solid-js"
import { apiJson } from "../services/api"
import type { SubagentConversationTranscript } from "../services/subagent-conversation"

const caps = { control: 1000, event: 12000, projection: 4000, render: 12000 }
const counts = { control: 0, event: 0, projection: 0, render: 0 }
let sequence = 0
const pending: { record: Record<string, unknown>; characters: number }[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let sending = false
let failures = 0

function schedule() {
  if (timer || sending || !pending.length) return
  timer = setTimeout(() => { timer = undefined; void flush() }, 100)
}

async function flush() {
  if (sending || !pending.length) return
  sending = true
  let characters = 0
  const batch: typeof pending = []
  while (pending.length && batch.length < 24 && characters < 128_000) {
    const item = pending.shift()!
    characters += item.characters
    batch.push(item)
  }
  const records = batch.map(item => item.record)
  try {
    await apiJson("log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [{ service: "overlay:return-input-303", level: "info", message: "Captured batch",
        extra: { records, capturedSequence: sequence, pendingRecords: pending.length, failures } }] }),
    })
  } catch {
    failures++
    pending.unshift(...batch)
  } finally {
    sending = false
    schedule()
  }
}

function enqueue(record: Record<string, unknown>) {
  const serialized = JSON.stringify(record)
  pending.push({record: JSON.parse(serialized), characters: serialized.length})
  schedule()
}

/** Temporary owned-page diagnostics; removed before production delivery. */
export function traceReturn303(group: keyof typeof caps, message: string, facts: () => unknown) {
  untrack(() => {
    if (counts[group] >= caps[group]) return
    counts[group]++
    enqueue({
      message,
      sequence: ++sequence, at: performance.now(), utc: new Date().toISOString(), group,
      counts: { ...counts }, facts: facts(),
    })
    if (counts[group] === caps[group]) enqueue({sequence: ++sequence, message: "Diagnostic cap reached", group, cap: caps[group]})
  })
}

export function transcriptFact303(value: SubagentConversationTranscript | undefined) {
  if (!value) return undefined
  return {
    targetKey: value.targetKey, sessionID: value.sessionID, sequence: value.lastLiveSequence,
    epoch: value.liveEpoch, mode: value.transcriptMode,
    messages: value.messages.map(message => ({
      messageID: message.messageID, sessionID: message.sessionID, time: message.info.time,
      parts: message.parts.filter(part => part.type === "text").map(part => ({
        partID: part.id, messageID: part.messageID, sessionID: part.sessionID, text: part.text, time: part.time,
      })),
    })),
  }
}
