import type z from "zod"
import { CreateTaskInput, UserUploadBytesList } from "@/engine/model"
import {
  globalTaskRequestContract,
  canonicalInlineUploadAttachment,
} from "@/engine/task-creation-request"

/** Global creation owns its carrying Project and directory. Those fields are
 * rejected at the public boundary instead of being accepted but omitted from
 * the immutable allocation request. */
export const GlobalTaskCreateInput = CreateTaskInput.omit({
  project: true,
  directory: true,
  artifactSources: true,
  metadata: true,
  attachments: true,
}).extend({ attachments: UserUploadBytesList.optional() }).strict()
type Input = z.infer<typeof GlobalTaskCreateInput>

function normalizedAttachment(attachment: NonNullable<Input["attachments"]>[number]) {
  return canonicalInlineUploadAttachment(
    attachment,
    `Global Task attachment ${attachment.filename ?? attachment.mime}`,
  )
}

export function globalTaskCreateInputContract(input: Input) {
  return globalTaskRequestContract({
    request: input.request,
    title: input.title?.trim() || null,
    source: input.source ?? null,
    productPillar: input.productPillar,
    attachments: (input.attachments ?? []).map(normalizedAttachment),
    model: input.model,
    priority: input.priority,
    promptProfile: input.promptProfile,
    expectedPackageDigest: input.expectedPackageDigest,
    budget: input.budget,
    checks: input.checks,
    channelBinding: input.channelBinding,
  })
}

/** Freeze every caller-controlled CreateTask semantic before the anonymous
 * Project directory exists. requestID is the occurrence key; Project and
 * directory are server-owned and are not part of this public schema. */
