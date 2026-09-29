import { artifactFilename, type ArtifactExport } from "./artifact-export"
import { fetchResourceAsObjectUrl } from "./api"

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = artifactFilename(filename)
  anchor.rel = "noopener"
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function artifactExportBlob(file: ArtifactExport): Promise<Blob> {
  if ("text" in file)
    return new Blob([file.mime.startsWith("text/csv") ? "\uFEFF" : "", file.text], { type: file.mime })
  const url = await fetchResourceAsObjectUrl(file.url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`File download failed with HTTP ${response.status}`)
  return response.blob()
}
