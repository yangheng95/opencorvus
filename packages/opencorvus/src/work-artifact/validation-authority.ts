import { MessageTable, ToolPartRequestTable as PartTable, ToolPartOutcomeTable } from "@/session/session.sql"
import { Database, and, eq, sql } from "@/storage/db"
import z from "zod"
import { WORK_ARTIFACT_VALIDATION_RECEIPT_MIME, WorkArtifactValidationReceiptPayload } from "./presentation"
import {
  prepareWorkArtifactPresentationDeliverable,
  type WorkArtifactPresentationDependencies,
} from "./presentation"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"

const AuthorityOutput = z.object({
  validation_receipt: z.object({
    url: z.string().min(1),
    sha: z.string().regex(/^[a-f0-9]{64}$/),
    mime: z.literal(WORK_ARTIFACT_VALIDATION_RECEIPT_MIME),
  }),
  validation_receipt_payload: WorkArtifactValidationReceiptPayload,
})

export function requireWorkArtifactValidationAuthority(input: {
  sessionID: string
  receiptUrl: string
  receiptSha: string
}): WorkArtifactValidationReceiptPayload {
  const rows = Database.use((db) =>
    db
      .select({ id: PartTable.id, outcome: ToolPartOutcomeTable.data })
      .from(PartTable)
      .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, PartTable.id))
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(MessageTable.session_id, input.sessionID),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') = 'work_artifact_validate'`,
          sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
        ),
      )
      .all(),
  )
  for (const row of rows) {
    const output = (row.outcome as { output?: unknown }).output
    if (typeof output !== "string") continue
    let decoded: unknown
    try {
      decoded = JSON.parse(output)
    } catch {
      continue
    }
    const authority = AuthorityOutput.safeParse(decoded)
    if (!authority.success) continue
    if (
      authority.data.validation_receipt.url === input.receiptUrl &&
      authority.data.validation_receipt.sha === input.receiptSha
    ) {
      return authority.data.validation_receipt_payload
    }
  }
  throw new Error("validation receipt has no completed host-owned work_artifact_validate authority in this Session")
}

export async function prepareAuthorizedWorkArtifactPresentationDeliverable(input: {
  raw: unknown
  sessionID: string
  executionAuthority: SessionExecutionAuthority
  abort: AbortSignal
  extra?: Record<string, unknown>
  dependencies?: WorkArtifactPresentationDependencies
  deadline?: number
}) {
  const raw = z
    .object({
      validation_receipt_url: z.string().min(1),
      validation_receipt_sha: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .passthrough()
    .parse(input.raw)
  const authority = requireWorkArtifactValidationAuthority({
    sessionID: input.sessionID,
    receiptUrl: raw.validation_receipt_url,
    receiptSha: raw.validation_receipt_sha,
  })
  const checked = await prepareWorkArtifactPresentationDeliverable(input)
  if (JSON.stringify(authority) !== JSON.stringify(checked.priorReceiptPayload)) {
    throw new Error("validation receipt authority payload does not match the canonical receipt")
  }
  return checked
}
