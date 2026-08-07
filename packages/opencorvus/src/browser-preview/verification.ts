import {
  runBrowserPreviewVerification,
  type BrowserPreviewVerification,
  type BrowserPreviewVerificationCaptureJobInput,
  type BrowserPreviewVerificationCaptureJobResult,
  type BrowserPreviewVerificationInput,
} from "./verification-core"
import { runBrowserPreviewEvidenceJob } from "./evidence-runner"

export * from "./verification-core"

export async function verifyBrowserPreview(
  input: BrowserPreviewVerificationInput,
): Promise<BrowserPreviewVerification> {
  return runBrowserPreviewVerification(input, captureWithBrowserEvidenceRunner)
}

async function captureWithBrowserEvidenceRunner(
  input: BrowserPreviewVerificationCaptureJobInput,
): Promise<BrowserPreviewVerificationCaptureJobResult> {
  const job = await runBrowserPreviewEvidenceJob({
    projectRoot: input.projectRoot,
    jobID: input.jobID,
    taskID: input.taskID,
    targetID: input.targetID,
    outDir: input.outDir,
    viewportIDs: input.viewportIDs,
    signal: input.signal,
  })
  for (const viewportID of input.viewportIDs) {
    if (!job.captures[viewportID]) {
      throw new Error(`Browser preview evidence runner did not return viewport ${viewportID}`)
    }
  }
  return { captures: job.captures, manifest: job.manifest }
}
