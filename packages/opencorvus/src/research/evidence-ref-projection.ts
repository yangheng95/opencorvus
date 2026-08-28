import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import type { ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { ResearchBriefSchema } from "./schema"
import { parseFrontendResearchBriefArtifactEnvelope } from "./frontend-research-artifact"
import type { Database } from "@/storage/db"

export type ResearchEvidenceSource = "deep_research" | "frontend_research"

function scopedResearchEvidenceRef(source: ResearchEvidenceSource, evidenceID: string): string {
  return `${source}:${evidenceID}`
}

/**
 * Resolve output-validation references only from the exact Research Artifacts
 * observed and selected by the current consumer. The caller-owned locators are
 * the sole input; this function never enumerates Task research or renders an
 * Artifact body into another Agent's prompt.
 */
export function researchEvidenceRefsForArtifactLocators(input: {
  db?: Database.TxOrDb
  taskID: string
  artifactLocators: readonly ArtifactReadLocator[]
}): string[] {
  return input.artifactLocators.flatMap((locator) => {
    if (locator.source !== "engine_artifact") return []
    const artifact = requireEngineArtifactByLocator({ db: input.db, taskID: input.taskID, locator })
    if (artifact.kind !== "research_brief" && artifact.kind !== "frontend_research_brief") return []
    const brief =
      artifact.kind === "frontend_research_brief"
        ? parseFrontendResearchBriefArtifactEnvelope(artifact.payload).payload.brief
        : ResearchBriefSchema.parse(artifact.payload)
    const source = artifact.kind === "research_brief" ? "deep_research" : "frontend_research"
    return brief.evidence_index.map((item) =>
      scopedResearchEvidenceRef(
        source,
        `${locator.artifact_id}@${locator.expected_sha256}:${item.id}`,
      ),
    )
  })
}
