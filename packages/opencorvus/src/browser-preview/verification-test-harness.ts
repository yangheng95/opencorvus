import type { RuntimeCaptureInput, RuntimeCaptureResult } from "@/runtime/capture-contract"
import { findBrowserPreviewTargetByID } from "./persist"
import { writeBrowserEvidenceManifest } from "./evidence-runner"
import { browserPreviewViewportByID } from "./viewport"
import {
  runBrowserPreviewVerification,
  type BrowserPreviewVerification,
  type BrowserPreviewVerificationCaptureJobInput,
  type BrowserPreviewVerificationCaptureJobResult,
  type BrowserPreviewVerificationInput,
} from "./verification-core"

type CaptureRuntimePage = (input: RuntimeCaptureInput) => Promise<RuntimeCaptureResult>

type BrowserPreviewVerificationTestInput = BrowserPreviewVerificationInput & {
  captureForTest: CaptureRuntimePage
}

export async function verifyBrowserPreviewForTest(
  input: BrowserPreviewVerificationTestInput,
): Promise<BrowserPreviewVerification> {
  return runBrowserPreviewVerification(input, (jobInput) =>
    captureWithTestHarness({ ...jobInput, captureForTest: input.captureForTest }),
  )
}

async function captureWithTestHarness(
  input: BrowserPreviewVerificationCaptureJobInput & { captureForTest: CaptureRuntimePage },
): Promise<BrowserPreviewVerificationCaptureJobResult> {
  const target = findBrowserPreviewTargetByID({ taskID: input.taskID, targetID: input.targetID })
  if (!target) {
    throw new Error(`Browser preview target not found: ${input.targetID}`)
  }
  const { jobID, outDir } = input
  const captures: Record<string, RuntimeCaptureResult> = {}
  const artifactPaths: string[] = []
  const diagnostics: string[] = []
  // Resolved from the same persisted target the URL comes from, so the
  // harness cannot capture a viewport the target does not declare.
  const viewports = input.viewportIDs.map((id) => browserPreviewViewportByID(target.viewports, id))
  for (const viewport of viewports) {
    const result = await input.captureForTest({
      processAuthority: { kind: "task", taskID: input.taskID, cwd: input.projectRoot },
      url: target.url,
      outDir,
      viewport_width: viewport.width,
      viewport_height: viewport.height,
      fileLabel: viewport.id,
      signal: input.signal,
    })
    captures[viewport.id] = result
    if (result.captured && result.path) artifactPaths.push(result.path)
    diagnostics.push(result.summary)
  }
  const manifest = await writeBrowserEvidenceManifest({
    outDir,
    jobID,
    taskID: input.taskID,
    targetID: input.targetID,
    url: target.url,
    viewportIDs: input.viewportIDs,
    artifactPaths,
    captures,
    diagnostics,
  })
  return { captures, manifest }
}
