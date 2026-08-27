// SHA-256 means Secure Hash Algorithm 256-bit.
import { createHash } from "node:crypto"
import { z } from "zod"
import type { ExpertSquadProjectionResourcesSchema } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"
import { InspectedExpertSquadPackageSchema } from "./expert-squad-package.js"

/**
 * Candidate integrity lives in the ABI because two callers must reach exactly
 * the same verdict about the same bytes: the Evolution Lab publisher inside a
 * package tool Capsule, and the Host when it authors a revision from user
 * feedback with no Campaign and no Capsule. A second copy would be a second
 * definition of what a legal candidate is.
 */
type InspectedPackage = z.infer<typeof InspectedExpertSquadPackageSchema>
type Manifest = Record<string, unknown>

function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`)
      .join(",")}}`
  }
  throw new Error("Candidate integrity value is not canonical JSON")
}

function manifestRecord(value: unknown): Manifest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Validated package manifest is invalid")
  return value as Manifest
}

export function candidateMutableTextPaths(pkg: InspectedPackage): string[] {
  const manifest = manifestRecord(pkg.manifest)
  const selector = manifestRecord(manifest.selector)
  const capability = manifestRecord(manifest.capability_projection)
  const scheduler = manifestRecord(capability.scheduler)
  const agents = manifestRecord(capability.agents)
  const paths = new Set<string>()
  const files = new Map(pkg.files.map((file) => [file.path, file]))
  for (const value of [manifest.readme, selector.instructions, scheduler.prompt]) {
    if (typeof value === "string") paths.add(value)
  }
  for (const agent of Object.values(agents)) {
    const prompt = manifestRecord(agent).prompt
    if (typeof prompt === "string") paths.add(prompt)
  }
  for (const closure of pkg.skill_closures) {
    const root = closure.source.slice(0, -"SKILL.md".length).replace(/\/$/, "")
    for (const file of closure.files) {
      // Agent Skills reserve scripts and assets for executable or opaque resources.
      // V1 mutates only the instruction and model-readable reference/example closure.
      if (file !== "SKILL.md" && !file.startsWith("references/") && !file.startsWith("examples/")) {
        continue
      }
      const packagePath = root ? `${root}/${file}` : file
      if (files.get(packagePath)?.utf8_text === true) paths.add(packagePath)
    }
  }
  return [...paths].sort()
}

function frozenManifest(manifestValue: unknown) {
  const manifest = { ...manifestRecord(manifestValue) }
  delete manifest.version
  return canonicalJSON(manifest)
}

/**
 * Prove the candidate is internally coherent and runnable.
 *
 * T2–T4 make capability grants, topology and the agent set mutable, so the
 * candidate can no longer be validated by byte-equality against its parent —
 * the fields that equality locked are exactly the ones now allowed to move.
 * What replaces it is the property that actually matters: every prompt path
 * the manifest names exists, every dependency edge resolves inside its own
 * workflow, and no edge closes a cycle. This mirrors how the field validates
 * self-modified agents (compiles and still runs), not how a diff is reviewed.
 */
function assertCandidateStructure(candidate: InspectedPackage) {
  const manifest = manifestRecord(candidate.manifest)
  const selector = manifestRecord(manifest.selector)
  const capability = manifestRecord(manifest.capability_projection)
  const scheduler = manifestRecord(capability.scheduler)
  const agents = manifestRecord(capability.agents)
  const files = new Set(candidate.files.map((file) => file.path))

  const requirePath = (value: unknown, subject: string) => {
    if (typeof value !== "string" || !value) throw new Error(`Candidate ${subject} must name a package path`)
    if (!files.has(value)) throw new Error(`Candidate ${subject} names missing package file ${value}`)
  }
  // A projection may carry no prompt of its own and inherit its base role's.
  // Requiring one would reject packages the Registry already accepts; what
  // must hold is that a prompt the manifest does name actually exists.
  const requireDeclaredPath = (value: unknown, subject: string) => {
    if (value === undefined || value === null) return
    requirePath(value, subject)
  }
  requirePath(manifest.readme, "readme")
  requirePath(selector.instructions, "selector instructions")
  requireDeclaredPath(scheduler.prompt, "scheduler prompt")
  for (const [agentID, agent] of Object.entries(agents)) {
    requireDeclaredPath(manifestRecord(agent).prompt, `agent ${agentID} prompt`)
  }

  const workflows = manifestRecord(capability.virtual_workflows)
  for (const [workflowID, workflowValue] of Object.entries(workflows)) {
    const nodes = manifestRecord(manifestRecord(workflowValue).nodes)
    const edges = new Map<string, string[]>()
    for (const [nodeID, nodeValue] of Object.entries(nodes)) {
      const node = manifestRecord(nodeValue)
      const agentID = node.agent_id
      if (typeof agentID !== "string" || !(agentID in agents))
        throw new Error(`Candidate workflow ${workflowID} node ${nodeID} names undeclared agent ${String(agentID)}`)
      const dependsOn = Array.isArray(node.depends_on) ? node.depends_on.map(String) : []
      for (const dependency of dependsOn) {
        if (!(dependency in nodes))
          throw new Error(`Candidate workflow ${workflowID} node ${nodeID} depends on undeclared node ${dependency}`)
      }
      edges.set(nodeID, dependsOn)
    }
    // Depth-first cycle detection: a dependency cycle deadlocks the workflow at
    // dispatch time, which is exactly the failure a frozen topology used to
    // make unreachable and a mutable one makes possible again.
    const state = new Map<string, "visiting" | "done">()
    const walk = (nodeID: string, trail: string[]) => {
      const seen = state.get(nodeID)
      if (seen === "done") return
      if (seen === "visiting")
        throw new Error(`Candidate workflow ${workflowID} dependency cycle: ${[...trail, nodeID].join(" -> ")}`)
      state.set(nodeID, "visiting")
      for (const dependency of edges.get(nodeID) ?? []) walk(dependency, [...trail, nodeID])
      state.set(nodeID, "done")
    }
    for (const nodeID of edges.keys()) walk(nodeID, [])
  }
}

