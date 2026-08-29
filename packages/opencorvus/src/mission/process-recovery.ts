import { Identifier } from "@/id/id"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { Session } from "@/session"
import { SessionControl } from "@/session/control"
import { SessionLoop } from "@/session/loop"
import type { Message } from "@/session/message"
import { SessionWake } from "@/session/wake"
import { Log } from "@/util/log"
import z from "zod"
import { requireMissionSession } from "./session"
import { currentMissionExecutionClosure, withMissionExecutionAdmission } from "./execution-closure"
import { recoverMissionExecutionClosing } from "./execution-closer"

const log = Log.create({ service: "mission.process-recovery" })
const RECOVERY_CONTROL_KIND = "mission_process_recovery" as const

export const MissionProcessRecoveryMarker = z
  .object({
    version: z.literal(1),
    occurrenceID: Identifier.schema("session_control"),
    attempt: z.number().int().positive(),
    interruptedAssistantMessageIDs: z.array(Identifier.schema("message")).min(1),
    wakeMessageID: Identifier.schema("message"),
    wakeTextPartID: Identifier.schema("part"),
    wakeControlID: Identifier.schema("session_control"),
    interruptedAt: z.number().int().positive(),
  })
  .strict()
export type MissionProcessRecoveryMarker = z.infer<typeof MissionProcessRecoveryMarker>

type WakeRecovery = (input: SessionWake.WakeInput) => Promise<{
  sessionID: string
  messageID: string
  activation: Promise<SessionWake.WakeActivation>
  completion?: Promise<SessionWake.WakeCompletion>
}>

function pendingMarker(sessionID: string): MissionProcessRecoveryMarker | undefined {
  const records = SessionControl.pending(sessionID).filter((record) => record.kind === RECOVERY_CONTROL_KIND)
  if (records.length > 1) {
    throw new Error(`Mission Session ${sessionID} has ${records.length} pending process-recovery occurrences`)
  }
  const record = records[0]
  if (!record) return undefined
  const marker = MissionProcessRecoveryMarker.parse(record.payload)
  if (marker.occurrenceID !== record.id) {
    throw new Error(`Mission process-recovery occurrence ${record.id} payload identity does not match`)
  }
  return marker
}

function persistMarker(sessionID: string, marker: MissionProcessRecoveryMarker, exists: boolean): void {
  if (!exists) {
    SessionControl.create({
      id: marker.occurrenceID,
      sessionID,
      kind: RECOVERY_CONTROL_KIND,
      status: "pending",
      owner: "mission.process-recovery",
      payload: marker,
    })
    return
  }
  const updated = SessionControl.updatePendingPayload({
    id: marker.occurrenceID,
    sessionID,
    payload: marker,
  })
  if (!updated) throw new Error(`Mission process-recovery occurrence ${marker.occurrenceID} is no longer pending`)
}

function trailingIncompleteAssistantMessageIDs(messages: Message.WithParts[]): string[] {
  const result: string[] = []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!
    if (message.info.role === "user") break
    if (message.info.role === "assistant" && message.info.time.completed === undefined) result.push(message.info.id)
  }
  return result
}

function repliesTo(messages: Message.WithParts[], wakeMessageID: string): Array<Message.WithParts> {
  return messages.filter((message) => message.info.role === "assistant" && message.info.parentID === wakeMessageID)
}

function successfulReplyExists(messages: Message.WithParts[], wakeMessageID: string): boolean {
  return repliesTo(messages, wakeMessageID).some(
    (message) =>
      message.info.role === "assistant" &&
      message.info.time.completed !== undefined &&
      Boolean(message.info.finish) &&
      message.info.finish !== "error" &&
      message.info.finish !== "tool-calls" &&
      message.info.error === undefined &&
      message.info.summary !== true,
  )
}

function clearMarkerIfCurrent(sessionID: string, occurrenceID: string): boolean {
  const marker = pendingMarker(sessionID)
  if (marker?.occurrenceID !== occurrenceID) return false
  return SessionControl.consume({ id: occurrenceID, sessionID }) !== undefined
}

function recoveryPrompt(interruptedCount: number, attempt: number): string {
  return (
    `The backend process restarted while ${interruptedCount} assistant turn${interruptedCount === 1 ? " was" : "s were"} ` +
    `still executing. This is recovery attempt ${attempt} for the same process-recovery occurrence. ` +
    "Inspect the persisted process-interruption failures, reconcile durable Mission state, and continue the Mission from the last safe boundary without duplicating completed work."
  )
}

export type MissionProcessRecoveryResult =
  | { status: "not_needed"; sessionID: string }
  | { status: "already_completed"; sessionID: string; occurrenceID: string }
  | { status: "closure_settled"; sessionID: string; closureEventID: string; occurrenceID?: string }
  | { status: "woken"; sessionID: string; occurrenceID: string; attempt: number; wakeMessageID: string }

