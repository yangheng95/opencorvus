import fs from "node:fs/promises"
import path from "node:path"
import { Session } from "@/session"
import { AttachmentStore } from "@/storage/attachment-store"
import { FRONTEND_RESEARCH_BRIEF_PRODUCER } from "@/engine/artifact-catalog-constants"
import { publishEngineArtifactResources, type TaskArtifactReadAuthority } from "@/task-artifact/store"
import type { ResearchBrief } from "./schema"
import type { FrontendResearchVisualEvidence } from "./frontend-research-artifact"

type BrowserScreenshotObservation = Omit<FrontendResearchVisualEvidence, "resource_index" | "evidence_ids"> & {
  source_path: string
  resource_path: string
}

export type FrontendResearchArtifactResourcePublication = Readonly<{
  authority: TaskArtifactReadAuthority
  publication: Awaited<ReturnType<typeof publishEngineArtifactResources>>
  resourceRoles: {
    full_markdown: number
    evidence_json: number
    citation_map: number
  }
  visualEvidence: FrontendResearchVisualEvidence[]
}>

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined
}

function optionalNonnegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined
}

async function collectBrowserScreenshotObservations(input: {
  projectID: string
  sessionID: string
  resourceDirectory: string
}): Promise<BrowserScreenshotObservation[]> {
  const messages = await Session.messages({ sessionID: input.sessionID })
  const observations = new Map<string, BrowserScreenshotObservation>()
  await fs.mkdir(input.resourceDirectory, { recursive: true })
  for (const message of messages) {
    if (message.info.role !== "assistant") continue
    for (const part of message.parts) {
      if (part.type !== "tool" || part.state.status !== "completed") continue
      const browser = record(part.state.metadata.browser)
      const screenshot = record(browser?.screenshot)
      const attachmentUrl = optionalString(screenshot?.attachmentUrl)
      const mimeType = optionalString(screenshot?.mimeType)
      if (!attachmentUrl || !mimeType?.startsWith("image/")) continue
      if (observations.has(attachmentUrl)) continue

      const reference = await AttachmentStore.requireReference({
        projectID: input.projectID,
        url: attachmentUrl,
        mime: mimeType,
      })
      const located = AttachmentStore.nameFromUrl(reference.url)
      if (!located) {
        throw new Error(`Frontend Research screenshot URL is not canonical: ${reference.url}`)
      }
      const sourceAttachmentPath = AttachmentStore.resolveAbsolute(located.projectID, located.name)
      if (!sourceAttachmentPath) {
        throw new Error(`Frontend Research screenshot is not resolvable: ${reference.url}`)
      }
      const sourcePath = path.join(input.resourceDirectory, located.name)
      await fs.copyFile(sourceAttachmentPath, sourcePath)

      const viewport = record(browser?.viewport)
      const diagnostics = record(browser?.diagnostics)
      const pageURL = optionalString(browser?.url)
      const pageTitle = optionalString(browser?.title)
      const viewportWidth = optionalPositiveInteger(viewport?.width)
      const viewportHeight = optionalPositiveInteger(viewport?.height)
      const screenshotWidth = optionalPositiveInteger(screenshot?.width)
      const screenshotHeight = optionalPositiveInteger(screenshot?.height)
      const consoleErrors = optionalNonnegativeInteger(diagnostics?.consoleErrors)
      const pageErrors = optionalNonnegativeInteger(diagnostics?.pageErrors)
      const failedRequests = optionalNonnegativeInteger(diagnostics?.failedRequests)
      const httpErrors = optionalNonnegativeInteger(diagnostics?.httpErrors)
      observations.set(attachmentUrl, {
        attachment_url: attachmentUrl,
        source_path: sourcePath,
        resource_path: `screenshots/${located.name}`,
        ...(pageURL ? { page_url: pageURL } : {}),
        ...(pageTitle ? { page_title: pageTitle } : {}),
        ...(viewport
          ? {
              viewport: {
                ...(viewportWidth !== undefined ? { width: viewportWidth } : {}),
                ...(viewportHeight !== undefined ? { height: viewportHeight } : {}),
              },
            }
          : {}),
        screenshot: {
          mime_type: reference.mime,
          ...(screenshotWidth !== undefined ? { width: screenshotWidth } : {}),
          ...(screenshotHeight !== undefined ? { height: screenshotHeight } : {}),
          sha256: reference.sha,
        },
        ...(diagnostics
          ? {
              diagnostics: {
                ...(consoleErrors !== undefined ? { console_errors: consoleErrors } : {}),
                ...(pageErrors !== undefined ? { page_errors: pageErrors } : {}),
                ...(failedRequests !== undefined ? { failed_requests: failedRequests } : {}),
                ...(httpErrors !== undefined ? { http_errors: httpErrors } : {}),
              },
            }
          : {}),
      })
    }
  }
  return [...observations.values()]
}

export async function publishFrontendResearchArtifactResources(input: {
  projectID: string
  projectDirectory: string
  taskID: string
  sessionID: string
  brief: ResearchBrief
}): Promise<FrontendResearchArtifactResourcePublication> {
  const bundleFiles = [
    {
      sourcePath: path.resolve(input.projectDirectory, input.brief.bundle.full_markdown_path),
      resourcePath: "bundle/research-bundle.md",
      mediaType: "text/markdown",
    },
    {
      sourcePath: path.resolve(input.projectDirectory, input.brief.bundle.evidence_json_path),
      resourcePath: "bundle/evidence.json",
      mediaType: "application/json",
    },
    {
      sourcePath: path.resolve(input.projectDirectory, input.brief.bundle.citation_map_path),
      resourcePath: "bundle/citation-map.json",
      mediaType: "application/json",
    },
  ] as const
  const resourceDirectory = path.join(path.dirname(bundleFiles[0].sourcePath), "visual-evidence")
  const screenshots = await collectBrowserScreenshotObservations({
    projectID: input.projectID,
    sessionID: input.sessionID,
    resourceDirectory,
  })
  const publication = await publishEngineArtifactResources({
    projectID: input.projectID,
    projectDirectory: input.projectDirectory,
    taskID: input.taskID,
    producer: FRONTEND_RESEARCH_BRIEF_PRODUCER,
    files: [
      ...bundleFiles,
      ...screenshots.map((screenshot) => ({
        sourcePath: screenshot.source_path,
        resourcePath: screenshot.resource_path,
        mediaType: screenshot.screenshot.mime_type,
      })),
    ],
  })
  const visualEvidence = screenshots.map((screenshot, screenshotIndex) => ({
    resource_index: bundleFiles.length + screenshotIndex,
    attachment_url: screenshot.attachment_url,
    evidence_ids: input.brief.evidence_index
      .filter((evidence) => evidence.pointer.includes(screenshot.attachment_url))
      .map((evidence) => evidence.id),
    ...(screenshot.page_url ? { page_url: screenshot.page_url } : {}),
    ...(screenshot.page_title ? { page_title: screenshot.page_title } : {}),
    ...(screenshot.viewport ? { viewport: screenshot.viewport } : {}),
    screenshot: screenshot.screenshot,
    ...(screenshot.diagnostics ? { diagnostics: screenshot.diagnostics } : {}),
  }))
  return {
    authority: {
      projectID: input.projectID,
      projectDirectory: input.projectDirectory,
      taskID: input.taskID,
    },
    publication,
    resourceRoles: {
      full_markdown: 0,
      evidence_json: 1,
      citation_map: 2,
    },
    visualEvidence,
  }
}
