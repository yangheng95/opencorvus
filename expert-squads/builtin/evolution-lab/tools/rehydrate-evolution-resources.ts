import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"
import {
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  TaskArtifactResourceSetLocatorSchema,
  compareTaskArtifactPathsByUTF8,
  tool,
  type EngineArtifactLocator,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import { EvolutionArtifactSchemas, EvolutionArtifactIntegrityError } from "../lib/evolution-lab/artifacts"

type ResourceIdentity = Readonly<{ path: string; media_type: string; bytes: number; sha256: string }>
type RoleEntry = Readonly<{ role: string; outputPath: string; identity: ResourceIdentity }>

function resolveInsideTree(treeDirectory: string, relativePath: string) {
  const root = path.resolve(treeDirectory)
  const target = path.resolve(root, relativePath)
  const relative = path.relative(root, target)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new EvolutionArtifactIntegrityError(`Evolution rehydration path escapes its staging tree: ${relativePath}`)
  return target
}

async function readEnvelope(locator: EngineArtifactLocator, context: ToolContext) {
  let offset = 0
  let text = ""
  for (;;) {
    const result = await context.host.engineArtifacts.read({
      locator,
      byte_offset: offset,
      max_bytes: 65_536,
      delivery: "inline",
    })
    if (result.chunk.text === undefined)
      throw new EvolutionArtifactIntegrityError("Evolution resource envelope is not readable JSON text")
    text += result.chunk.text
    if (result.chunk.complete) break
    if (result.chunk.next_offset === null)
      throw new EvolutionArtifactIntegrityError("Evolution resource envelope ended before completion")
    offset = result.chunk.next_offset
  }
  await context.host.engineArtifacts.select({ locator, purpose: "Exact portable evolution resource closure" })
  return EngineArtifactEnvelopeSchema.parse(JSON.parse(text))
}

function campaignEntries(
  payload: ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/campaign-spec"]["parse"]>,
) {
  const frozen = payload.frozen_inputs
  return [
    { role: "dataset", outputPath: `dataset/${frozen.dataset.path}`, identity: frozen.dataset },
    ...frozen.cases.map((item) => ({
      role: `case:${item.case_id}`,
      outputPath: `cases/${item.case_id}/${item.resource.path}`,
      identity: item.resource,
    })),
    {
      role: "model_configuration",
      outputPath: `model-configuration/${frozen.model_configuration.path}`,
      identity: frozen.model_configuration,
    },
    { role: "environment", outputPath: `environment/${frozen.environment.path}`, identity: frozen.environment },
    {
      role: "workspace_template",
      outputPath: `workspace/${frozen.workspace_template.path}`,
      identity: frozen.workspace_template,
    },
    {
      role: "permission_snapshot",
      outputPath: `permission/${frozen.permission_snapshot.path}`,
      identity: frozen.permission_snapshot,
    },
    ...frozen.scorer_assets.map((item) => ({
      role: `scorer:${item.scorer_id}`,
      outputPath: `scorers/${item.scorer_id}/${item.resource.path}`,
      identity: item.resource,
    })),
  ] satisfies RoleEntry[]
}

function packageEntries(resources: readonly ResourceIdentity[], role: string): RoleEntry[] {
  return resources.map((identity) => ({ role, outputPath: identity.path, identity }))
}

export default tool({
  description:
    "Rehydrate portable campaign or candidate resource identities from the current Task-owned Engine Artifact resources.",
  args: {
    artifact_locator: EngineArtifactLocatorSchema,
    resource_role: tool.schema.enum(["campaign_inputs", "parent_package", "candidate_package"]),
  },
  async execute(args, context) {
    const envelope = await readEnvelope(args.artifact_locator, context)
    let entries: RoleEntry[]
    let tree: string
    if (args.resource_role === "campaign_inputs") {
      if (envelope.artifact_type !== "evolution-lab/campaign-spec")
        throw new EvolutionArtifactIntegrityError("campaign_inputs requires a campaign-spec Artifact")
      entries = campaignEntries(EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(envelope.payload))
      tree = "campaign-inputs"
    } else {
      if (envelope.artifact_type !== "evolution-lab/candidate-revision")
        throw new EvolutionArtifactIntegrityError(`${args.resource_role} requires a candidate-revision Artifact`)
      const candidate = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse(envelope.payload)
      entries = packageEntries(
        args.resource_role === "parent_package" ? candidate.parent_resources : candidate.candidate_resources,
        args.resource_role,
      )
      tree = "package"
    }
    const resolved = entries.map((entry) => {
      const matches = envelope.resources.filter(
        (resource) =>
          resource.sha256 === entry.identity.sha256 &&
          resource.bytes === entry.identity.bytes &&
          resource.media_type === entry.identity.media_type,
      )
      if (matches.length === 0)
        throw new EvolutionArtifactIntegrityError(
          `Evolution resource ${entry.role}/${entry.identity.path} is absent from the current Task-owned envelope`,
        )
      return { entry, source: matches.toSorted((left, right) => left.path.localeCompare(right.path))[0]! }
    })
    const outputs = resolved
      .map(({ entry, source }) => ({
        role: entry.role,
        outputPath: entry.outputPath,
        mediaType: source.media_type,
        source,
      }))
      .toSorted((left, right) => compareTaskArtifactPathsByUTF8(left.outputPath, right.outputPath))
    const stage = await context.host.taskArtifacts.stage({ trees: [tree] })
    for (const output of outputs) {
      const target = resolveInsideTree(stage.treeDirectories[tree]!, output.outputPath)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, await context.host.taskArtifacts.read(output.source))
    }
    const publication = await context.host.taskArtifacts.publish(stage, {
      snapshot_kind: "catalog",
      files: outputs.map((output) => ({
        tree,
        path: output.outputPath,
        media_type: output.mediaType,
      })),
    })
    const resourcesByPath = new Map(publication.artifacts.map((resource) => [resource.path, resource]))
    return JSON.stringify({
      resource_set: TaskArtifactResourceSetLocatorSchema.parse({ snapshot: publication.snapshot, tree }),
      role_resources: outputs.map((output) => ({
        role: output.role,
        resource: resourcesByPath.get(output.outputPath)!,
      })),
    })
  },
})
