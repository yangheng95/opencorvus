import { parseAcceptanceSpecs, renderSpecsAsText } from "@/acceptance/types"
import { requireEngineArtifactByLocator } from "@/engine/engine-artifact-version-facts"
import {
  parseRequirementSetArtifact,
  resolveCurrentGoalMembershipContext,
  requireTask,
  viewBuildHostObservationArtifact,
  viewTask,
} from "@/engine/store"
import type { GoalContractFields } from "@/pipeline/types"
import { requirementIDsFromAcceptanceSpecs } from "@/requirements/traceability"
import type { ParsedRequirement } from "@/requirements/types"
import type {
  ArtifactReadLocator,
  EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import type { BuildFileObservation } from "@/snapshot/types"

export type IntegrityFactSelection = {
  taskID: string
  goalIDs: readonly string[]
  artifactLocators: readonly ArtifactReadLocator[]
  attachmentRefs: readonly string[]
}

export type IntegrityPromptProjection = {
  instruction: string
  taskID: string
  taskTitle: string
  userRequest: string
  goals: GoalContractFields[]
  requirements: ParsedRequirement[]
  attachments: Array<{ sha: string; url: string; mime: string; size: number; filename?: string }>
  hostObservationLocators: EngineArtifactLocator[]
  changedFiles: string[]
  contextSections: string[]
}

export type IntegrityEvidenceProjection = IntegrityPromptProjection & {
  diffs: BuildFileObservation[]
}

export type IntegrityPersistenceRefs = {
  goalIDs: string[]
  requirementSetArtifactLocators: EngineArtifactLocator[]
  contractGraphArtifactLocators: EngineArtifactLocator[]
  evidenceArtifactLocators: ArtifactReadLocator[]
  phase: "pre_build" | "post_build"
}

/**
 * Rebuilds the identity-free Integrity prompt read model from exact durable
 * refs. The returned object is call-local and is never a dispatch or
 * persistence authority.
 */
export function projectIntegrityPromptFacts(
  input: IntegrityFactSelection & { instruction: string },
): IntegrityPromptProjection {
  const { diffs: _hostDiffs, ...promptProjection } = projectIntegrityEvidenceFacts(input)
  return promptProjection
}

/**
 * Resolves exact Host-observed diffs only for the read-only drilldown tool.
 * No caller supplies or persists a second diff payload.
 */
export function projectIntegrityEvidenceFacts(
  input: IntegrityFactSelection & { instruction: string },
): IntegrityEvidenceProjection {
  const task = requireTask(input.taskID)
  const engineLocators = input.artifactLocators.filter(
    (locator): locator is Extract<ArtifactReadLocator, { source: "engine_artifact" }> =>
      locator.source === "engine_artifact",
  )
  const requestedGoalIDSet = new Set(input.goalIDs)
  const currentMembership = resolveCurrentGoalMembershipContext(input.taskID)
  const goalContexts = currentMembership.goals.filter(({ goal }) =>
    requestedGoalIDSet.has(goal.id),
  )
  const goals = goalContexts.map(({ goal, membershipIndex }) => ({
    ...goal,
    order_index: membershipIndex,
  }))
  const selectedArtifactVersions = uniqueEngineArtifactLocators(engineLocators).map((locator) => ({
    locator,
    artifact: requireEngineArtifactByLocator({ taskID: input.taskID, locator }),
  }))
  const selectedArtifacts = selectedArtifactVersions.map(({ artifact }) => artifact)
  const missingGoalIDs = input.goalIDs.filter((goalID) => !goals.some((goal) => goal.id === goalID))
  if (missingGoalIDs.length > 0) {
    throw new Error(`Integrity selected missing Goal IDs: ${missingGoalIDs.join(", ")}`)
  }

  const selectedRequirementSets = selectedArtifacts
    .filter((artifact) => artifact.kind === "requirement_set")
    .map(parseRequirementSetArtifact)
  const requirementSets = selectedRequirementSets.filter(
    (artifact, index, artifacts) =>
      artifacts.findIndex(
        (candidate) =>
          candidate.id === artifact.id &&
          candidate.payload_sha256 === artifact.payload_sha256,
      ) === index,
  )
  const selectedGoalRequirementIDs =
    input.goalIDs.length > 0
      ? new Set(
          goals.flatMap((goal) =>
            requirementIDsFromAcceptanceSpecs(
              parseAcceptanceSpecs(goal.acceptance_specs, `goal ${goal.id} acceptance_specs`),
            ),
          ),
        )
      : undefined
  const scopedRequirements = requirementSets.flatMap((artifact) =>
    selectedGoalRequirementIDs
      ? artifact.payload.requirements.filter((requirement) =>
          selectedGoalRequirementIDs.has(requirement.id),
        )
      : artifact.payload.requirements,
  )
  const buildHostObservationVersions = selectedArtifactVersions.filter(
    ({ artifact }) => artifact.kind === "build_host_observation",
  )
  const buildHostObservationArtifacts = buildHostObservationVersions.map(({ artifact }) => artifact)
  const buildHostObservations = buildHostObservationArtifacts.map(viewBuildHostObservationArtifact)
  const diffs = buildHostObservations.flatMap((observation) => observation.diffs)
  const hostObservationLocators = buildHostObservationVersions.map(({ locator }) => locator)

  const taskAttachments = viewTask(task).attachments ?? []
  const attachments = unique(input.attachmentRefs).flatMap((attachmentRef) => {
    const attachment = taskAttachments.find(
      (candidate) => candidate.url === attachmentRef || candidate.sha === attachmentRef,
    )
    return attachment ? [attachment] : []
  })
  const missingAttachmentRefs = input.attachmentRefs.filter(
    (attachmentRef) =>
      !attachments.some((attachment) => attachment.url === attachmentRef || attachment.sha === attachmentRef),
  )
  if (missingAttachmentRefs.length > 0) {
    throw new Error(`Integrity selected missing attachment refs: ${missingAttachmentRefs.join(", ")}`)
  }

  const contextSections = [
    `Exact Goal refs selected for this review: ${input.goalIDs.map((goalID) => `goal:${goalID}`).join(", ") || "(none)"}.`,
    `Exact attachment refs selected for this review: ${input.attachmentRefs.join(", ") || "(none)"}.`,
    "Search the same-Task Artifact catalog yourself by exact name/kind, current or historical version, recency, and fuzzy relevance. Pass each candidate's artifact_locator_ref to artifact_read until complete, then pass artifact_read_ref to artifact_select for every Artifact that semantically supports the IntegrityReview. Complete but unselected reads remain observations and zero selections are valid; no upstream participant selected or copied Artifact bodies into this prompt.",
    ...(goals.length === 0 ? ["No Goal facts are available in the requested scope."] : []),
    ...(selectedGoalRequirementIDs
      ? [
          `Delivery Slice Requirement IDs: ${[...selectedGoalRequirementIDs].join(", ") || "(none)"}. ` +
            "Requirements outside these exact Goal acceptance sources were not projected.",
        ]
      : []),
  ]

  return {
    instruction: input.instruction,
    taskID: input.taskID,
    taskTitle: task.title,
    userRequest: task.request,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      objective: goal.objective,
      acceptance_specs: parseAcceptanceSpecs(goal.acceptance_specs, `goal ${goal.id} acceptance_specs`),
      owned_paths: stringArray(goal.owned_paths, `goal ${goal.id} owned_paths`),
      priority: goal.priority as "blocking" | "advisory",
      kind: goal.kind,
    })),
    requirements: scopedRequirements,
    attachments,
    hostObservationLocators,
    changedFiles: unique(buildHostObservations.flatMap((observation) => observation.changed_files)),
    diffs,
    contextSections,
  }
}

