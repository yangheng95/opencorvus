import fs from "node:fs/promises"
import path from "node:path"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import type { RuntimeCaptureResult } from "@/runtime/capture-contract"
import { Identifier } from "@/id/id"
import z from "zod"
import type { BrowserEvidenceManifestSummary } from "./evidence-runner"
import {
  normalizeRuntimePathRefs,
  persistBrowserPreviewEvidenceBatch,
  stripRuntimePathRefs,
  type PersistBrowserPreviewEvidenceInput,
} from "./persist"
import { throwAfterBrowserPreviewPublicationCleanup } from "./publication-cleanup"
import { BrowserPreviewTarget } from "./target"
import {
  browserPreviewViewportByID,
  BrowserPreviewViewport,
  BrowserPreviewViewportID,
  BrowserPreviewViewportNotFoundError,
} from "./viewport"

export const BrowserPreviewCaptureSummary = z.object({
  captured: z.boolean(),
  passed: z.boolean(),
  url: z.string(),
  requested_viewport: z.object({
    width: z.number(),
    height: z.number(),
  }),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
    capped: z.boolean(),
  }),
  summary: z.string(),
  path: z.string().optional(),
  sha: z.string().optional(),
  bytes: z.number().optional(),
  manifest: z.unknown().optional(),
  layers: z.unknown().optional(),
  dom: z.unknown().optional(),
  capture_error: z.unknown().optional(),
})
export type BrowserPreviewCaptureSummary = z.infer<typeof BrowserPreviewCaptureSummary>

export const BrowserPreviewVerification = z.object({
  status: z.enum(["passed", "failed"]),
  projectRoot: z.string(),
  target: BrowserPreviewTarget,
  viewports: BrowserPreviewViewport.array(),
  captures: z.record(z.string(), BrowserPreviewCaptureSummary),
  evidenceIDs: z.record(z.string(), z.string()),
  diagnostics: z.string().array(),
})
export type BrowserPreviewVerification = z.infer<typeof BrowserPreviewVerification>

export type BrowserPreviewVerificationInput = {
  projectRoot: string
  target: BrowserPreviewTarget
  viewportIDs: BrowserPreviewViewportID[]
  taskID: string
  targetID: string
  signal?: AbortSignal
}

export type BrowserPreviewVerificationCaptureJobInput = {
  projectRoot: string
  jobID: string
  taskID: string
  targetID: string
  url: string
  outDir: string
  viewports: BrowserPreviewViewport[]
  viewportIDs: BrowserPreviewViewportID[]
  signal?: AbortSignal
}

export type BrowserPreviewVerificationCaptureJobResult = {
  captures: Record<string, RuntimeCaptureResult>
  manifest: BrowserEvidenceManifestSummary
}

export type BrowserPreviewVerificationCaptureJob = (
  input: BrowserPreviewVerificationCaptureJobInput,
) => Promise<BrowserPreviewVerificationCaptureJobResult>

