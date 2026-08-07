export const DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT = {
  width: 1440,
  height: 900,
} as const

export type WebpageEvidenceViewport = {
  width: number
  height: number
}

export function defaultWebpageEvidenceViewport(): WebpageEvidenceViewport {
  return { ...DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT }
}

export function describeDefaultWebpageEvidenceViewport(): string {
  return `${DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT.width}x${DEFAULT_WEBPAGE_EVIDENCE_VIEWPORT.height}`
}
