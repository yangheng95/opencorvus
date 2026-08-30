import { lstat, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import z from "zod"
import { CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"
import {
  ExpertSquadManifestV2Schema,
  type ExpertSquadManifestV2,
} from "./expert-squad-manifest-v2.js"
import { isCanonicalProjectRelativePath } from "./project-path.js"
import {
  PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS,
  PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS,
  PLATFORM_ARTIFACT_TOOL_IDS,
} from "./platform-artifact-tool-ids.js"

export const EXPERT_SQUAD_MANIFEST_PATH = "expert-squad.jsonc"
export const EXPERT_SQUAD_ASSETS_DIRECTORY = "assets"

/**
 * Core-owned, Task-scoped Artifact discovery, exact read, and semantic source
 * selection are projected into every Expert Squad scheduler and worker.
 * Model-facing publication is worker-only. Projected workers publish
 * current-Task files through `artifact_snapshot`, then pass its exact refs to
 * `artifact_publish`. `payload_json` carries the structured evidence as
 * strict JSON text with unique object keys; `resources` is required and is
 * `[]` when there are no files. The Host parses the text once and writes a namespaced
 * `expert_output`. Both snapshot and Engine Artifact exact retries are
 * atomically deduplicated inside the Task and exact Delivery Slice revision
 * subjects; changed bytes, payload, resource, or exact source remain distinct.
 *
 * TypeScript package tools use the separate trusted Host ABI:
 * `context.host.engineArtifacts.publish({ artifact_type, schema_version,
 * label, payload, resources, source_artifact_locators })`. An ordinary
 * package-tool `return string` publishes nothing. A package Engine Artifact
 * publisher declares stable type/schema/label values, canonical JSON payload,
 * explicit resource and source arrays, then returns only the compact `locator`
 * and `sha256` receipt. A package Task Artifact publisher returns its typed
 * immutable snapshot locator instead of inventing an Engine Artifact envelope.
 * The package ToolHost always publishes Engine and Task Artifacts
 * idempotently, so package code cannot weaken stable retry identity.
 * Package ToolHost consumers use `engineArtifacts.search`, `read`, and
 * `select`; `engineArtifacts.publish` reaches the same canonical publisher.
 * A domain Artifact consumed by a deterministic package-tool algorithm is a
 * package ABI: one package-owned codec and typed publisher validate it, and
 * every downstream typed publisher completely reads and selects the exact
 * predecessor locator. Those consumed payloads carry canonical structured values,
 * never mutable project paths that a later consumer rereads. Independent
 * resources and source locators are validated before publication side effects.
 * The package ToolHost atomically
 * reuses an existing publication only when owner, type, schema, label, payload,
 * resource content identities, and exact source identities are all equal.
 * A deterministic package-tool consumer requires this typed ABI. Generative
 * Agent-to-Agent evidence may use model-facing `artifact_publish` when the next
 * Agent performs semantic judgment rather than a package algorithm; it still
 * receives Host-atomic Task execution identity, exact Delivery Slice revision
 * subjects, and exact provenance. This is
 * an authoring contract verified by each package's real tool-chain tests; the
 * generic SDK validator does not guess domain semantics from prompts or type names.
 * Package-defined `context.metadata(...)` values are exposed only under the
 * result's `package_metadata` namespace; top-level provenance, truncation, and
 * lifecycle-control metadata remains Host-owned.
 * Every declared publication source must have been completely read
 * and explicitly selected earlier in the same invocation or physical Turn.
 * The Host derives Task,
 * Session, Agent, active Squad, projection, complete-read observation, and
 * publication-specific semantic-source provenance and enforces
 * `<active-squad-id>/...`. Consumers call `artifact_select` only after a
 * complete exact read; unselected reads remain observations and zero
 * selections are valid. Package manifests do not declare or shadow these
 * tools. Ordinary dispatch outcomes and Agent messages never transport domain
 * Artifact inventories, locators, or bodies. Mission selects exact predecessor
 * locators from the source Task catalog; the receiving Task discovers
 * target-owned imported Engine Artifacts whose immutable `import_lineage`
 * preserves the source Artifact's original consumption provenance.
 */
export const EXPERT_SQUAD_PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS = PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS
export const EXPERT_SQUAD_PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS = PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS
export const EXPERT_SQUAD_PLATFORM_ARTIFACT_TOOL_IDS = PLATFORM_ARTIFACT_TOOL_IDS

export * from "./expert-squad-manifest-v2.js"
export type ExpertSquadPackageFile = string | Uint8Array

/**
 * Package prompts extend the platform Agent-fact and physical-Turn protocol
 * selected by each base role. This authoring definition does not own a
 * terminal report/finalizer schema, Host observations, execution liveness, or
 * Task acceptance state.
 */
export interface ExpertSquadPackageDefinition {
  manifest: ExpertSquadManifestV2
  files: Readonly<Record<string, ExpertSquadPackageFile>>
}

export const ExpertSquadTextPackageDefinitionSchema = z
  .object({
    manifest: ExpertSquadManifestV2Schema,
    files: z.record(z.string(), z.string()),
  })
  .strict()

export type ExpertSquadTextPackageDefinition = z.output<typeof ExpertSquadTextPackageDefinitionSchema>

export interface WriteExpertSquadPackageInput {
  directory: string
  definition: ExpertSquadPackageDefinition
}

export interface WriteExpertSquadPackageResult {
  directory: string
  files: string[]
}

/**
 * ID means Identifier. Evidence keys name visible semantic evidence classes
 * and dependency topology, not concrete inventories, locators, payload
 * transport, hidden workflow state, or tool IDs. Each receiving stage is one
 * fixed-profile Mission Task. Mission imports exact predecessor locators while
 * creating that Task; Agents then discover and read the target-owned imported
 * Engine Artifacts through the platform Artifact tools above.
 */
export interface ExpertSquadCollaborationStage {
  id: string
  squad_id: string
  workflow_id: string
  depends_on: readonly string[]
  consumes: readonly string[]
  produces: readonly string[]
}

export interface ExpertSquadCollaborationDefinition {
  schema_version: 1
  stage_execution: "mission_task"
  id: string
  label: string
  inputs: readonly string[]
  outputs: readonly string[]
  stages: readonly ExpertSquadCollaborationStage[]
}

export interface ValidateExpertSquadCollaborationInput {
  definition: ExpertSquadCollaborationDefinition
  manifests: readonly ExpertSquadManifestV2[]
}

export interface ExpertSquadSourceImportedClosure {
  id: string
  source: string
  target: string
  file_count: number
  source_sha256: string
  target_sha256: string
  normalization?: string
}

export interface ExpertSquadSourceAgentOwner {
  squad_id: string
  agent_id: string
}

export interface ExpertSquadSourceNativeReplacement {
  id: string
  source: string
  owners: readonly ExpertSquadSourceAgentOwner[]
  surfaces: readonly string[]
}

export interface ExpertSquadSourceRoleCapability {
  id: string
  source: string
  owner: ExpertSquadSourceAgentOwner
  target_skill: string
}

export type ExpertSquadSourcePipelineOwner =
  | { kind: "squad"; squad_id: string }
  | { kind: "collaboration"; collaboration_id: string }
  | { kind: "platform"; surface_id: string }

export interface ExpertSquadSourcePipelineAsset {
  id: string
  source: string
  file_count: number
  sha256: string
  owners: readonly ExpertSquadSourcePipelineOwner[]
  excluded_globs?: readonly string[]
  disposition?: string
}

export interface ExpertSquadSourcePipelineGroup {
  id: string
  source_steps: readonly string[]
  stage_bindings: ReadonlyArray<{ collaboration_id: string; stage_id: string }>
  platform_surfaces: readonly string[]
  unavailable_ids: readonly string[]
}

export interface ExpertSquadSourceCapabilityContract {
  schema_version: 1
  source_root_hint: string
  source_pipeline: {
    path: string
    version: string
  }
  excluded_sources: readonly string[]
  platform_surface_definitions: ReadonlyArray<{ id: string; description: string }>
  imported_closures: readonly ExpertSquadSourceImportedClosure[]
  native_replacements: readonly ExpertSquadSourceNativeReplacement[]
  role_capabilities: readonly ExpertSquadSourceRoleCapability[]
  pipeline_assets: readonly ExpertSquadSourcePipelineAsset[]
  collaborations: ReadonlyArray<{ id: string; definition: string }>
  pipeline_groups: readonly ExpertSquadSourcePipelineGroup[]
  unavailable: ReadonlyArray<{ id: string; reason: string }>
}

export interface ValidateExpertSquadSourceCapabilitiesInput {
  definition: ExpertSquadSourceCapabilityContract
  collaborations: readonly ExpertSquadCollaborationDefinition[]
  manifests: readonly ExpertSquadManifestV2[]
}

const CANONICAL_EXPERT_SQUAD_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export interface ExpertSquadValidationDiagnostic {
  readonly path: string
  readonly message: string
}

export class ExpertSquadValidationError extends AggregateError {
  readonly diagnostics: readonly ExpertSquadValidationDiagnostic[]

  constructor(diagnostics: readonly ExpertSquadValidationDiagnostic[]) {
    const ordered = [...diagnostics].sort(
      (left, right) => left.path.localeCompare(right.path) || left.message.localeCompare(right.message),
    )
    const summary = ordered.map(({ path, message }) => `${path}: ${message}`).join("; ")
    super(
      ordered.map(({ path, message }) => new Error(`${path}: ${message}`)),
      `Expert squad validation failed with ${ordered.length} diagnostic${ordered.length === 1 ? "" : "s"}: ${summary}`,
    )
    this.name = "ExpertSquadValidationError"
    this.diagnostics = ordered
  }
}

function throwValidationDiagnostics(diagnostics: readonly ExpertSquadValidationDiagnostic[]): void {
  if (diagnostics.length > 0) throw new ExpertSquadValidationError(diagnostics)
}

function projectionCapabilityLeaves(
  manifest: ExpertSquadManifestV2,
  projection: ExpertSquadManifestV2["capability_projection"]["scheduler"] | ExpertSquadManifestV2["capability_projection"]["agents"][string],
): CapabilityRef[] {
  return projection.capability_refs.flatMap((encoded) => {
    const ref = CapabilityRefCodec.decode(encoded)
    if (ref.kind !== "capability_set") return [ref]
    if (ref.source !== "package" || ref.owner_ref !== manifest.id) return []
    return manifest.capability_sets[ref.local_ref]!.member_refs.map(CapabilityRefCodec.decode)
  })
}

function manifestShapeDiagnostics(input: unknown): {
  manifest?: ExpertSquadManifestV2
  diagnostics: ExpertSquadValidationDiagnostic[]
} {
  const parsed = ExpertSquadManifestV2Schema.safeParse(input)
  if (parsed.success) return { manifest: parsed.data, diagnostics: [] }
  return {
    diagnostics: parsed.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? `manifest.${issue.path.join(".")}` : "manifest",
      message: issue.message,
    })),
  }
}