export async function runBrowserPreviewVerification(
  input: BrowserPreviewVerificationInput,
  captureJob: BrowserPreviewVerificationCaptureJob,
): Promise<BrowserPreviewVerification> {
  const projectRoot = path.resolve(input.projectRoot)
  const viewportIDs = input.viewportIDs
  if (new Set(viewportIDs).size !== viewportIDs.length) {
    throw new Error("Browser preview verification viewport IDs must be unique.")
  }
  if (viewportIDs.length === 0) {
    return {
      status: "failed",
      projectRoot,
      target: input.target,
      viewports: [],
      captures: {},
      evidenceIDs: {},
      diagnostics: [
        "Preview verification requires at least one browser preview viewport.",
        ...input.target.diagnostics,
      ],
    }
  }
  if (!input.taskID || !input.targetID) {
    return {
      status: "failed",
      projectRoot,
      target: input.target,
      viewports: [],
      captures: {},
      evidenceIDs: {},
      diagnostics: [
        "Preview verification requires a task ID and persisted browser preview target ID.",
        ...input.target.diagnostics,
      ],
    }
  }
  if (!input.target.url) {
    return {
      status: "failed",
      projectRoot,
      target: input.target,
      viewports: [],
      captures: {},
      evidenceIDs: {},
      diagnostics: ["Preview verification requires a resolved http(s) URL.", ...input.target.diagnostics],
    }
  }
  let viewports: BrowserPreviewViewport[]
  try {
    viewports = viewportIDs.map((id) => browserPreviewViewportByID(input.target.viewports, id))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: "failed",
      projectRoot,
      target: input.target,
      viewports: [],
      captures: {},
      evidenceIDs: {},
      diagnostics: [
        message,
        ...(error instanceof BrowserPreviewViewportNotFoundError
          ? [`Persisted browser preview target ${input.targetID} does not define viewport ${error.viewportID}.`]
          : []),
        ...input.target.diagnostics,
      ],
    }
  }

  const jobID = Identifier.ascending("artifact")
  const outDir = ProjectRuntimePaths.browserPreviewJobRoot(projectRoot, input.taskID, jobID)
  await fs.mkdir(ProjectRuntimePaths.taskRoot(projectRoot, input.taskID), { recursive: true })
  const preparedDir = await fs.mkdtemp(
    path.join(ProjectRuntimePaths.taskRoot(projectRoot, input.taskID), ".browser-preview-verification-preparing-"),
  )
  let published = false
  try {
    const prepared = await captureJob({
      projectRoot,
      jobID,
      taskID: input.taskID,
      targetID: input.targetID,
      url: input.target.url,
      outDir: preparedDir,
      viewports,
      viewportIDs,
      signal: input.signal,
    })
    for (const viewportID of viewportIDs) {
      if (!prepared.captures[viewportID]) {
        throw new Error(`Browser preview evidence runner did not return viewport ${viewportID}`)
      }
    }
    await fs.mkdir(path.dirname(outDir), { recursive: true })
    await fs.rename(preparedDir, outDir)
    published = true
    const { captures, manifest } = rebaseVerificationJob(prepared, preparedDir, outDir)
    const diagnostics = viewports.map(
      (viewport) => captures[viewport.id]?.summary ?? `missing capture for ${viewport.id}`,
    )
    await fs.writeFile(
      manifest.manifestPath,
      JSON.stringify({ ...manifest, url: input.target.url, captures, diagnostics }, null, 2),
      "utf8",
    )
    const evidenceIDs: Record<string, string> = {}
    const evidenceEntries: { id: string; input: PersistBrowserPreviewEvidenceInput }[] = []
    const responseCaptures: Record<string, BrowserPreviewCaptureSummary> = {}
    for (const viewport of viewports) {
      const result = captures[viewport.id]
      if (!result) continue
      responseCaptures[viewport.id] = normalizeRuntimePathRefs(projectRoot, {
        ...result,
        manifest,
      }) as BrowserPreviewCaptureSummary
      const persistenceCapture = normalizeRuntimePathRefs(
        projectRoot,
        result,
      ) as BrowserPreviewCaptureSummary
      const status = result.captured && result.passed ? "passed" : "failed"
      const evidenceID = Identifier.ascending("artifact")
      evidenceIDs[viewport.id] = evidenceID
      evidenceEntries.push({
        id: evidenceID,
        input: {
          projectRoot,
          taskID: input.taskID,
          targetID: input.targetID,
          viewportID: viewport.id,
          operationKind: "preview-capture",
          manifestPath: manifest.manifestPath,
          status,
          summary: result.summary,
          capture: persistenceCapture,
          diagnostics: [result.summary],
        },
      })
    }
    await persistBrowserPreviewEvidenceBatch(evidenceEntries)
    const status = viewports.every((viewport) => {
      const result = captures[viewport.id]
      return result?.captured && result.passed
    })
      ? "passed"
      : "failed"

    return {
      status,
      projectRoot,
      target: { ...input.target, latestEvidenceIDs: evidenceIDs },
      viewports,
      captures: stripRuntimePathRefs(responseCaptures) as Record<string, BrowserPreviewCaptureSummary>,
      evidenceIDs,
      diagnostics,
    }
  } catch (error) {
    return await throwAfterBrowserPreviewPublicationCleanup({
      primaryFailure: error,
      residualPath: published ? outDir : preparedDir,
    })
  }
}

function rebaseVerificationJob(
  input: BrowserPreviewVerificationCaptureJobResult,
  preparedDir: string,
  outDir: string,
): BrowserPreviewVerificationCaptureJobResult {
  const captures = Object.fromEntries(
    Object.entries(input.captures).map(([viewportID, capture]) => {
      if (!capture.captured) return [viewportID, capture]
      return [
        viewportID,
        {
          ...capture,
          path: rebaseVerificationJobPath(capture.path, preparedDir, outDir),
          layers: {
            ...capture.layers,
            pixel: {
              ...capture.layers.pixel,
              screenshot_path: rebaseVerificationJobPath(capture.layers.pixel.screenshot_path, preparedDir, outDir),
            },
          },
        },
      ]
    }),
  )
  return {
    captures,
    manifest: {
      ...input.manifest,
      manifestPath: rebaseVerificationJobPath(input.manifest.manifestPath, preparedDir, outDir),
      operations: input.manifest.operations.map((operation) => ({
        ...operation,
        artifactPaths: operation.artifactPaths.map((artifactPath) =>
          rebaseVerificationJobPath(artifactPath, preparedDir, outDir),
        ),
        diagnosticsPath: rebaseVerificationJobPath(operation.diagnosticsPath, preparedDir, outDir),
      })),
    },
  }
}

function rebaseVerificationJobPath(value: string, preparedDir: string, outDir: string): string {
  const relative = path.relative(preparedDir, path.resolve(value))
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Browser preview verification returned a path outside its preparation directory: ${value}`)
  }
  return path.join(outDir, relative)
}
