import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { PNG } from "pngjs"
import z from "zod"
import { Identifier } from "@/id/id"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { findBrowserPreviewTargetByID, persistBrowserPreviewEvidence } from "./persist"
import { throwAfterBrowserPreviewPublicationCleanup } from "./publication-cleanup"
import { browserPreviewTaskEvidenceRoot } from "./task-evidence-root"
import { browserPreviewViewportByID, BrowserPreviewViewportID } from "./viewport"
import { BrowserPreviewTargetNotFoundError } from "./capture"

export const BrowserPreviewInteractionCaptureRequest = z
  .object({
    targetID: z.string().min(1),
    viewportID: BrowserPreviewViewportID,
    stateID: z.string().min(1),
    sourceToolPartID: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict()
export type BrowserPreviewInteractionCaptureRequest = z.infer<typeof BrowserPreviewInteractionCaptureRequest>

export function assertBrowserInteractionSourceMatchesTarget(input: {
  sourceUrl: string
  targetUrl: string
}): void {
  const source = new URL(input.sourceUrl)
  const target = new URL(input.targetUrl)
  const targetPath = target.pathname.replace(/\/+$/, "") || "/"
  const sourceMatchesTargetPath =
    targetPath === "/" || source.pathname === targetPath || source.pathname.startsWith(`${targetPath}/`)
  if (source.origin !== target.origin || !sourceMatchesTargetPath) {
    throw new Error(`Browser interaction source URL ${source.href} is outside Browser Preview target ${target.href}.`)
  }
}

export async function persistBrowserPreviewInteractionCapture(input: {
  taskID: string
  targetID: string
  viewportID: z.infer<typeof BrowserPreviewViewportID>
  stateID: string
  summary: string
  screenshotBytes: Buffer
  source: {
    sessionID: string
    messageID: string
    partID: string
    callID: string
    toolRef: string
    attachmentUrl: string
    attachmentSha: string
    sourceUrl: string
  }
}): Promise<{ evidenceID: string; projectRoot: string; captureSha256: string }> {
  const projectRoot = browserPreviewTaskEvidenceRoot(input.taskID)
  const target = findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })
  if (!target) throw new BrowserPreviewTargetNotFoundError(input.targetID)
  assertBrowserInteractionSourceMatchesTarget({
    sourceUrl: input.source.sourceUrl,
    targetUrl: target.url,
  })
  const viewport = browserPreviewViewportByID(target.viewports, input.viewportID)
  const image = PNG.sync.read(input.screenshotBytes)
  if (image.width !== viewport.width || image.height !== viewport.height) {
    throw new Error(
      `Browser interaction screenshot is ${image.width}x${image.height}, expected persisted viewport ${viewport.width}x${viewport.height}.`,
    )
  }
  const captureSha256 = crypto.createHash("sha256").update(input.screenshotBytes).digest("hex")
  if (captureSha256 !== input.source.attachmentSha) {
    throw new Error("Browser interaction screenshot bytes do not match the source attachment SHA-256.")
  }

  const jobID = Identifier.ascending("artifact")
  const outputDir = ProjectRuntimePaths.browserPreviewJobRoot(projectRoot, input.taskID, jobID)
  const taskRoot = ProjectRuntimePaths.taskRoot(projectRoot, input.taskID)
  await fs.mkdir(taskRoot, { recursive: true })
  const preparedDir = await fs.mkdtemp(path.join(taskRoot, ".browser-preview-interaction-preparing-"))
  let published = false
  try {
    const preparedCapturePath = path.join(
      preparedDir,
      `${input.viewportID}-${captureSha256.slice(0, 16)}.png`,
    )
    const preparedManifestPath = path.join(preparedDir, "manifest.json")
    await fs.writeFile(preparedCapturePath, input.screenshotBytes)
    await fs.writeFile(
      preparedManifestPath,
      JSON.stringify(
        {
          kind: "browser-preview-interaction-capture",
          taskID: input.taskID,
          targetID: input.targetID,
          viewportID: input.viewportID,
          stateID: input.stateID,
          sourceUrl: input.source.sourceUrl,
          targetUrl: target.url,
          source: input.source,
          captureSha256,
        },
        null,
        2,
      ),
    )
    await fs.mkdir(path.dirname(outputDir), { recursive: true })
    await fs.rename(preparedDir, outputDir)
    published = true
    const capturePath = path.join(outputDir, path.basename(preparedCapturePath))
    const manifestPath = path.join(outputDir, path.basename(preparedManifestPath))
    const evidenceID = await persistBrowserPreviewEvidence({
      projectRoot,
      taskID: input.taskID,
      targetID: input.targetID,
      viewportID: input.viewportID,
      stateID: input.stateID,
      operationKind: "preview-capture",
      manifestPath,
      status: "passed",
      summary: input.summary,
      capture: {
        captured: true,
        passed: true,
        path: capturePath,
        sha: captureSha256.slice(0, 16),
        url: input.source.sourceUrl,
        target_url: target.url,
        bytes: input.screenshotBytes.byteLength,
        size: { width: image.width, height: image.height },
        requested_viewport: { width: viewport.width, height: viewport.height },
        viewport: { width: viewport.width, height: viewport.height, capped: false },
        interaction: {
          state_id: input.stateID,
          source_tool_part_id: input.source.partID,
          source_tool_ref: input.source.toolRef,
          source_url: input.source.sourceUrl,
        },
        summary: input.summary,
      },
      diagnostics: [
        `Registered explicit Browser MCP interaction state ${input.stateID} from tool part ${input.source.partID}.`,
      ],
    })
    return { evidenceID, projectRoot, captureSha256 }
  } catch (error) {
    return await throwAfterBrowserPreviewPublicationCleanup({
      primaryFailure: error,
      residualPath: published ? outputDir : preparedDir,
    })
  }
}
