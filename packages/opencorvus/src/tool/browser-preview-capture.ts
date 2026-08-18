import { exactEngineArtifactLocator } from "@/artifact-catalog"
import {
  BrowserPreviewCaptureRequest,
  capturePersistedBrowserPreviewTarget,
} from "@/browser-preview/capture"
import { readBrowserPreviewEvidenceByID } from "@/browser-preview/persist"
import { browserPreviewTaskEvidenceRoot } from "@/browser-preview/task-evidence-root"
import type { BrowserPreviewVerification } from "@/browser-preview/verification"
import { requireTask } from "@/engine/store"
import { AttachmentStore } from "@/storage/attachment-store"
import type { TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { BrowserPreviewCaptureToolID } from "./browser-preview-tool-ids"
import { Tool } from "./tool"
import { taskExecutionID } from "./execution-files"

export const BrowserPreviewCaptureToolParameters = BrowserPreviewCaptureRequest

export async function materializeBrowserPreviewCaptureResult(input: {
  taskID: string
  targetID: string
  verification: BrowserPreviewVerification
}): Promise<{
  output: {
    status: BrowserPreviewVerification["status"]
    taskID: string
    targetID: string
    evidence: Array<{
      viewportID: string
      evidenceID: string
      stateID: string | null
      locator: ReturnType<typeof exactEngineArtifactLocator>
      operation_kind: "preview-capture"
      status: "passed" | "failed"
      capture_resource: TaskArtifactRef | null
    }>
    diagnostics: string[]
  }
  attachments: Array<{ type: "file"; mime: string; url: string; filename?: string }>
}> {
  const projectRoot = browserPreviewTaskEvidenceRoot(input.taskID)
  const projectID = requireTask(input.taskID).project_id
  const evidence: Array<{
    viewportID: string
    evidenceID: string
    stateID: string | null
    locator: ReturnType<typeof exactEngineArtifactLocator>
    operation_kind: "preview-capture"
    status: "passed" | "failed"
    capture_resource: TaskArtifactRef | null
  }> = []
  const attachments: Array<{ type: "file"; mime: string; url: string; filename?: string }> = []

  for (const [viewportID, evidenceID] of Object.entries(input.verification.evidenceIDs)) {
    const loaded = await readBrowserPreviewEvidenceByID({
      projectRoot,
      taskID: input.taskID,
      evidenceID,
    })
    if (!loaded || loaded.evidence.operationKind !== "preview-capture") {
      throw new Error(`Browser preview capture evidence is not readable: ${evidenceID}`)
    }
    const captureResource = loaded.evidence.resourceRefs.capture
    const captureBytes = loaded.captureRole ? loaded.bytesByRole.get(loaded.captureRole) : undefined
    if (captureResource && !captureBytes) {
      throw new Error(`Browser preview capture evidence has no readable PNG resource: ${evidenceID}`)
    }
    if (captureResource && captureBytes) {
      const filename = `${viewportID}-browser-preview-capture.png`
      const attachment = await AttachmentStore.write(projectID, captureBytes, "image/png", filename)
      attachments.push({
        type: "file" as const,
        mime: attachment.mime,
        url: attachment.url,
        filename,
      })
    }
    evidence.push({
      viewportID,
      evidenceID,
      stateID: loaded.evidence.stateID ?? null,
      locator: exactEngineArtifactLocator({ taskID: input.taskID, artifactID: evidenceID }),
      operation_kind: loaded.evidence.operationKind,
      status: loaded.evidence.status,
      capture_resource: captureResource ?? null,
    })
  }

  return {
    output: {
      status: input.verification.status,
      taskID: input.taskID,
      targetID: input.targetID,
      evidence,
      diagnostics: input.verification.diagnostics,
    },
    attachments,
  }
}

export const BrowserPreviewCaptureToolDescription =
  "Capture the selected viewports from one persisted task Browser Preview target through the canonical Playwright-backed producer. Returns exact Engine Artifact locators and the same persisted PNG bytes as multimodal attachments for direct inspection."

export const BrowserPreviewCaptureToolStaticDefinition = {
  description: BrowserPreviewCaptureToolDescription,
  parameters: BrowserPreviewCaptureToolParameters,
} as const

export const BrowserPreviewCaptureTool = Tool.define(BrowserPreviewCaptureToolID, {
  description: BrowserPreviewCaptureToolStaticDefinition.description,
  parameters: BrowserPreviewCaptureToolStaticDefinition.parameters,
  async execute(params, ctx: Tool.Context) {
    const taskID = taskExecutionID(ctx, "browser_preview_capture")
    const verification = await capturePersistedBrowserPreviewTarget({
      taskID,
      targetID: params.targetID,
      viewportIDs: params.viewportIDs,
      signal: ctx.abort,
    })
    const materialized = await materializeBrowserPreviewCaptureResult({
      taskID,
      targetID: params.targetID,
      verification,
    })
    return {
      title: "Browser Preview evidence captured",
      output: JSON.stringify(materialized.output, null, 2),
      attachments: materialized.attachments,
      metadata: {
        status: verification.status,
        taskID,
        targetID: params.targetID,
        evidenceIDs: verification.evidenceIDs,
        evidenceLocators: materialized.output.evidence.map((item) => item.locator),
        attachmentCount: materialized.attachments.length,
      },
    }
  },
})
