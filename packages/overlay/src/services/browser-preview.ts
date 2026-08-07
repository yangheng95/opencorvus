import { ApiError, apiJson, apiRequest } from "./api"
import { bytesToArrayBuffer } from "../utils/binary"
import type { BrowserPreviewReadTaskEvidenceResponses, BrowserPreviewTaskTargetResponses } from "@opencorvus-ai/sdk"
import { createSignal } from "solid-js"

export type BrowserPreviewTarget = BrowserPreviewTaskTargetResponses[200]
export type BrowserPreviewEvidence = BrowserPreviewReadTaskEvidenceResponses[200]
export type BrowserPreviewViewport = BrowserPreviewTarget["viewports"][number]
export type BrowserPreviewViewportID = BrowserPreviewViewport["id"]

const [browserPreviewRevision, setBrowserPreviewRevision] = createSignal(0)
const latestBrowserPreviewSequenceByTask = new Map<string, number>()

export { browserPreviewRevision }

export function bumpBrowserPreviewRevision(): void {
  setBrowserPreviewRevision((current) => current + 1)
}

export function clearBrowserPreviewRevisionCursors(): void {
  latestBrowserPreviewSequenceByTask.clear()
}

export function isBrowserPreviewUpdateEvent(event: unknown): boolean {
  if (!event || typeof event !== "object" || Array.isArray(event)) return false
  const candidate = event as { type?: unknown; source?: unknown }
  return (
    candidate.type === "task.updated" &&
    (candidate.source === "browser-preview.target" || candidate.source === "browser-preview.evidence")
  )
}

export function observeBrowserPreviewUpdateEvent(event: {
  taskID: string
  sequence: number
  source?: unknown
  type?: unknown
}): boolean {
  if (!isBrowserPreviewUpdateEvent(event)) {
    throw new Error("Browser Preview revision requires an exact domain event")
  }
  const taskID = String(event.taskID || "").trim()
  const sequence = Number(event.sequence)
  if (!taskID || !Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Browser Preview domain event requires taskID and a positive protocol sequence")
  }
  const current = latestBrowserPreviewSequenceByTask.get(taskID) ?? 0
  if (sequence <= current) return false
  latestBrowserPreviewSequenceByTask.set(taskID, sequence)
  bumpBrowserPreviewRevision()
  return true
}

function taskBrowserPreviewPath(taskID: string, directory: string, suffix = ""): string {
  const dir = directory.trim()
  if (!dir) throw new Error("browser preview service requires a task directory")
  const query = new URLSearchParams({ directory: dir })
  return `task/${encodeURIComponent(taskID)}/browser-preview${suffix}?${query.toString()}`
}

export async function loadTaskBrowserPreviewTarget(input: {
  taskID: string
  directory: string
  signal?: AbortSignal
}): Promise<BrowserPreviewTarget> {
  return apiJson<BrowserPreviewTarget>(taskBrowserPreviewPath(input.taskID, input.directory), {
    signal: input.signal,
  })
}

export async function loadTaskBrowserPreviewEvidence(input: {
  taskID: string
  directory: string
  evidenceID: string
  signal?: AbortSignal
}): Promise<BrowserPreviewEvidence> {
  return apiJson<BrowserPreviewEvidence>(
    taskBrowserPreviewPath(input.taskID, input.directory, `/evidence/${encodeURIComponent(input.evidenceID)}`),
    { signal: input.signal },
  )
}

export async function loadTaskBrowserPreviewEvidenceCaptureObjectUrl(input: {
  taskID: string
  directory: string
  evidenceID: string
  signal?: AbortSignal
}): Promise<string> {
  const path = taskBrowserPreviewPath(
    input.taskID,
    input.directory,
    `/evidence/${encodeURIComponent(input.evidenceID)}/capture.png`,
  )
  const response = await apiRequest<Uint8Array>(path, {
    responseKind: "binary",
    signal: input.signal,
  })
  if (!response.ok) throw new ApiError(response.status, path, decodeBinaryBrowserPreviewErrorBody(response.body))
  const contentType = response.headers["content-type"] || response.headers["Content-Type"] || "image/png"
  return URL.createObjectURL(new Blob([bytesToArrayBuffer(response.body)], { type: contentType }))
}

function decodeBinaryBrowserPreviewErrorBody(body: Uint8Array): unknown {
  const text = new TextDecoder().decode(body).trim()
  if (!text) return body
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
