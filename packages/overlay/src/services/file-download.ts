import { artifactFilename, type ArtifactExport } from "./artifact-export"
import { ApiAuthorityChangedError, assertApiAuthorityCurrent, captureResourceAuthority, fetchResourceAsObjectUrl, type ApiAuthority } from "./api"

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = artifactFilename(filename)
  anchor.rel = "noopener"
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function artifactExportBlob(
  file: ArtifactExport,
  options: { authority?: ApiAuthority; signal?: AbortSignal } = {},
): Promise<Blob> {
  options.signal?.throwIfAborted()
  if ("text" in file)
    return new Blob([file.mime.startsWith("text/csv") ? "\uFEFF" : "", file.text], { type: file.mime })
  const authority = captureResourceAuthority(file.url, options.authority)
  try {
    const url = await fetchResourceAsObjectUrl(file.url, { authority, signal: options.signal })
    if (authority) assertApiAuthorityCurrent(authority)
    options.signal?.throwIfAborted()
    const response = await fetch(url, { signal: options.signal })
    if (authority) assertApiAuthorityCurrent(authority)
    options.signal?.throwIfAborted()
    if (!response.ok) throw new Error(`File download failed with HTTP ${response.status}`)
    const blob = await response.blob()
    if (authority) assertApiAuthorityCurrent(authority)
    options.signal?.throwIfAborted()
    return blob
  } catch (error) {
    if (error instanceof ApiAuthorityChangedError) throw error
    if (authority) assertApiAuthorityCurrent(authority, { phase: "transport_failure", cause: error })
    throw error
  }
}
