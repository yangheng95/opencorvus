import { ProviderError } from "@/provider/error"
import type { Message } from "./message"

/** One read projection of real assistant facts, shared by replay and evidence reads. */
export namespace AssistantDiagnostics {
  export function identity(info: Message.Assistant) {
    return {
      sessionID: info.sessionID,
      messageID: info.id,
      parentID: info.parentID,
      acceptedInputMessageIDs: info.acceptedInputMessageIDs,
    }
  }

  export function facts(info: Message.Assistant) {
    if (
      !info.error &&
      !info.failureOccurrence &&
      !info.convergenceFailure &&
      !info.observationFailures?.length &&
      info.finish !== "error"
    )
      return
    return {
      ...identity(info),
      author: info.author,
      time: info.time,
      finish: info.finish,
      summary: info.summary,
      error: info.error,
      failureOccurrence: info.failureOccurrence,
      convergenceFailure: info.convergenceFailure,
      observationFailures: info.observationFailures,
    }
  }

  export function project(info: Message.Assistant) {
    const value = facts(info)
    if (!value) return
    const copiedFrom = info.copySources?.flatMap((entry) =>
      "field" in entry
        ? entry.sources.map(({ sessionID, messageID }) => ({ sessionID, messageID, field: "diagnostics" }))
        : [],
    )
    return ProviderError.redactSensitiveProviderValue({ ...value, ...(copiedFrom?.length ? { copiedFrom } : {}) })
  }

  /** Rebind local owner references only. Diagnostic body/Tool locators stay historical. */
  export function rebind(info: Message.Assistant, owner: ReturnType<typeof identity>): Message.Assistant {
    const occurrence = info.failureOccurrence && {
      ...info.failureOccurrence,
      session_id: owner.sessionID,
      assistant_message_id: owner.messageID,
    }
    return {
      ...info,
      id: owner.messageID,
      sessionID: owner.sessionID,
      parentID: owner.parentID,
      acceptedInputMessageIDs: owner.acceptedInputMessageIDs,
      failureOccurrence: occurrence,
      convergenceFailure:
        info.convergenceFailure && occurrence
          ? { ...info.convergenceFailure, failure_occurrence: occurrence }
          : info.convergenceFailure,
    }
  }
}
