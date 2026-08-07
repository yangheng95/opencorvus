export function parseVisualQaReferenceRegionKey(key: string): { regionID: string; viewportID: string } | { issue: string } {
  const [regionID, viewportID, extra] = key.split("@")
  if (extra !== undefined || !regionID?.trim() || !viewportID?.trim()) {
    return {
      issue: `reference region "${key}" must use the exact format region_id@viewport_id, for example region_header@desktop.`,
    }
  }
  return { regionID: regionID.trim(), viewportID: viewportID.trim() }
}

export function normalizeVisualQaReferenceRegionKey(key: string, context: string): string {
  const parsed = parseVisualQaReferenceRegionKey(key)
  if ("issue" in parsed) throw new Error(`${context}: ${parsed.issue}`)
  return `${parsed.regionID}@${parsed.viewportID}`
}