export async function recoverMissionProcessSession(
  sessionID: string,
  dependencies: { wake?: WakeRecovery } = {},
): Promise<MissionProcessRecoveryResult> {
  const mission = await requireMissionSession(sessionID)
  await recoverMissionExecutionClosing(sessionID)
  return withMissionExecutionAdmission(sessionID, async () => {
    const messages = await Session.messages({ sessionID })
    const incompleteAssistantMessageIDs = trailingIncompleteAssistantMessageIDs(messages)
    let previous = pendingMarker(sessionID)
    if (!previous && incompleteAssistantMessageIDs.length === 0) return { status: "not_needed", sessionID }
    if (previous && successfulReplyExists(messages, previous.wakeMessageID)) {
      clearMarkerIfCurrent(sessionID, previous.occurrenceID)
      if (incompleteAssistantMessageIDs.length === 0) {
        return { status: "already_completed", sessionID, occurrenceID: previous.occurrenceID }
      }
      previous = undefined
    }

    const closure = currentMissionExecutionClosure(sessionID)
    if (closure?.state === "closing" || closure?.state === "closed" || closure?.state === "recovery_blocked") {
      await SessionLoop.terminalizeRecoveredIncompleteAssistant(sessionID)
      if (previous) {
        const settled = SessionControl.fail({
          id: previous.occurrenceID,
          sessionID,
          error: `Mission execution closed by ${closure.eventID}`,
          payload: {
            ...previous,
            terminal: { kind: "mission_closed", closureEventID: closure.eventID },
          },
        })
        if (!settled) {
          throw new Error(`Mission process-recovery occurrence ${previous.occurrenceID} is no longer pending`)
        }
      }
      return {
        status: "closure_settled",
        sessionID,
        closureEventID: closure.eventID,
        ...(previous ? { occurrenceID: previous.occurrenceID } : {}),
      }
    }

    const interruptedAssistantMessageIDs = [
      ...new Set([...(previous?.interruptedAssistantMessageIDs ?? []), ...incompleteAssistantMessageIDs]),
    ]
    if (interruptedAssistantMessageIDs.length === 0) {
      throw new Error(`Mission process recovery ${previous?.occurrenceID ?? "<missing>"} has no interrupted assistant`)
    }
    const rotateAttempt = previous ? repliesTo(messages, previous.wakeMessageID).length > 0 : false
    const occurrenceID = previous?.occurrenceID ?? Identifier.ascending("session_control")
    const marker = MissionProcessRecoveryMarker.parse({
      version: 1,
      occurrenceID,
      attempt: previous ? previous.attempt + (rotateAttempt ? 1 : 0) : 1,
      interruptedAssistantMessageIDs,
      wakeMessageID: previous && !rotateAttempt ? previous.wakeMessageID : Identifier.ascending("message"),
      wakeTextPartID: previous && !rotateAttempt ? previous.wakeTextPartID : Identifier.ascending("part"),
      wakeControlID: previous && !rotateAttempt ? previous.wakeControlID : Identifier.ascending("session_control"),
      interruptedAt: previous?.interruptedAt ?? Date.now(),
    })
    persistMarker(sessionID, marker, previous !== undefined)
    await SessionLoop.terminalizeRecoveredIncompleteAssistant(sessionID)

    const wake = dependencies.wake ?? SessionWake.wakeWithReceipt
    const receipt = await wake({
      sessionID,
      messageID: marker.wakeMessageID,
      textPartID: marker.wakeTextPartID,
      controlID: marker.wakeControlID,
      prompt: recoveryPrompt(marker.interruptedAssistantMessageIDs.length, marker.attempt),
      author: "OpenCorvus runtime recovery",
      reason: {
        source: "mission.process_recovery",
        missionID: mission.missionID,
        occurrenceID: marker.occurrenceID,
        interruptedAssistantMessageIDs: marker.interruptedAssistantMessageIDs,
      },
      agent: "mission",
      surface: "panel",
    })
    if (receipt.messageID !== marker.wakeMessageID) {
      throw new Error(`Mission process recovery wake identity changed for ${sessionID}`)
    }
    await receipt.activation
    if (receipt.completion) {
      void receipt.completion.then((outcome) => {
        if (!outcome.ok) return
        return runWithInitializedIndependentProject({
          directory: mission.directory,
          fn: async () => {
            const currentMessages = await Session.messages({ sessionID })
            if (successfulReplyExists(currentMessages, marker.wakeMessageID)) {
              clearMarkerIfCurrent(sessionID, marker.occurrenceID)
            }
          },
        }).catch((error) => log.error("failed to clear completed Mission recovery marker", { sessionID, error }))
      })
    }
    return {
      status: "woken",
      sessionID,
      occurrenceID: marker.occurrenceID,
      attempt: marker.attempt,
      wakeMessageID: marker.wakeMessageID,
    }
  })
}