export function integrityPersistenceRefs(input: IntegrityFactSelection): IntegrityPersistenceRefs {
  const engineLocators = input.artifactLocators.filter(
    (locator): locator is Extract<ArtifactReadLocator, { source: "engine_artifact" }> =>
      locator.source === "engine_artifact",
  )
  const requestedGoalIDSet = new Set(input.goalIDs)
  const currentMembership = resolveCurrentGoalMembershipContext(input.taskID)
  const goals = currentMembership.goals
    .filter(({ goal }) => requestedGoalIDSet.has(goal.id))
    .map(({ goal }) => goal)
  const selectedArtifactVersions = uniqueEngineArtifactLocators(engineLocators).map((locator) => ({
    locator,
    artifact: requireEngineArtifactByLocator({ taskID: input.taskID, locator }),
  }))
  const selectedArtifacts = selectedArtifactVersions.map(({ artifact }) => artifact)
  const requirementSetArtifactLocators = uniqueEngineArtifactLocators([
    ...selectedArtifactVersions
      .filter(({ artifact }) => artifact.kind === "requirement_set")
      .map(({ locator }) => locator),
  ])
  const contractGraphArtifactLocators = uniqueEngineArtifactLocators([
    ...selectedArtifactVersions
      .filter(({ artifact }) => artifact.kind === "architect_contract_graph")
      .map(({ locator }) => locator),
  ])
  const hasPostBuildFact = selectedArtifacts.some((artifact) => {
    return artifact.kind === "build_host_observation"
  })
  return {
    goalIDs: goals.map((goal) => goal.id),
    requirementSetArtifactLocators,
    contractGraphArtifactLocators,
    evidenceArtifactLocators: uniqueArtifactReadLocators(input.artifactLocators),
    phase: hasPostBuildFact ? "post_build" : "pre_build",
  }
}

export function integrityEvidenceGoalInfo(goal: GoalContractFields) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.objective,
    criteria: renderSpecsAsText(goal.acceptance_specs ?? []),
    priority: goal.priority,
    acceptance_spec_count: goal.acceptance_specs?.length ?? 0,
    acceptance_scenarios: (goal.acceptance_specs ?? []).filter((spec) => Boolean(spec.scenario)),
    acceptance_specs: goal.acceptance_specs ?? [],
    owned_paths: goal.owned_paths ?? [],
  }
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${context} must be a string array`)
  }
  return value
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function uniqueEngineArtifactLocators(
  locators: readonly EngineArtifactLocator[],
): EngineArtifactLocator[] {
  const seen = new Set<string>()
  return locators.filter((locator) => {
    const identity = `${locator.artifact_id}\u0000${locator.catalog_revision}\u0000${locator.expected_sha256}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function uniqueArtifactReadLocators(locators: readonly ArtifactReadLocator[]): ArtifactReadLocator[] {
  const byLocator = new Map<string, ArtifactReadLocator>()
  for (const locator of locators) byLocator.set(JSON.stringify(locator), locator)
  return [...byLocator.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, locator]) => locator)
}
