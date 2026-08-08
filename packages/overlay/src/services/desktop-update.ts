import { createSignal } from "solid-js"
import { getHostTransport } from "./host-transport-runtime"
import { listenTauriEvent } from "./tauri-transport"

export interface DesktopUpdateInfo {
  currentVersion: string
  available: boolean
  version?: string
  notes?: string
  publicationDate?: string
  downloadedBytes?: number
}

export interface DesktopUpdateProgress {
  version: string
  downloadedBytes: number
  totalBytes?: number
  finished: boolean
}

const [desktopUpdateInfo, setDesktopUpdateInfo] = createSignal<DesktopUpdateInfo | null>(null)
const [desktopUpdateChecking, setDesktopUpdateChecking] = createSignal(false)
const [desktopUpdateDownloading, setDesktopUpdateDownloading] = createSignal(false)
const [desktopUpdateProgress, setDesktopUpdateProgress] = createSignal<DesktopUpdateProgress | null>(null)
const [desktopUpdateError, setDesktopUpdateError] = createSignal("")
let progressListener: Promise<void> | undefined

function nonBlank(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Desktop update ${label} is missing`)
  return value.trim()
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return nonBlank(value, label)
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") throw new Error(`Desktop update ${label} must be text`)
  return value.trim() || undefined
}

function optionalBytes(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Desktop update ${label} must be a non-negative byte count`)
  }
  return value
}

function requiredBytes(value: unknown, label: string): number {
  const bytes = optionalBytes(value, label)
  if (bytes === undefined) throw new Error(`Desktop update ${label} is missing`)
  return bytes
}

function parseDesktopUpdateInfo(value: unknown): DesktopUpdateInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Desktop update response must be an object")
  }
  const input = value as Record<string, unknown>
  const available = input.available
  if (typeof available !== "boolean") throw new Error("Desktop update availability is missing")
  const parsed: DesktopUpdateInfo = {
    currentVersion: nonBlank(input.currentVersion, "current version"),
    available,
    version: optionalString(input.version, "version"),
    notes: optionalText(input.notes, "notes"),
    publicationDate: optionalString(input.publicationDate, "publication date"),
    downloadedBytes: optionalBytes(input.downloadedBytes, "downloaded bytes"),
  }
  if (available && !parsed.version) throw new Error("Available desktop update has no version")
  return parsed
}

function parseDesktopUpdateProgress(value: unknown): DesktopUpdateProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Desktop update progress must be an object")
  }
  const input = value as Record<string, unknown>
  if (typeof input.finished !== "boolean") throw new Error("Desktop update progress completion is missing")
  return {
    version: nonBlank(input.version, "progress version"),
    downloadedBytes: requiredBytes(input.downloadedBytes, "progress bytes"),
    totalBytes: optionalBytes(input.totalBytes, "total bytes"),
    finished: input.finished,
  }
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const input = error as { message?: unknown; code?: unknown }
    if (typeof input.message === "string" && input.message.trim()) {
      return typeof input.code === "string" && input.code.trim()
        ? `${input.code.trim()}: ${input.message.trim()}`
        : input.message.trim()
    }
  }
  return error instanceof Error ? error.message : String(error)
}

async function ensureProgressListener(): Promise<void> {
  if (progressListener) return progressListener
  progressListener = listenTauriEvent<unknown>("overlay:desktop-update-progress", (event) => {
    try {
      setDesktopUpdateProgress(parseDesktopUpdateProgress(event.payload))
    } catch (error) {
      setDesktopUpdateError(errorMessage(error))
    }
  }).then(() => undefined)
  return progressListener
}

export function desktopUpdateSupported(): boolean {
  return getHostTransport().capabilities.nativeCommands["desktopUpdate.check"]
}

export async function checkDesktopUpdate(options: { background?: boolean } = {}): Promise<void> {
  if (!desktopUpdateSupported() || desktopUpdateChecking()) return
  setDesktopUpdateChecking(true)
  if (!options.background) setDesktopUpdateError("")
  try {
    await ensureProgressListener()
    const response = await getHostTransport().native({ kind: "desktopUpdate.check" })
    setDesktopUpdateInfo(parseDesktopUpdateInfo(response))
    setDesktopUpdateError("")
  } catch (error) {
    if (!options.background || desktopUpdateInfo() === null) setDesktopUpdateError(errorMessage(error))
  } finally {
    setDesktopUpdateChecking(false)
  }
}

export async function downloadDesktopUpdate(): Promise<void> {
  const version = desktopUpdateInfo()?.version
  if (!version) throw new Error("No desktop update is available to download")
  setDesktopUpdateDownloading(true)
  setDesktopUpdateProgress({ version, downloadedBytes: 0, finished: false })
  setDesktopUpdateError("")
  try {
    await ensureProgressListener()
    const response = await getHostTransport().native({ kind: "desktopUpdate.download", expectedVersion: version })
    setDesktopUpdateInfo(parseDesktopUpdateInfo(response))
  } catch (error) {
    setDesktopUpdateError(errorMessage(error))
  } finally {
    setDesktopUpdateDownloading(false)
  }
}

export async function installDesktopUpdate(): Promise<void> {
  const info = desktopUpdateInfo()
  if (!info?.version || info.downloadedBytes === undefined) {
    throw new Error("No verified desktop update is ready to install")
  }
  setDesktopUpdateError("")
  try {
    await getHostTransport().native({ kind: "desktopUpdate.install", expectedVersion: info.version })
  } catch (error) {
    setDesktopUpdateError(errorMessage(error))
  }
}

export { desktopUpdateChecking, desktopUpdateDownloading, desktopUpdateError, desktopUpdateInfo, desktopUpdateProgress }
