import z from "zod"
import { Database, and, eq, sql } from "@/storage/db"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"
import { MissionAcceptanceGapSchema } from "./acceptance-gap"

export const MissionTaskResumeReceiptSchema = z
  .object({
    protocol: z.literal("mission-acceptance-resume-receipt"),
    task_id: z.string().min(1),
    mission_id: z.string().min(1),
    mission_session_id: z.string().min(1),
    panel_message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    message_id: z.string().min(1),
    wake_id: z.string().min(1),
    ingress_artifact_id: z.string().min(1),
    acceptance_ledger_revision_artifact_id: z.string().min(1),
    prior_terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
    acceptance_gap: MissionAcceptanceGapSchema,
    time_accepted: z.number().int().positive(),
  })
  .strict()

export class MissionTaskResumeReceiptIntegrityError extends Error {
  override readonly name = "MissionTaskResumeReceiptIntegrityError"
}

export function readMissionTaskResumeReceipt(taskID: string, identity: { toolCallID: string } | { ingressID: string }) {
  const rows = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "mission_acceptance_resume_receipt"),
          "toolCallID" in identity
            ? sql`json_extract(${EngineArtifactTable.payload}, '$.tool_call_id') = ${identity.toolCallID}`
            : sql`json_extract(${EngineArtifactTable.payload}, '$.ingress_artifact_id') = ${identity.ingressID}`,
        ),
      )
      .limit(2)
      .all(),
  )
  if (rows.length === 0) return undefined
  if (rows.length !== 1)
    throw new MissionTaskResumeReceiptIntegrityError(`Task ${taskID} has ambiguous Mission resume receipts.`)
  const row = rows[0]!
  const parsed = MissionTaskResumeReceiptSchema.safeParse(row.payload)
  if (!parsed.success || parsed.data.task_id !== taskID) {
    throw new MissionTaskResumeReceiptIntegrityError(`Task ${taskID} has an invalid Mission resume receipt ${row.id}.`)
  }
  return { artifactID: row.id, receipt: parsed.data }
}
