/**
 * SQLite substr() counts Unicode code points, while JavaScript String.slice()
 * counts UTF-16 code units. Engine Artifact catalog identities use code points
 * so astral characters have one identical meaning in the writer, transfer
 * verifier, catalog SQL, and DDL (Data Definition Language) triggers.
 */
export const ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS = 513

export const BROWSER_PREVIEW_EVIDENCE_ARTIFACT_TYPE =
  "opencorvus/browser-preview-evidence" as const

export const FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE =
  "opencorvus/core/frontend-research-brief" as const

export const FRONTEND_RESEARCH_BRIEF_PRODUCER = {
  owner_kind: "core" as const,
  component_id: "frontend-research",
  operation_id: "persist-research-brief",
}

export function engineArtifactCatalogLabelIndex(label: string): string {
  let result = ""
  let codePoints = 0
  for (const codePoint of label) {
    if (codePoints === ENGINE_ARTIFACT_CATALOG_LABEL_INDEX_CODE_POINTS) break
    result += codePoint
    codePoints += 1
  }
  return result
}
