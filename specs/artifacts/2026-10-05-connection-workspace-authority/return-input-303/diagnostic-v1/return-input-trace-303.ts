import { untrack } from "solid-js"
import { AppLog } from "./log"
import type { SubagentConversationTranscript } from "../services/subagent-conversation"

const caps = { control: 1000, event: 12000, projection: 4000, render: 12000 }
const counts = { control: 0, event: 0, projection: 0, render: 0 }
let sequence = 0

/** Temporary owned-page diagnostics; removed before production delivery. */
export function traceReturn303(group: keyof typeof caps, message: string, facts: () => unknown) {
  untrack(() => {
    if (counts[group] >= caps[group]) return
    counts[group]++
    const captured = JSON.parse(JSON.stringify(facts()))
    AppLog.info("return-input-303", message, {
      sequence: ++sequence, at: performance.now(), utc: new Date().toISOString(), group,
      counts: { ...counts }, facts: captured,
    })
    if (counts[group] === caps[group]) AppLog.info("return-input-303", "Diagnostic cap reached", { group, cap: caps[group] })
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
