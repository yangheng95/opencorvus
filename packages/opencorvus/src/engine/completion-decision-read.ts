import { Database } from "@/storage/db"
import {
  findTaskCompletionDecisionForTerminalTimeInTransaction,
  requireTaskCompletionDecisionArtifactInTransaction,
} from "./completion-decision-facts"

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
