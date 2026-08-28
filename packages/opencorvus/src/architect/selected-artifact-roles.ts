import {
  artifactReadLocatorKey,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import {
  parseGoalGraphProjectionArtifact,
  parseRequirementSetArtifact,
  type ArtifactRow,
  type GoalGraphProjectionArtifactRow,
  type RequirementSetArtifactRow,
} from "@/engine/store"

export type ArchitectSelectedEngineArtifact = {
  locator: EngineArtifactLocator
  artifact: ArtifactRow
}

export type ArchitectSelectedArtifactRoles = {
  engineArtifacts: ArchitectSelectedEngineArtifact[]
  requirementSet?: {
    locator: EngineArtifactLocator
    artifact: RequirementSetArtifactRow
  }
  currentGoalGraphProjection?: {
    locator: EngineArtifactLocator
    artifact: GoalGraphProjectionArtifactRow
  }
}

/**
 * Resolve semantic Architect input roles from consumer-owned selections.
 *
 * Artifact kind is not a role: current GoalGraph projections, historical
 * projections, and projection:null Candidates intentionally share one kind.
 * Only the selected locator that exactly equals the unique executable current
 * tip may seed the collector or become the next projection's prior. Every
 * other selected Artifact remains a provenance source.
 */
export function resolveArchitectSelectedArtifactRoles(input: {
  taskID: string
  sourceArtifactLocators: readonly ArtifactReadLocator[]
  /**
   * Exact executable Projection locator that is current when roles are
   * resolved immediately before first output. The callback is lazy so
   * Candidate-only or requirement-only selections never consult an
   * unselected GoalGraph current tip, and a Turn-start Projection that became
   * historical before selection can never seed the collector.
   */
  eligiblePriorGoalGraphProjectionArtifactLocators: () => readonly EngineArtifactLocator[]
}): ArchitectSelectedArtifactRoles {
  const engineArtifacts = input.sourceArtifactLocators.flatMap((locator) =>
    locator.source === "engine_artifact"
      ? [{ locator, artifact: requireEngineArtifactByLocator({ taskID: input.taskID, locator }) }]
      : [],
  )
  const requirementSets = engineArtifacts
    .filter(({ artifact }) => artifact.kind === "requirement_set")
    .map(({ locator, artifact }) => ({
      locator,
      artifact: parseRequirementSetArtifact(artifact),
    }))
  if (requirementSets.length > 1) {
    throw new Error("Architect selected multiple requirement_set Artifacts as one authoritative source.")
  }

  const selectedGoalGraphProjections = engineArtifacts
    .filter(({ artifact }) => artifact.kind === "goal_graph_projection")
    .map(({ locator, artifact }) => ({
      locator,
      artifact: parseGoalGraphProjectionArtifact(artifact),
    }))
  const selectedExecutableGoalGraphKeys = new Set(
    selectedGoalGraphProjections
      .filter(({ artifact }) => artifact.payload.projection !== null)
      .map(({ locator }) => artifactReadLocatorKey(locator)),
  )
  if (selectedExecutableGoalGraphKeys.size === 0) {
    return {
      engineArtifacts,
      ...(requirementSets[0] ? { requirementSet: requirementSets[0] } : {}),
    }
  }

  const eligiblePriorLocators =
    input.eligiblePriorGoalGraphProjectionArtifactLocators()
  let currentGoalGraphProjection: ArchitectSelectedArtifactRoles["currentGoalGraphProjection"]
  for (const eligible of eligiblePriorLocators) {
    const eligibleKey = artifactReadLocatorKey(eligible)
    if (!selectedExecutableGoalGraphKeys.has(eligibleKey)) continue
    const selected = selectedGoalGraphProjections.find(
      ({ locator }) => artifactReadLocatorKey(locator) === eligibleKey,
    )
    if (!selected) continue
    currentGoalGraphProjection = selected
    break
  }
  return {
    engineArtifacts,
    ...(requirementSets[0] ? { requirementSet: requirementSets[0] } : {}),
    ...(currentGoalGraphProjection ? { currentGoalGraphProjection } : {}),
  }
}
