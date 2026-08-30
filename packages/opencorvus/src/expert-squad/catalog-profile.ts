import {
  ExpertSquadCatalogIndexEntrySchema,
  ExpertSquadCatalogInspectionSchema,
  type ExpertSquadCatalogIndexEntry,
  type ExpertSquadCatalogInspection,
  type ExpertSquadCatalogProfile,
  type ExpertSquadCatalogSummary,
} from "@/expert-squad/catalog"
import { BUILTIN_EXPERT_SQUAD_NAMESPACE } from "@/expert-squad/id"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import type { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import type { ExpertSquadGenerationMetadata } from "@/expert-squad/installation-metadata"
import {
  ProjectionHashDomain,
  canonicalProjectionHash,
  canonicalStringSet,
  compareCanonicalStrings,
  textSHA256,
} from "@/expert-squad/projection-hash"

export type ExpertSquadCatalogPackage = {
  namespace: string
  id: string
  version: string
  selector: ExpertSquadRegistry.SelectorMetadata
  selectorInstructions?: string
  readmeContent?: string
  root?: string
  manifestPath?: string
  readmePath?: string
  installationScope?: ExpertSquadPackageLocations.InstallationScope
  generation?: ExpertSquadGenerationMetadata
  packageDigest?: string
  manifest: ExpertSquadRegistry.Manifest
}

function displayLabel(label: string, namespace: string): string {
  return namespace === BUILTIN_EXPERT_SQUAD_NAMESPACE ? label : `${namespace}/${label}`
}

function declarationResources(projection: ExpertSquadRegistry.Projection) {
  return {
    capability_refs: canonicalStringSet(projection.capability_refs, "catalog capability_refs"),
  }
}

function declarationCapabilityProjection(
  manifest: ExpertSquadRegistry.Manifest,
): ExpertSquadCatalogProfile["capability_projection"] {
  const scheduler = manifest.capability_projection.scheduler
  return {
    scheduler: {
      base_role: "orchestrator",
      ...(scheduler.prompt ? { prompt: scheduler.prompt } : {}),
      ...declarationResources(scheduler),
    },
    agents: Object.fromEntries(
      Object.entries(manifest.capability_projection.agents)
        .sort(([left], [right]) => compareCanonicalStrings(left, right))
        .map(([agentID, projection]) => [
          agentID,
          {
            label: projection.label,
            ...(projection.description ? { description: projection.description } : {}),
            base_role: projection.base_role,
            ...(projection.execution_contract ? { execution_contract: projection.execution_contract } : {}),
            ...(projection.prompt ? { prompt: projection.prompt } : {}),
            ...declarationResources(projection),
          },
        ]),
    ),
    virtual_workflows: Object.fromEntries(
      Object.entries(manifest.capability_projection.virtual_workflows)
        .sort(([left], [right]) => compareCanonicalStrings(left, right))
        .map(([workflowID, workflow]) => [
          workflowID,
          {
            label: workflow.label,
            description: workflow.description,
            nodes: Object.fromEntries(
              Object.entries(workflow.nodes)
                .sort(([left], [right]) => compareCanonicalStrings(left, right))
                .map(([nodeID, node]) => [nodeID, { ...node, depends_on: [...node.depends_on] }]),
            ),
          },
        ]),
    ),
  }
}

export function catalogProfileFromPackage(input: {
  pkg: ExpertSquadCatalogPackage
  builtIn: boolean
}): ExpertSquadCatalogProfile {
  const capabilityProjection = declarationCapabilityProjection(input.pkg.manifest)
  const capabilitySets = Object.fromEntries(
    Object.entries(input.pkg.manifest.capability_sets)
      .sort(([left], [right]) => compareCanonicalStrings(left, right))
      .map(([setID, definition]) => [
        setID,
        {
          description: definition.description,
          member_refs: canonicalStringSet(definition.member_refs, `catalog capability_sets.${setID}.member_refs`),
        },
      ]),
  )
  return {
    id: input.pkg.id,
    name: ExpertSquadRegistry.displayName(input.pkg.manifest),
    label: input.pkg.manifest.label,
    description: input.pkg.manifest.description,
    built_in: input.builtIn,
    editable: false,
    product_pillars: input.pkg.manifest.product_pillars,
    ...(input.pkg.manifest.system_role ? { system_role: input.pkg.manifest.system_role } : {}),
    ...(input.pkg.manifest.configuration ? { configuration: input.pkg.manifest.configuration } : {}),
    capability_sets: capabilitySets,
    declaration_hash: canonicalProjectionHash(ProjectionHashDomain.catalogDeclaration, {
      namespace: input.pkg.namespace,
      expert_squad_id: input.pkg.id,
      version: input.pkg.version,
      product_pillars: input.pkg.manifest.product_pillars,
      system_role: input.pkg.manifest.system_role ?? null,
      name: input.pkg.manifest.name ?? null,
      label: input.pkg.manifest.label,
      description: input.pkg.manifest.description ?? null,
      configuration: input.pkg.manifest.configuration ?? null,
      capability_sets: capabilitySets,
      capability_projection: capabilityProjection,
      readme_sha256: textSHA256(input.pkg.readmeContent ?? ""),
      selector: {
        ref: input.pkg.selector.ref,
        id: input.pkg.selector.id,
        label: input.pkg.selector.label,
        description: input.pkg.selector.description ?? null,
        summary: input.pkg.selector.summary,
        selection_guidance: input.pkg.selector.selection_guidance,
        instructions_sha256: textSHA256(input.pkg.selectorInstructions ?? ""),
      },
    }),
    capability_projection: capabilityProjection,
  }
}

export function catalogSummaryFromPackage(input: {
  pkg: ExpertSquadCatalogPackage
  builtIn: boolean
}): ExpertSquadCatalogSummary {
  const profile = catalogProfileFromPackage(input)
  const selectorInstructions = input.pkg.selectorInstructions ?? ""
  const selector = {
    ref: input.pkg.selector.ref,
    id: input.pkg.selector.id,
    label: input.pkg.selector.label,
    description: input.pkg.selector.description,
    summary: input.pkg.selector.summary,
    selection_guidance: input.pkg.selector.selection_guidance,
    instructions_path: "selector.md" as const,
    instructions: selectorInstructions,
  }
  if (!selector.instructions.trim()) {
    throw new Error(`Expert squad ${input.pkg.id} selector requires top-level selector.md instructions.`)
  }
  const readme = input.pkg.readmeContent ?? ""
  if (!readme.trim()) throw new Error(`Expert squad ${input.pkg.id} README.md is blank.`)
  if (!input.pkg.packageDigest) throw new Error(`Expert squad ${input.pkg.id} is missing its package digest.`)
  const source = input.builtIn
    ? { kind: "built_in" as const }
    : (() => {
        if (!input.pkg.root || !input.pkg.manifestPath || !input.pkg.readmePath) {
          throw new Error(`Installed expert squad ${input.pkg.id} is missing canonical catalog paths.`)
        }
        if (!input.pkg.installationScope) {
          throw new Error(`Installed expert squad ${input.pkg.id} is missing its installation scope.`)
        }
        if (!input.pkg.packageDigest) {
          throw new Error(`Installed expert squad ${input.pkg.id} is missing its package digest.`)
        }
        return {
          kind: "installed_package" as const,
          installation_scope: input.pkg.installationScope,
          package_digest: input.pkg.packageDigest,
          namespace: input.pkg.namespace,
          root: input.pkg.root,
          manifest_path: input.pkg.manifestPath,
          readme_path: input.pkg.readmePath,
          ...(input.pkg.generation ? { generation: input.pkg.generation } : {}),
        }
      })()
  return {
    ...profile,
    version: input.pkg.version,
    package_digest: input.pkg.packageDigest,
    display_label: displayLabel(profile.label, input.pkg.namespace),
    source,
    readme: {
      path: "README.md",
      append_target: "orchestrator",
      content: readme,
    },
    selector,
  }
}

export function catalogIndexFromPackage(input: {
  pkg: ExpertSquadCatalogPackage
  builtIn: boolean
}): ExpertSquadCatalogIndexEntry {
  const source = input.builtIn
    ? { kind: "built_in" as const }
    : (() => {
        if (!input.pkg.installationScope) {
          throw new Error(`Installed expert squad ${input.pkg.id} is missing its installation scope.`)
        }
        return {
          kind: "installed_package" as const,
          installation_scope: input.pkg.installationScope,
          namespace: input.pkg.namespace,
        }
      })()
  return ExpertSquadCatalogIndexEntrySchema.parse({
    id: input.pkg.id,
    name: ExpertSquadRegistry.displayName(input.pkg.manifest).slice(0, 160),
    display_label: displayLabel(input.pkg.manifest.label, input.pkg.namespace).slice(0, 240),
    ...(input.pkg.manifest.description?.length
      ? { description: input.pkg.manifest.description.slice(0, 1_000) }
      : {}),
    built_in: input.builtIn,
    product_pillars: input.pkg.manifest.product_pillars,
    ...(input.pkg.manifest.system_role ? { system_role: input.pkg.manifest.system_role } : {}),
    source,
  })
}

export function catalogInspectionFromPackage(input: {
  pkg: ExpertSquadCatalogPackage
  builtIn: boolean
  workflows: ExpertSquadCatalogInspection["workflows"]
  workflowCount: number
  nextWorkflowCursor?: string | null
}): ExpertSquadCatalogInspection {
  return ExpertSquadCatalogInspectionSchema.parse({
    ...catalogIndexFromPackage(input),
    label: input.pkg.manifest.label.slice(0, 160),
    version: input.pkg.version.slice(0, 80),
    selector: {
      summary: input.pkg.selector.summary.slice(0, 1_000),
      selection_guidance: input.pkg.selector.selection_guidance.slice(0, 2_000),
    },
    workflow_count: input.workflowCount,
    workflows: input.workflows,
    next_workflow_cursor: input.nextWorkflowCursor ?? null,
  })
}