function assertCanonicalCollaborationID(value: string, field: string): string {
  if (!CANONICAL_EXPERT_SQUAD_ID.test(value) || value.length > 64) {
    throw new Error(`${field} must be a canonical lower-kebab-case identifier: ${JSON.stringify(value)}`)
  }
  return value
}

function assertDistinctCanonicalIDs(values: readonly string[], field: string): Set<string> {
  const result = new Set<string>()
  for (const value of values) {
    assertCanonicalCollaborationID(value, field)
    if (result.has(value)) throw new Error(`${field} contains duplicate identifier: ${value}`)
    result.add(value)
  }
  return result
}

export function validateExpertSquadManifestDispatchTopology(input: unknown): ExpertSquadManifestV2 {
  const shape = manifestShapeDiagnostics(input)
  throwValidationDiagnostics(shape.diagnostics)
  const manifest = shape.manifest!
  const diagnostics: ExpertSquadValidationDiagnostic[] = []
  for (const [workflowID, workflow] of Object.entries(manifest.capability_projection.virtual_workflows)) {
    const workflowPath = `manifest.capability_projection.virtual_workflows.${workflowID}`
    for (const [nodeID, node] of Object.entries(workflow.nodes)) {
      const nodePath = `${workflowPath}.nodes.${nodeID}`
      if (!Object.hasOwn(manifest.capability_projection.agents, node.agent_id)) {
        diagnostics.push({
          path: `${nodePath}.agent_id`,
          message: `references unknown projected agent ${node.agent_id}`,
        })
      }
      for (const dependencyID of node.depends_on) {
        if (dependencyID === nodeID) {
          diagnostics.push({ path: `${nodePath}.depends_on`, message: "cannot depend on itself" })
        }
        if (!Object.hasOwn(workflow.nodes, dependencyID)) {
          diagnostics.push({ path: `${nodePath}.depends_on`, message: `references unknown dependency ${dependencyID}` })
        }
      }
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const cycleNodes = new Set<string>()
    const visit = (nodeID: string): void => {
      if (visiting.has(nodeID)) {
        cycleNodes.add(nodeID)
        return
      }
      if (visited.has(nodeID)) return
      visiting.add(nodeID)
      for (const dependencyID of workflow.nodes[nodeID]!.depends_on) {
        if (Object.hasOwn(workflow.nodes, dependencyID)) visit(dependencyID)
      }
      visiting.delete(nodeID)
      visited.add(nodeID)
    }
    for (const nodeID of Object.keys(workflow.nodes).sort()) visit(nodeID)
    if (cycleNodes.size > 0) {
      diagnostics.push({
        path: `${workflowPath}.nodes`,
        message: `contains a dependency cycle involving ${[...cycleNodes].sort().join(", ")}`,
      })
    }
  }
  throwValidationDiagnostics(diagnostics)
  return input as ExpertSquadManifestV2
}

/** A deterministic read-only view of one dependency depth in a virtual workflow. */
export interface ExpertSquadWorkflowTopologyWave {
  readonly depth: number
  readonly node_ids: readonly string[]
}

/**
 * Author-facing graph facts derived from manifest v2. These facts are not
 * scheduler state and do not impose a minimum width or a preferred topology.
 */
export interface ExpertSquadWorkflowTopologyAnalysis {
  readonly workflow_id: string
  readonly node_count: number
  readonly initial_frontier_node_ids: readonly string[]
  readonly waves: readonly ExpertSquadWorkflowTopologyWave[]
  readonly join_node_ids: readonly string[]
  readonly critical_path_node_count: number
  readonly maximum_parallel_width: number
  readonly structure: "flat_planner_parallel_workers" | "parallel_workers_join" | "dependency_dag"
  readonly planner_node_id: string | null
  readonly parallel_worker_node_ids: readonly string[]
}

/**
 * Validate a manifest and describe all dependency-ready depth frontiers.
 * Runtime remains the sole owner of dispatch readiness; this report only helps
 * package authors see joins and accidental serialization before installation.
 */
export function analyzeExpertSquadWorkflowTopology(
  input: unknown,
): readonly ExpertSquadWorkflowTopologyAnalysis[] {
  const manifest = validateExpertSquadManifestDispatchTopology(input)
  return Object.entries(manifest.capability_projection.virtual_workflows)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([workflowID, workflow]) => {
      const depths = new Map<string, number>()
      const depthOf = (nodeID: string): number => {
        const known = depths.get(nodeID)
        if (known !== undefined) return known
        const dependencies = workflow.nodes[nodeID]!.depends_on
        const depth = dependencies.length === 0 ? 0 : Math.max(...dependencies.map(depthOf)) + 1
        depths.set(nodeID, depth)
        return depth
      }
      const waveMap = new Map<number, string[]>()
      for (const nodeID of Object.keys(workflow.nodes).sort()) {
        const depth = depthOf(nodeID)
        const nodeIDs = waveMap.get(depth) ?? []
        nodeIDs.push(nodeID)
        waveMap.set(depth, nodeIDs)
      }
      const waves = [...waveMap.entries()]
        .sort(([left], [right]) => left - right)
        .map(([depth, nodeIDs]) => ({ depth, node_ids: nodeIDs }))
      const initialFrontier = waves[0]?.node_ids ?? []
      const secondFrontier = waves[1]?.node_ids ?? []
      const plannerNodeID =
        waves.length === 2 &&
        initialFrontier.length === 1 &&
        secondFrontier.length >= 2 &&
        secondFrontier.every((nodeID) => {
          const dependencies = workflow.nodes[nodeID]!.depends_on
          return dependencies.length === 1 && dependencies[0] === initialFrontier[0]
        })
          ? initialFrontier[0]!
          : null
      const parallelJoin =
        waves.length === 2 &&
        initialFrontier.length >= 2 &&
        secondFrontier.length === 1 &&
        workflow.nodes[secondFrontier[0]!]!.depends_on.length === initialFrontier.length &&
        initialFrontier.every((nodeID) => workflow.nodes[secondFrontier[0]!]!.depends_on.includes(nodeID))
      return {
        workflow_id: workflowID,
        node_count: Object.keys(workflow.nodes).length,
        initial_frontier_node_ids: initialFrontier,
        waves,
        join_node_ids: Object.entries(workflow.nodes)
          .filter(([, node]) => node.depends_on.length > 1)
          .map(([nodeID]) => nodeID)
          .sort(),
        critical_path_node_count: waves.length,
        maximum_parallel_width: Math.max(...waves.map((wave) => wave.node_ids.length)),
        structure: plannerNodeID
          ? "flat_planner_parallel_workers"
          : parallelJoin
            ? "parallel_workers_join"
            : "dependency_dag",
        planner_node_id: plannerNodeID,
        parallel_worker_node_ids: plannerNodeID ? secondFrontier : [],
      }
    })
}

