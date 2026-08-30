import type { Tool as AITool } from "ai"
import z from "zod"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { projectedTaskToolRuntimeBindingOf } from "@/tool/projected-task-tool-runtime-binding"
import { internalStageToolBindingOf, stageToolMaterializerBindingOf } from "@/agent/stage-tool-materializer"
import { MCP } from "@/mcp"

export type RuntimeToolOwnerKind = "projected" | "stage"
const RuntimeToolFactoryInput = z.json()
type RuntimeToolFactoryInput = z.infer<typeof RuntimeToolFactoryInput>

export interface RuntimeToolLeafBinding {
  readonly tool_id: string
  readonly kind: RuntimeToolOwnerKind
  readonly binding_digest: string
}

export interface RuntimeToolOwner {
  readonly owner_revision: string
  readonly leaves: readonly RuntimeToolLeafBinding[]
  kind(toolID: string): RuntimeToolOwnerKind | undefined
  binding(toolID: string): RuntimeToolLeafBinding | undefined
  exact(toolID: string): Promise<AITool | undefined>
}

export type RuntimeToolLeafFactory = RuntimeToolLeafBinding & {
  readonly factory_input: RuntimeToolFactoryInput
  materialize(): Promise<AITool>
}

function bindingFingerprint(tool: AITool) {
  return {
    projected: projectedTaskToolRuntimeBindingOf(tool as object) ?? null,
    stage: stageToolMaterializerBindingOf(tool as object) ?? null,
    internal_stage: internalStageToolBindingOf(tool as object) ?? null,
    mcp: MCP.toolAuthorityBinding(tool as object) ?? null,
  }
}

/** Admit one immutable exact factory without constructing its Tool object. */
export function bindRuntimeToolFactory(input: {
  toolID: string
  kind: RuntimeToolOwnerKind
  factoryInput: unknown
  materialize: () => AITool | Promise<AITool>
}): RuntimeToolLeafFactory {
  const toolID = input.toolID.trim()
  if (!toolID) throw new Error("Runtime Tool leaf factory requires a nonempty identity.")
  const factoryInput = RuntimeToolFactoryInput.parse(input.factoryInput)
  const digest = canonicalDigestSource("runtime-tool-leaf-factory-v2", {
    tool_id: toolID,
    kind: input.kind,
    factory_input: factoryInput,
  }).sha256
  return Object.freeze({
    tool_id: toolID,
    kind: input.kind,
    binding_digest: digest,
    factory_input: factoryInput,
    async materialize() {
      const tool = await input.materialize()
      if (!tool || typeof tool !== "object") {
        throw new Error(`Runtime Tool leaf factory ${toolID} did not materialize a Tool object.`)
      }
      return tool
    },
  })
}

export function bindRuntimeToolFactories(input: {
  toolIDs: readonly string[]
  kind: RuntimeToolOwnerKind
  factoryInput: (toolID: string) => unknown
  materialize: (toolID: string) => AITool | Promise<AITool>
}): RuntimeToolLeafFactory[] {
  return [...new Set(input.toolIDs)]
    .sort(compareCanonicalStrings)
    .map((toolID) =>
      bindRuntimeToolFactory({
        toolID,
        kind: input.kind,
        factoryInput: input.factoryInput(toolID),
        materialize: () => input.materialize(toolID),
      }),
    )
}

/**
 * Exact owner for process-local Task Tool factories. Admission stores only
 * immutable leaf inputs and closures; a Tool object is constructed after an
 * exact reveal selects that leaf.
 */
export function createRuntimeToolOwner(input: {
  leaves: readonly RuntimeToolLeafFactory[]
}): RuntimeToolOwner {
  const ordered = [...input.leaves].sort((left, right) => compareCanonicalStrings(left.tool_id, right.tool_id))
  const factories = new Map<string, RuntimeToolLeafFactory>()
  for (const leaf of ordered) {
    if (!leaf.tool_id.trim() || !/^[a-f0-9]{64}$/.test(leaf.binding_digest)) {
      throw new Error("Runtime Tool owner contains an invalid leaf factory binding.")
    }
    if (factories.has(leaf.tool_id)) {
      throw new Error(`Runtime Tool owner repeats exact leaf ${leaf.tool_id}.`)
    }
    factories.set(leaf.tool_id, leaf)
  }
  const bindings = Object.freeze(
    ordered.map((leaf) =>
      Object.freeze({ tool_id: leaf.tool_id, kind: leaf.kind, binding_digest: leaf.binding_digest }),
    ),
  )
  const ownerRevision = canonicalDigestSource("session-runtime-tool-owner-v3", bindings).sha256
  return Object.freeze({
    owner_revision: ownerRevision,
    leaves: bindings,
    kind(toolID: string) {
      return factories.get(toolID)?.kind
    },
    binding(toolID: string) {
      return bindings.find((leaf) => leaf.tool_id === toolID)
    },
    async exact(toolID: string) {
      const factory = factories.get(toolID)
      if (!factory) return undefined
      const tool = await factory.materialize()
      canonicalDigestSource("runtime-tool-leaf-materialization-v2", bindingFingerprint(tool))
      return tool
    },
  })
}

export function runtimeToolOwnerIDs(owner: RuntimeToolOwner, kind?: RuntimeToolOwnerKind): string[] {
  return owner.leaves.filter((leaf) => !kind || leaf.kind === kind).map((leaf) => leaf.tool_id)
}
