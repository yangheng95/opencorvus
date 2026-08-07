import z from "zod"
import { findBrowserPreviewTargetByID } from "./persist"
import { browserPreviewTaskEvidenceRoot } from "./task-evidence-root"
import { taskBrowserPreviewTarget } from "./target"
import {
  BrowserPreviewVerification,
  type BrowserPreviewVerificationInput,
  verifyBrowserPreview,
} from "./verification"
import { BrowserPreviewViewportID } from "./viewport"

export const BrowserPreviewCaptureRequest = z
  .object({
    targetID: z.string().min(1),
    viewportIDs: BrowserPreviewViewportID.array()
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, "Browser preview viewport IDs must be unique.")
      .meta({ uniqueItems: true }),
  })
  .strict()
export type BrowserPreviewCaptureRequest = z.infer<typeof BrowserPreviewCaptureRequest>

export class BrowserPreviewTargetNotFoundError extends Error {
  override readonly name = "BrowserPreviewTargetNotFoundError"

  constructor(readonly targetID: string) {
    super(`Browser preview target not found: ${targetID}`)
  }
}

export type BrowserPreviewVerifier = (
  input: BrowserPreviewVerificationInput,
) => Promise<BrowserPreviewVerification>

export async function capturePersistedBrowserPreviewTarget(input: {
  taskID: string
  targetID: string
  viewportIDs: BrowserPreviewViewportID[]
  signal?: AbortSignal
  verify?: BrowserPreviewVerifier
}): Promise<BrowserPreviewVerification> {
  const projectRoot = browserPreviewTaskEvidenceRoot(input.taskID)
  const persisted = findBrowserPreviewTargetByID({
    taskID: input.taskID,
    targetID: input.targetID,
  })
  if (!persisted) throw new BrowserPreviewTargetNotFoundError(input.targetID)

  const target = taskBrowserPreviewTarget({
    id: persisted.id,
    taskID: input.taskID,
    projectRoot,
    url: persisted.url,
    viewports: persisted.viewports,
    diagnostics: [`Using task browser preview target ${persisted.id}.`],
  })
  return (input.verify ?? verifyBrowserPreview)({
    projectRoot,
    target,
    taskID: input.taskID,
    targetID: input.targetID,
    viewportIDs: input.viewportIDs,
    signal: input.signal,
  })
}