/**
 * Repository-shipped Expert Squads follow a stronger product policy than the
 * public manifest ABI. Third-party packages may retain any valid acyclic
 * evidence graph. Shipped non-Advanced packages may not project the platform
 * Visual QA or Integrity review runtimes, and may not recreate the retired
 * Requirements -> Architect -> Implementer delivery chain. Advanced is the
 * explicit product exception because that package owns those specialist ABIs.
 */
export function validateBuiltInExpertSquadTopologyPolicy(input: unknown): ExpertSquadManifestV2 {
  const manifest = validateExpertSquadManifestDispatchTopology(input)
  if (manifest.id === "advanced") return manifest

  const diagnostics: ExpertSquadValidationDiagnostic[] = []
  for (const [agentID, agent] of Object.entries(manifest.capability_projection.agents)) {
    if (agent.base_role === "visual-qa" || agent.base_role === "integrity") {
      diagnostics.push({
        path: `manifest.capability_projection.agents.${agentID}.base_role`,
        message: `shipped non-Advanced Expert Squads use Planner/worker ownership instead of ${agent.base_role} review runtime`,
      })
    }
  }

  for (const [workflowID, workflow] of Object.entries(manifest.capability_projection.virtual_workflows)) {
    const requirementNodes = Object.entries(workflow.nodes)
      .filter(([, node]) => manifest.capability_projection.agents[node.agent_id]?.base_role === "requirements")
      .map(([nodeID]) => nodeID)
    const architectNodes = Object.entries(workflow.nodes)
      .filter(([, node]) => manifest.capability_projection.agents[node.agent_id]?.base_role === "architect")
      .map(([nodeID]) => nodeID)
    const buildNodes = Object.entries(workflow.nodes)
      .filter(([, node]) => manifest.capability_projection.agents[node.agent_id]?.base_role === "build")
      .map(([nodeID]) => nodeID)
    const ancestors = (nodeID: string): Set<string> => {
      const result = new Set<string>()
      const visit = (current: string) => {
        for (const dependency of workflow.nodes[current]?.depends_on ?? []) {
          if (result.has(dependency)) continue
          result.add(dependency)
          visit(dependency)
        }
      }
      visit(nodeID)
      return result
    }
    const retiredChain = buildNodes.some((buildNodeID) => {
      const buildAncestors = ancestors(buildNodeID)
      return architectNodes.some((architectNodeID) => {
        if (!buildAncestors.has(architectNodeID)) return false
        const architectAncestors = ancestors(architectNodeID)
        return requirementNodes.some((requirementNodeID) => architectAncestors.has(requirementNodeID))
      })
    })
    if (retiredChain) {
      diagnostics.push({
        path: `manifest.capability_projection.virtual_workflows.${workflowID}.nodes`,
        message: "shipped non-Advanced Expert Squads must replace Requirements -> Architect -> Implementer serialization with Planner and parallel workers",
      })
    }
  }
  throwValidationDiagnostics(diagnostics)
  return manifest
}