/**
 * Every manifest field that hands a node a capability. `inherit_base_tools`
 * and `base_role` are handled separately below because both select a Tool pool
 * without being a ref list: a candidate that flips the flag or moves an agent
 * to a more privileged role has granted itself capability just as surely as
 * one that appends a ref.
 *
 * The list is written out rather than derived from
 * `ExpertSquadProjectionResourcesSchema.shape` because not every field added
 * to that schema is necessarily a grant, and deriving would silently classify
 * a future non-grant field as one. What must not happen is the opposite — a
 * new grant field appearing in the schema and never reaching this loop, which
 * would let a candidate widen its own capability through the one field nobody
 * checks. `MISSING_CAPABILITY_GRANT_FIELDS` below makes that a compile error
 * that names the field, so adding one forces a deliberate classification.
 *
 * The import is type-only on purpose: this module runs inside a package tool
 * Capsule, and a value import would pull the SDK into that bundle.
 */
// Keyed off `.shape` rather than `z.infer`: the SDK ships its own zod type
// instance, and inferring across that boundary widens the key union to
// `string`, which would make the exhaustiveness check below always pass.
type ProjectionResourceField = keyof (typeof ExpertSquadProjectionResourcesSchema)["shape"]

type CapabilityGrantListField = Exclude<ProjectionResourceField, "inherit_base_tools">

const CAPABILITY_GRANT_LIST_FIELDS = [
  "built_in_tool_ids",
  "default_skill_refs",
  "package_skill_refs",
  "default_tool_refs",
  "package_tool_refs",
  "default_mcp_server_refs",
  "package_mcp_server_refs",
  "default_mcp_tool_refs",
  "package_mcp_tool_refs",
  "default_mcp_prompt_refs",
  "package_mcp_prompt_refs",
  "default_mcp_resource_refs",
  "package_mcp_resource_refs",
] as const satisfies readonly CapabilityGrantListField[]

type MissingCapabilityGrantField = Exclude<CapabilityGrantListField, (typeof CAPABILITY_GRANT_LIST_FIELDS)[number]>

/**
 * Resolves while the list above covers every projection resource field. When
 * it does not, the constraint fails and the compiler names the field that was
 * left out of the inheritance check. An `X[] = []` style assertion would not
 * work here: the empty array is assignable to every array type, so a missing
 * field would pass silently.
 */
type AssertNoUncheckedGrantField<Missing extends never> = Missing
type CapabilityGrantFieldsAreExhaustive = AssertNoUncheckedGrantField<MissingCapabilityGrantField>

function capabilityNodes(pkg: InspectedPackage): Manifest[] {
  const capability = manifestRecord(manifestRecord(pkg.manifest).capability_projection)
  const agents = manifestRecord(capability.agents)
  return [manifestRecord(capability.scheduler), ...Object.values(agents).map(manifestRecord)]
}

/**
 * The grants a revision declares anywhere in its manifest. The union is taken
 * across nodes rather than matched node-by-node because T4 allows adding an
 * agent, and a new node must be able to receive references the package already
 * uses — while still never introducing one it did not already hold.
 */
function declaredGrants(pkg: InspectedPackage) {
  const lists = new Map<string, Set<string>>(CAPABILITY_GRANT_LIST_FIELDS.map((field) => [field, new Set<string>()]))
  const baseRoles = new Set<string>()
  let inheritsBaseTools = false
  for (const node of capabilityNodes(pkg)) {
    for (const field of CAPABILITY_GRANT_LIST_FIELDS) {
      const value = node[field]
      if (value === undefined || value === null) continue
      if (!Array.isArray(value)) throw new Error(`Validated package manifest field ${field} must be an array`)
      for (const entry of value) lists.get(field)!.add(String(entry))
    }
    if (typeof node.base_role === "string") baseRoles.add(node.base_role)
    if (node.inherit_base_tools === true) inheritsBaseTools = true
  }
  return { lists, baseRoles, inheritsBaseTools }
}

