import { Database } from "@/storage/db"
import { MessageStore } from "@/session/message-store"
import {
  findTaskCompletionDecisionForTerminalTimeInTransaction,
  requireTaskCompletionDecisionArtifactInTransaction,
} from "./completion-decision-facts"
import { taskIDForSession } from "./task-session-lineage"

export function findTaskCompletionDecisionForTerminalTime(input: {
  taskID: string
  timeCompleted: number
}) {
  return Database.use((db) => findTaskCompletionDecisionForTerminalTimeInTransaction(db, input))
}

export function requireTaskCompletionDecisionArtifact(input: {
  taskID: string
  artifactID: string
  timeCompleted: number
}) {
  return Database.use((db) => requireTaskCompletionDecisionArtifactInTransaction(db, input))
}

export async function requireTaskCompletionDecisionMessage(input: {
  taskID: string
  timeCompleted: number
  sessionID: string
  messageID: string
}) {
  const decision = findTaskCompletionDecisionForTerminalTime(input)
  if (!decision) {
    throw new Error(`Task ${input.taskID} has no completion decision at terminal time ${input.timeCompleted}`)
  }
  const namedByDecision =
    (decision.payload.orchestrator_session_id === input.sessionID &&
      decision.payload.orchestrator_message_id === input.messageID) ||
    decision.payload.evidence_locators.some(
      (locator) =>
        locator.source === "session_message" &&
        locator.session_id === input.sessionID &&
        locator.message_id === input.messageID,
    )
  if (!namedByDecision) {
    throw new Error(
      `Task ${input.taskID} current completion decision does not name Session Message ${input.sessionID}/${input.messageID}`,
    )
  }
  if (taskIDForSession(input.sessionID) !== input.taskID) {
    throw new Error(`Session Message ${input.sessionID}/${input.messageID} does not belong to Task ${input.taskID}`)
  }
  const message = await MessageStore.get({ sessionID: input.sessionID, messageID: input.messageID })
  if (message.info.time.created > decision.timeCreated) {
    throw new Error(
      `Session Message ${input.sessionID}/${input.messageID} is later than Task ${input.taskID} completion decision`,
    )
  }
  return { decision, message }
}
