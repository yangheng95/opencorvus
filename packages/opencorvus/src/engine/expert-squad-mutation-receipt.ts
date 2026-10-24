import { Database, eq, sql } from "@/storage/db"
import { ExpertSquadMutationReceiptTable } from "@/expert-squad/mutation-receipt.sql"
import {
  EvolutionMutationReceiptIdentityConflictError,
  parseExpertSquadMutationReceiptProjection,
  type ExpertSquadMutationReceiptProjection,
} from "@/expert-squad/mutation-receipt-validation"

export function readExpertSquadMutationReceipt(db: Database.TxOrDb, artifactID: string) {
  const row = db
    .select()
    .from(ExpertSquadMutationReceiptTable)
    .where(eq(ExpertSquadMutationReceiptTable.artifact_id, artifactID))
    .get()
  if (!row) return undefined
  const envelopeText = db
    .select({ value: sql<string>`CAST(${ExpertSquadMutationReceiptTable.envelope} AS TEXT)` })
    .from(ExpertSquadMutationReceiptTable)
    .where(eq(ExpertSquadMutationReceiptTable.artifact_id, artifactID))
    .get()!.value
  const parsed = parseExpertSquadMutationReceiptProjection({
    artifactID,
    taskID: row.task_id,
    kind: "expert_output",
    payload: row.envelope,
  })
  if (!parsed) throw new EvolutionMutationReceiptIdentityConflictError({ artifactID })
  return { ...row, ...parsed, envelopeText }
}

export function assertExpertSquadMutationReceiptProjection(
  db: Database.TxOrDb,
  input: ExpertSquadMutationReceiptProjection & { payloadText: string },
) {
  const current = readExpertSquadMutationReceipt(db, input.artifactID)
  const candidate = parseExpertSquadMutationReceiptProjection(input)
  if (
    current &&
    (input.taskID !== current.task_id ||
      input.kind !== "expert_output" ||
      !candidate ||
      current.envelopeText !== input.payloadText)
  )
    throw new EvolutionMutationReceiptIdentityConflictError({ artifactID: input.artifactID })
  return candidate
}

/** The caller owns the original Artifact SAVEPOINT. This fact and its report
 * therefore have the same commit, including when a public caller uses a DB. */
export function appendExpertSquadMutationReceipt(
  db: Database.TxOrDb,
  input: ExpertSquadMutationReceiptProjection & { payloadText: string; timeCreated: number },
): void {
  const candidate = assertExpertSquadMutationReceiptProjection(db, input)
  if (!candidate || readExpertSquadMutationReceipt(db, input.artifactID)) return
  db.insert(ExpertSquadMutationReceiptTable)
    .values({
      artifact_id: input.artifactID,
      task_id: input.taskID,
      envelope: sql`${input.payloadText}`,
      time_created: input.timeCreated,
    })
    .run()
}