/**
 * A candidate may only grant capability its parent revision already declared.
 *
 * Without this the mutable surface is self-widening: the same revision that
 * authors its own instructions could also hand itself the Tool that removes
 * the evidence of what it did. The rule lives in code rather than in the
 * candidate author's prompt because a prompt constrains only a cooperating
 * author.
 */
function assertCandidateGrantsAreInherited(parent: InspectedPackage, candidate: InspectedPackage) {
  const before = declaredGrants(parent)
  const after = declaredGrants(candidate)
  const refuse = (subject: string, received: string[], expected: string[]): never => {
    throw new Error(
      `Candidate grants ${subject} its parent revision does not declare. ` +
        `received: ${JSON.stringify(received.sort())}, expected: a subset of ${JSON.stringify(expected.sort())}. ` +
        `A candidate revision may only grant capability references the parent already held.`,
    )
  }
  for (const field of CAPABILITY_GRANT_LIST_FIELDS) {
    const allowed = before.lists.get(field)!
    const added = [...after.lists.get(field)!].filter((entry) => !allowed.has(entry))
    if (added.length > 0) refuse(field, added, [...allowed])
  }
  const addedRoles = [...after.baseRoles].filter((role) => !before.baseRoles.has(role))
  if (addedRoles.length > 0) refuse("base_role", addedRoles, [...before.baseRoles])
  if (after.inheritsBaseTools && !before.inheritsBaseTools) {
    refuse("inherit_base_tools", ["true"], ["false"])
  }
}

export const CandidateIntegrityComparisonSchema = z
  .object({
    parent_digest: z.string().length(64),
    candidate_digest: z.string().length(64),
    diff_sha256: z.string().length(64),
    mutable_paths: z.array(z.string()),
    changed_paths: z.array(z.string()).min(1),
    frozen_files: z.array(
      z
        .object({
          path: z.string(),
          parent_sha256: z.string().length(64),
          candidate_sha256: z.string().length(64),
        })
        .strict(),
    ),
  })
  .strict()

export function compareCandidateIntegrity(parent: InspectedPackage, candidate: InspectedPackage) {
  if (parent.namespace !== candidate.namespace || parent.id !== candidate.id) {
    throw new Error("Candidate logical identity must equal its parent")
  }
  if (parent.version === candidate.version) throw new Error("Candidate revision must declare a new package version")
  assertCandidateStructure(candidate)
  assertCandidateGrantsAreInherited(parent, candidate)
  const manifestDescriptorChanged = frozenManifest(parent.manifest) !== frozenManifest(candidate.manifest)
  const parentMutable = candidateMutableTextPaths(parent)
  const candidateMutable = candidateMutableTextPaths(candidate)
  // A path is mutable if either revision declares it: the candidate may add a
  // reference file or a new agent's prompt, and may drop one it no longer
  // declares. Everything outside both closures is T5 — executable and opaque
  // resources — and stays byte-frozen with no additions or removals.
  const mutable = new Set([...parentMutable, ...candidateMutable])
  const parentFiles = new Map(parent.files.map((file) => [file.path, file]))
  const candidateFiles = new Map(candidate.files.map((file) => [file.path, file]))
  const allPaths = [...new Set([...parentFiles.keys(), ...candidateFiles.keys()])].sort()
  const changedPaths: string[] = ["expert-squad.jsonc"]
  const frozenFiles: Array<{ path: string; parent_sha256: string; candidate_sha256: string }> = []
  for (const path of allPaths) {
    if (path === "expert-squad.jsonc") continue
    const before = parentFiles.get(path)
    const after = candidateFiles.get(path)
    if (mutable.has(path)) {
      if (before?.sha256 !== after?.sha256) changedPaths.push(path)
      continue
    }
    if (!before || !after) throw new Error(`Candidate changed the frozen executable file set at ${path}`)
    if (before.sha256 !== after.sha256) throw new Error(`Candidate changed frozen file ${path}`)
    frozenFiles.push({ path, parent_sha256: before.sha256, candidate_sha256: after.sha256 })
  }
  if (changedPaths.length === 1 && !manifestDescriptorChanged)
    throw new Error("Candidate revision must change at least one mutable text path or declared manifest field")
  changedPaths.sort()
  const diffSHA256 = createHash("sha256")
    .update(
      canonicalJSON({
        parent_digest: parent.package_digest,
        candidate_digest: candidate.package_digest,
        changed_paths: changedPaths,
        frozen_files: frozenFiles,
      }),
    )
    .digest("hex")
  return CandidateIntegrityComparisonSchema.parse({
    parent_digest: parent.package_digest,
    candidate_digest: candidate.package_digest,
    diff_sha256: diffSHA256,
    mutable_paths: parentMutable,
    changed_paths: changedPaths,
    frozen_files: frozenFiles,
  })
}
