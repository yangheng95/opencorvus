import { Session } from "@/session"
import type { Message } from "@/session/message"
import { WORK_ARTIFACT_VALIDATE_TOOL_ID } from "./profile-registry"
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

/**
 * Decide the authority from Session facts alone.
 *
 * This used to query `session.sql` directly and compare JSON keys of the part
 * `data` column as SQL strings, with the Tool id spelled as a literal inside
 * that SQL. Any layout change on the Session side would have made every
 * delivery fail with an error naming the receipt rather than the schema, and
 * the acceptance script had to hand-write a matching row to get past it.
 * Reading the same facts through the Session's own API is the pattern
 * `build/merge-back-publication-authority.ts` already uses.
 */
export function requireWorkArtifactValidationAuthorityFromFacts(input: {
  messages: readonly Message.WithParts[]
  receiptUrl: string
  receiptSha: string
}): WorkArtifactValidationReceiptPayload {
  for (const message of input.messages) {
    for (const part of message.parts) {
      if (part.type !== "tool" || part.tool !== WORK_ARTIFACT_VALIDATE_TOOL_ID) continue
      if (part.state.status !== "completed") continue
      let decoded: unknown
      try {
        decoded = JSON.parse(part.state.output)
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
  }
  throw new Error(
    `validation receipt has no completed host-owned ${WORK_ARTIFACT_VALIDATE_TOOL_ID} authority in this Session. ` +
      `received: url ${JSON.stringify(input.receiptUrl)} sha ${JSON.stringify(input.receiptSha)}, ` +
      `expected: a receipt published by a completed ${WORK_ARTIFACT_VALIDATE_TOOL_ID} call in the same Session.`,
  )
}

export async function requireWorkArtifactValidationAuthority(input: {
  sessionID: string
  receiptUrl: string
  receiptSha: string
}): Promise<WorkArtifactValidationReceiptPayload> {
  return requireWorkArtifactValidationAuthorityFromFacts({
    messages: await Session.messages({ sessionID: input.sessionID }),
    receiptUrl: input.receiptUrl,
    receiptSha: input.receiptSha,
  })
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
  const authority = await requireWorkArtifactValidationAuthority({
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