function assertNonEmptyStrings(values: readonly string[], field: string): void {
  if (values.length === 0) throw new Error(`${field} must not be empty`)
  const seen = new Set<string>()
  for (const value of values) {
    if (!value.trim()) throw new Error(`${field} contains an empty value`)
    if (seen.has(value)) throw new Error(`${field} contains duplicate value: ${value}`)
    seen.add(value)
  }
}

export function validateExpertSquadSourceCapabilities(
  input: ValidateExpertSquadSourceCapabilitiesInput,
): ExpertSquadSourceCapabilityContract {
  const { definition } = input
  if (definition.schema_version !== 1) {
    throw new Error("Expert squad source capability schema_version must equal 1")
  }
  if (!path.isAbsolute(definition.source_root_hint)) {
    throw new Error("Expert squad source capability source_root_hint must be absolute")
  }
  assertCanonicalRelativePath(definition.source_pipeline.path)
  if (!definition.source_pipeline.version.trim()) {
    throw new Error("Expert squad source capability source pipeline version must not be empty")
  }

  const manifests = new Map<string, ExpertSquadManifestV2>()
  for (const manifest of input.manifests) {
    validateExpertSquadManifestDispatchTopology(manifest)
    if (manifests.has(manifest.id)) throw new Error(`Duplicate expert squad manifest id: ${manifest.id}`)
    manifests.set(manifest.id, manifest)
  }
  const collaborations = new Map<string, ExpertSquadCollaborationDefinition>()
  for (const collaboration of input.collaborations) {
    validateExpertSquadCollaboration({ definition: collaboration, manifests: input.manifests })
    if (collaborations.has(collaboration.id)) {
      throw new Error(`Duplicate expert squad collaboration id: ${collaboration.id}`)
    }
    collaborations.set(collaboration.id, collaboration)
  }

  const agentProjection = (owner: ExpertSquadSourceAgentOwner, context: string) => {
    const manifest = manifests.get(owner.squad_id)
    if (!manifest) throw new Error(`${context} references unknown squad: ${owner.squad_id}`)
    const projection = manifest.capability_projection.agents[owner.agent_id]
    if (!projection) {
      throw new Error(`${context} references unknown agent ${owner.agent_id} in ${owner.squad_id}`)
    }
    return projection
  }
  const platformSurfaceIDs = new Set<string>()
  for (const surface of definition.platform_surface_definitions) {
    assertCanonicalCollaborationID(surface.id, "Source platform surface id")
    if (platformSurfaceIDs.has(surface.id)) throw new Error(`Duplicate source platform surface id: ${surface.id}`)
    platformSurfaceIDs.add(surface.id)
    if (!surface.description.trim())
      throw new Error(`Source platform surface ${surface.id} description must not be empty`)
  }
  if (platformSurfaceIDs.size === 0) throw new Error("Source platform surface definitions must not be empty")
  const sourceIDs = new Set<string>()
  const sourcePaths = new Set<string>()
  const claimID = (id: string, kind: string) => {
    if (!id.trim()) throw new Error(`${kind} id must not be empty`)
    if (sourceIDs.has(id)) throw new Error(`Duplicate source capability id: ${id}`)
    sourceIDs.add(id)
  }
  const claimSourcePath = (sourcePath: string, kind: string) => {
    assertCanonicalRelativePath(sourcePath)
    if (sourcePaths.has(sourcePath)) {
      throw new Error(`Source path ${sourcePath} is claimed by more than one active ${kind}`)
    }
    sourcePaths.add(sourcePath)
  }
  const assertDigest = (digest: string, field: string) => {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${field} must be a lowercase SHA-256 digest`)
  }

  for (const closure of definition.imported_closures) {
    claimID(closure.id, "Imported closure")
    claimSourcePath(closure.source, "imported closure")
    assertCanonicalRelativePath(closure.target)
    if (!Number.isInteger(closure.file_count) || closure.file_count < 1) {
      throw new Error(`Imported closure ${closure.id} file_count must be a positive integer`)
    }
    assertDigest(closure.source_sha256, `Imported closure ${closure.id} source_sha256`)
    assertDigest(closure.target_sha256, `Imported closure ${closure.id} target_sha256`)
  }

  for (const replacement of definition.native_replacements) {
    claimID(replacement.id, "Native replacement")
    claimSourcePath(replacement.source, "native replacement")
    if (replacement.owners.length === 0)
      throw new Error(`Native replacement ${replacement.id} owners must not be empty`)
    assertNonEmptyStrings(replacement.surfaces, `Native replacement ${replacement.id} surfaces`)
    const visibleSurfaces = new Set<string>()
    const ownerIDs = new Set<string>()
    for (const owner of replacement.owners) {
      const ownerID = `${owner.squad_id}/${owner.agent_id}`
      if (ownerIDs.has(ownerID)) throw new Error(`Native replacement ${replacement.id} repeats owner: ${ownerID}`)
      ownerIDs.add(ownerID)
      const projection = agentProjection(owner, `Native replacement ${replacement.id}`)
      const manifest = manifests.get(owner.squad_id)!
      for (const ref of projectionCapabilityLeaves(manifest, projection)) {
        if (ref.kind === "tool" || ref.kind === "mcp_tool") {
          visibleSurfaces.add(ref.local_ref)
          visibleSurfaces.add(CapabilityRefCodec.encode(ref))
        }
      }
    }
    for (const surface of replacement.surfaces) {
      if (!visibleSurfaces.has(surface)) {
        throw new Error(`Native replacement ${replacement.id} surface is not projected to its owners: ${surface}`)
      }
    }
  }

  for (const role of definition.role_capabilities) {
    claimID(role.id, "Role capability")
    claimSourcePath(role.source, "role capability")
    const projection = agentProjection(role.owner, `Role capability ${role.id}`)
    const expectedPrefix = `${role.owner.squad_id}/${role.owner.agent_id}/`
    if (!role.target_skill.startsWith(expectedPrefix)) {
      throw new Error(`Role capability ${role.id} target_skill must be agent-local under ${expectedPrefix}`)
    }
    const manifest = manifests.get(role.owner.squad_id)!
    const projectedPackageSkills = projectionCapabilityLeaves(manifest, projection).filter(
      (ref) => ref.kind === "skill" && ref.source === "package",
    )
    if (!projectedPackageSkills.some((ref) => ref.local_ref === role.target_skill)) {
      throw new Error(`Role capability ${role.id} target_skill is not projected to its owner: ${role.target_skill}`)
    }
  }

  for (const asset of definition.pipeline_assets) {
    claimID(`pipeline.${asset.id}`, "Pipeline asset")
    claimSourcePath(asset.source, "pipeline asset")
    if (!Number.isInteger(asset.file_count) || asset.file_count < 1) {
      throw new Error(`Pipeline asset ${asset.id} file_count must be a positive integer`)
    }
    assertDigest(asset.sha256, `Pipeline asset ${asset.id} sha256`)
    if (asset.owners.length === 0) throw new Error(`Pipeline asset ${asset.id} owners must not be empty`)
    const ownerIDs = new Set<string>()
    for (const owner of asset.owners) {
      const ownerKind = (owner as { kind: string }).kind
      if (!["squad", "collaboration", "platform"].includes(ownerKind)) {
        throw new Error(`Pipeline asset ${asset.id} has invalid owner kind: ${ownerKind}`)
      }
      const ownerID =
        owner.kind === "squad"
          ? `squad/${owner.squad_id}`
          : owner.kind === "collaboration"
            ? `collaboration/${owner.collaboration_id}`
            : `platform/${owner.surface_id}`
      if (ownerIDs.has(ownerID)) throw new Error(`Pipeline asset ${asset.id} repeats owner: ${ownerID}`)
      ownerIDs.add(ownerID)
      if (owner.kind === "squad") {
        if (!manifests.has(owner.squad_id)) {
          throw new Error(`Pipeline asset ${asset.id} references unknown squad: ${owner.squad_id}`)
        }
      } else if (owner.kind === "collaboration") {
        if (!collaborations.has(owner.collaboration_id)) {
          throw new Error(`Pipeline asset ${asset.id} references unknown collaboration: ${owner.collaboration_id}`)
        }
      } else if (!platformSurfaceIDs.has(owner.surface_id)) {
        throw new Error(`Pipeline asset ${asset.id} references unknown platform surface: ${owner.surface_id}`)
      }
    }
    for (const glob of asset.excluded_globs ?? []) assertCanonicalRelativePath(glob)
  }

  assertNonEmptyStrings(definition.excluded_sources, "Excluded sources")
  for (const excludedSource of definition.excluded_sources) {
    assertCanonicalRelativePath(excludedSource)
    if (sourcePaths.has(excludedSource)) {
      throw new Error(`Source path is both active and excluded: ${excludedSource}`)
    }
  }

  const declaredCollaborationIDs = new Set<string>()
  for (const declared of definition.collaborations) {
    assertCanonicalCollaborationID(declared.id, "Source collaboration id")
    if (declaredCollaborationIDs.has(declared.id)) {
      throw new Error(`Duplicate source collaboration id: ${declared.id}`)
    }
    declaredCollaborationIDs.add(declared.id)
    assertCanonicalRelativePath(declared.definition)
    if (!collaborations.has(declared.id)) {
      throw new Error(`Source capability contract references unknown collaboration: ${declared.id}`)
    }
  }
  for (const collaborationID of collaborations.keys()) {
    if (!declaredCollaborationIDs.has(collaborationID)) {
      throw new Error(`Validated collaboration is absent from the source capability contract: ${collaborationID}`)
    }
  }

  const unavailableIDs = new Set<string>()
  for (const unavailable of definition.unavailable) {
    if (!unavailable.id.trim()) throw new Error("Unavailable source capability id must not be empty")
    if (unavailableIDs.has(unavailable.id)) {
      throw new Error(`Duplicate unavailable source capability id: ${unavailable.id}`)
    }
    unavailableIDs.add(unavailable.id)
    if (!unavailable.reason.trim()) {
      throw new Error(`Unavailable source capability ${unavailable.id} reason must not be empty`)
    }
  }

  const sourceSteps = new Set<string>()
  for (const group of definition.pipeline_groups) {
    claimID(`pipeline-group.${group.id}`, "Pipeline group")
    assertNonEmptyStrings(group.source_steps, `Pipeline group ${group.id} source_steps`)
    for (const sourceStep of group.source_steps) {
      if (sourceSteps.has(sourceStep)) {
        throw new Error(`Source pipeline step is claimed by more than one group: ${sourceStep}`)
      }
      sourceSteps.add(sourceStep)
    }
    assertNonEmptyStrings(group.platform_surfaces, `Pipeline group ${group.id} platform_surfaces`)
    for (const surfaceID of group.platform_surfaces) {
      if (!platformSurfaceIDs.has(surfaceID)) {
        throw new Error(`Pipeline group ${group.id} references unknown platform surface: ${surfaceID}`)
      }
    }
    const bindingIDs = new Set<string>()
    for (const binding of group.stage_bindings) {
      const bindingID = `${binding.collaboration_id}/${binding.stage_id}`
      if (bindingIDs.has(bindingID)) {
        throw new Error(`Pipeline group ${group.id} contains duplicate stage binding: ${bindingID}`)
      }
      bindingIDs.add(bindingID)
      const collaboration = collaborations.get(binding.collaboration_id)
      if (!collaboration) {
        throw new Error(`Pipeline group ${group.id} references unknown collaboration: ${binding.collaboration_id}`)
      }
      if (!collaboration.stages.some((stage) => stage.id === binding.stage_id)) {
        throw new Error(`Pipeline group ${group.id} references unknown collaboration stage: ${bindingID}`)
      }
    }
    for (const unavailableID of group.unavailable_ids) {
      if (!unavailableIDs.has(unavailableID)) {
        throw new Error(`Pipeline group ${group.id} references unknown unavailable capability: ${unavailableID}`)
      }
    }
  }
  return definition
}

/**
 * Validates a static cross-package authoring contract. Every node in a selected
 * manifest workflow remains mandatory at runtime; conditional paths belong in
 * separate workflows. Each workflow ID, label, and description must identify
 * one complete applicability variant and all mandatory inputs so callers do not
 * combine overlapping capability labels or select a graph whose required input
 * is absent. Every collaboration stage is one Mission-owned Task with a fixed
 * squad profile; every selected workflow node runs once for that Task and may
 * cite all applicable exact Delivery Slice revision IDs as subjects. This function does not create Tasks, select a
 * squad, dispatch an agent, persist stage state, or execute a workflow.
 */
export function validateExpertSquadCollaboration(
  input: ValidateExpertSquadCollaborationInput,
): ExpertSquadCollaborationDefinition {
  const { definition } = input
  if (definition.schema_version !== 1) throw new Error("Expert squad collaboration schema_version must equal 1")
  if (definition.stage_execution !== "mission_task") {
    throw new Error('Expert squad collaboration stage_execution must equal "mission_task"')
  }
  assertCanonicalCollaborationID(definition.id, "Collaboration id")
  if (!definition.label.trim()) throw new Error("Expert squad collaboration label must not be empty")
  if (definition.stages.length < 1) throw new Error("Expert squad collaboration requires at least one stage")

  const externalInputs = assertDistinctCanonicalIDs(definition.inputs, "Collaboration inputs")
  const requestedOutputs = assertDistinctCanonicalIDs(definition.outputs, "Collaboration outputs")
  const manifests = new Map<string, ExpertSquadManifestV2>()
  for (const manifest of input.manifests) {
    if (manifests.has(manifest.id)) throw new Error(`Duplicate expert squad manifest id: ${manifest.id}`)
    validateExpertSquadManifestDispatchTopology(manifest)
    manifests.set(manifest.id, manifest)
  }

  const stageIDs = new Set<string>()
  const producedByStage = new Map<string, string>()
  const availableEvidence = new Map<string, Set<string>>()
  for (const stage of definition.stages) {
    assertCanonicalCollaborationID(stage.id, "Collaboration stage id")
    assertCanonicalCollaborationID(stage.squad_id, `Collaboration stage ${stage.id} squad_id`)
    assertCanonicalCollaborationID(stage.workflow_id, `Collaboration stage ${stage.id} workflow_id`)
    if (stageIDs.has(stage.id)) throw new Error(`Duplicate collaboration stage id: ${stage.id}`)
    stageIDs.add(stage.id)

    const dependencies = assertDistinctCanonicalIDs(stage.depends_on, `Collaboration stage ${stage.id} depends_on`)
    for (const dependency of dependencies) {
      if (!availableEvidence.has(dependency)) {
        throw new Error(`Collaboration stage ${stage.id} depends on unknown or later stage: ${dependency}`)
      }
    }

    const manifest = manifests.get(stage.squad_id)
    if (!manifest) throw new Error(`Collaboration stage ${stage.id} references unknown squad: ${stage.squad_id}`)
    const workflow = manifest.capability_projection.virtual_workflows[stage.workflow_id]
    if (!workflow) {
      throw new Error(
        `Collaboration stage ${stage.id} references unknown workflow ${stage.workflow_id} in squad ${stage.squad_id}`,
      )
    }
    const inheritedEvidence = new Set(externalInputs)
    for (const dependency of dependencies) {
      for (const evidence of availableEvidence.get(dependency) ?? []) inheritedEvidence.add(evidence)
    }
    const consumed = assertDistinctCanonicalIDs(stage.consumes, `Collaboration stage ${stage.id} consumes`)
    for (const evidence of consumed) {
      if (!inheritedEvidence.has(evidence)) {
        throw new Error(`Collaboration stage ${stage.id} consumes disconnected evidence: ${evidence}`)
      }
    }

    const produced = assertDistinctCanonicalIDs(stage.produces, `Collaboration stage ${stage.id} produces`)
    if (produced.size === 0) throw new Error(`Collaboration stage ${stage.id} must produce visible evidence`)
    for (const evidence of produced) {
      const previousOwner = producedByStage.get(evidence)
      if (previousOwner) {
        throw new Error(`Collaboration evidence ${evidence} is produced by both ${previousOwner} and ${stage.id}`)
      }
      producedByStage.set(evidence, stage.id)
    }
    availableEvidence.set(stage.id, new Set([...inheritedEvidence, ...produced]))
  }

  for (const output of requestedOutputs) {
    if (!producedByStage.has(output)) throw new Error(`Collaboration output is not produced by any stage: ${output}`)
  }
  return definition
}

function assertCanonicalRelativePath(value: string): string {
  if (!isCanonicalProjectRelativePath(value)) {
    throw new Error(`Expert squad package path must be canonical and cross-platform: ${JSON.stringify(value)}`)
  }
  return value
}

export function expertSquadAssetPath(relativePath: string): string {
  const canonical = assertCanonicalRelativePath(relativePath)
  return `${EXPERT_SQUAD_ASSETS_DIRECTORY}/${canonical}`
}

function validatePackageFiles(files: Readonly<Record<string, ExpertSquadPackageFile>>) {
  const fileKeys = new Set<string>()
  const directoryKeys = new Set<string>()
  const entries = Object.entries(files).sort(([left], [right]) => left.localeCompare(right))

  for (const [relativePath, content] of entries) {
    assertCanonicalRelativePath(relativePath)
    if (typeof content !== "string" && !(content instanceof Uint8Array)) {
      throw new Error(`Expert squad package file must be text or bytes: ${JSON.stringify(relativePath)}`)
    }
    const segments = relativePath.split("/")
    const fileKey = relativePath.toLowerCase()
    if (fileKeys.has(fileKey)) {
      throw new Error(`Duplicate expert squad package path after case normalization: ${relativePath}`)
    }
    if (directoryKeys.has(fileKey)) {
      throw new Error(`Expert squad package file/directory collision: ${relativePath}`)
    }
    for (let index = 1; index < segments.length; index++) {
      const directoryKey = segments.slice(0, index).join("/").toLowerCase()
      if (fileKeys.has(directoryKey)) {
        throw new Error(`Expert squad package file/directory collision: ${relativePath}`)
      }
      directoryKeys.add(directoryKey)
    }
    fileKeys.add(fileKey)
  }

  return entries
}

function collectPackageFileDiagnostics(
  files: Readonly<Record<string, ExpertSquadPackageFile>>,
): ExpertSquadValidationDiagnostic[] {
  const diagnostics: ExpertSquadValidationDiagnostic[] = []
  const fileKeys = new Map<string, string>()
  const directoryKeys = new Map<string, string>()
  for (const [relativePath, content] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    const diagnosticPath = `files.${relativePath}`
    try {
      assertCanonicalRelativePath(relativePath)
    } catch (error) {
      diagnostics.push({ path: diagnosticPath, message: error instanceof Error ? error.message : String(error) })
      continue
    }
    if (typeof content !== "string" && !(content instanceof Uint8Array)) {
      diagnostics.push({ path: diagnosticPath, message: "must be text or bytes" })
    }
    const segments = relativePath.split("/")
    const fileKey = relativePath.toLowerCase()
    const priorFile = fileKeys.get(fileKey)
    if (priorFile) {
      diagnostics.push({ path: diagnosticPath, message: `case-collides with package file ${priorFile}` })
    }
    const priorDirectory = directoryKeys.get(fileKey)
    if (priorDirectory) {
      diagnostics.push({ path: diagnosticPath, message: `collides with package directory ${priorDirectory}` })
    }
    for (let index = 1; index < segments.length; index++) {
      const directory = segments.slice(0, index).join("/")
      const directoryKey = directory.toLowerCase()
      const parentFile = fileKeys.get(directoryKey)
      if (parentFile) {
        diagnostics.push({ path: diagnosticPath, message: `parent directory collides with package file ${parentFile}` })
      }
      directoryKeys.set(directoryKey, directory)
    }
    fileKeys.set(fileKey, relativePath)
  }
  return diagnostics
}

function collectRequiredPackageTextDiagnostic(
  files: Readonly<Record<string, ExpertSquadPackageFile>>,
  relativePath: string,
  context: string,
): ExpertSquadValidationDiagnostic[] {
  try {
    requiredPackageText(files, relativePath, context)
    return []
  } catch (error) {
    return [{ path: `files.${relativePath}`, message: error instanceof Error ? error.message : String(error) }]
  }
}

function requiredPackageText(
  files: Readonly<Record<string, ExpertSquadPackageFile>>,
  relativePath: string,
  context: string,
): string {
  const content = files[relativePath]
  if (content === undefined) throw new Error(`${context}: missing required package file ${relativePath}`)
  let text: string
  if (typeof content === "string") {
    text = content
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(content)
    } catch {
      throw new Error(`${context}: required package file must be UTF-8 text: ${relativePath}`)
    }
  }
  if (!text.trim()) throw new Error(`${context}: required package file must not be blank: ${relativePath}`)
  return text
}

export function validateExpertSquadPackageDefinition(
  input: unknown,
): ExpertSquadPackageDefinition {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ExpertSquadValidationError([{ path: "definition", message: "must be an object" }])
  }
  const candidate = input as Partial<ExpertSquadPackageDefinition>
  const manifestShape = manifestShapeDiagnostics(candidate.manifest)
  const diagnostics = [...manifestShape.diagnostics]
  if (!candidate.files || typeof candidate.files !== "object" || Array.isArray(candidate.files)) {
    diagnostics.push({ path: "files", message: "must be an object" })
  }
  throwValidationDiagnostics(diagnostics)
  const manifest = validateExpertSquadManifestDispatchTopology(manifestShape.manifest)
  const definition = { manifest, files: candidate.files! }
  const packageDiagnostics = collectPackageFileDiagnostics(definition.files)
  if (Object.keys(definition.files).some((file) => file.toLowerCase() === EXPERT_SQUAD_MANIFEST_PATH)) {
    packageDiagnostics.push({
      path: `files.${EXPERT_SQUAD_MANIFEST_PATH}`,
      message: `${EXPERT_SQUAD_MANIFEST_PATH} is owned by the expert squad package manifest`,
    })
  }
  packageDiagnostics.push(
    ...collectRequiredPackageTextDiagnostic(definition.files, definition.manifest.readme, "Expert squad README"),
    ...collectRequiredPackageTextDiagnostic(
      definition.files,
      definition.manifest.selector.instructions,
      "Expert squad selector instructions",
    ),
  )

  const promptProjections = [
    ["orchestrator", definition.manifest.capability_projection.scheduler],
    ...Object.entries(definition.manifest.capability_projection.agents),
  ] as const
  for (const [agentID, projection] of promptProjections) {
    if (!projection.prompt) continue
    const expectedPath = `agents/${agentID}/system.md`
    if (projection.prompt !== expectedPath) {
      packageDiagnostics.push({
        path: `manifest.capability_projection.${agentID}.prompt`,
        message: `must use its canonical owner path ${expectedPath}`,
      })
      continue
    }
    packageDiagnostics.push(
      ...collectRequiredPackageTextDiagnostic(
        definition.files,
        projection.prompt,
        `Expert squad ${agentID} prompt`,
      ),
    )
  }
  throwValidationDiagnostics(packageDiagnostics)
  return input as ExpertSquadPackageDefinition
}

export function renderExpertSquadPackageFiles(
  definition: ExpertSquadPackageDefinition,
): Record<string, ExpertSquadPackageFile> {
  validateExpertSquadPackageDefinition(definition)
  const files = {
    [EXPERT_SQUAD_MANIFEST_PATH]: `${JSON.stringify(definition.manifest, null, 2)}\n`,
    ...definition.files,
  }
  return Object.fromEntries(validatePackageFiles(files))
}

async function publishStagingDirectory(stagingDirectory: string, directory: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(stagingDirectory, directory)
      return
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EACCES") || attempt >= 9) throw error
      await delay(Math.min(50 * 2 ** attempt, 500))
    }
  }
}

export async function writeExpertSquadPackage(
  input: WriteExpertSquadPackageInput,
): Promise<WriteExpertSquadPackageResult> {
  const directory = path.resolve(input.directory)
  const files = renderExpertSquadPackageFiles(input.definition)
  const parentDirectory = path.dirname(directory)
  await mkdir(parentDirectory, { recursive: true })
  try {
    await lstat(directory)
    throw Object.assign(new Error(`Expert squad package destination already exists: ${directory}`), {
      code: "EEXIST",
    })
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
  }

  let stagingDirectory: string | undefined
  try {
    stagingDirectory = await mkdtemp(path.join(parentDirectory, `.${path.basename(directory)}.staging-`))
    for (const [relativePath, content] of Object.entries(files)) {
      const target = path.join(stagingDirectory, ...relativePath.split("/"))
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, content)
    }
    await publishStagingDirectory(stagingDirectory, directory)
    stagingDirectory = undefined
  } catch (error) {
    if (stagingDirectory) {
      try {
        await rm(stagingDirectory, { recursive: true, force: true })
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Expert squad package publication failed and staging cleanup also failed",
          { cause: error },
        )
      }
    }
    throw error
  }

  return { directory, files: Object.keys(files) }
}
