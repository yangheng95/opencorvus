import { capabilityRef, CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"
import { CatalogOccurrenceBinding } from "../../src/capability/catalog-binding"
import { bindHarnessProjection, harnessGrantedRefs } from "../../src/capability/harness-projection"
import type { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Message, Session } from "../../src/session"
import { SessionLoop } from "../../src/session/loop"
import { MessageStore } from "../../src/session/message-store"
import type { SessionProcessor } from "../../src/session/processor"
import { SessionRuntimeContractStore } from "../../src/session/runtime-contract"
import type { SessionAgentRuntime } from "../../src/agent/session-agent-runtime"
import { RuntimeCapabilityCatalog } from "../../src/tool/capability-runtime-catalog"
import { ToolRegistry } from "../../src/tool/registry"
import type { ProviderToolNameOwner } from "../../src/tool/provider-name-authority"
import { jsonSchema, tool, type Tool as AITool } from "ai"
import {
  capabilityRevealOccurrenceParts,
  normalizedProviderToolDefinition,
} from "../../src/capability/reveal-owner"
import {
  capabilityRevealBaseDefinitions,
  foldCapabilityRevealReceipts,
} from "../../src/capability/reveal-receipt"

export async function bindTestCapabilityOccurrence(input: {
  config: Config.Info
  model: Provider.Model
  session: Session.Info
  assistant: Message.Assistant
  agent: SessionAgentRuntime
  agentID: string
  includeMcpTools?: boolean
}) {
  const parent = await MessageStore.get({ sessionID: input.session.id, messageID: input.assistant.parentID })
  if (!parent.parts.some((part) => part.type === "text")) {
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID: input.session.id,
      messageID: parent.info.id,
      type: "text",
      text: "Test capability occurrence.",
      kind: "user_content",
    })
  }
  const refreshedParent = await MessageStore.get({ sessionID: input.session.id, messageID: input.assistant.parentID })
  const runtimeContract = SessionRuntimeContractStore.get(input.session.id)
  const grants = await SessionLoop.resolveOccurrenceHarnessGrants({
    runtimeContract,
    agentID: input.agentID,
    session: input.session,
    agent: input.agent,
    config: input.config,
    includeMcpTools: input.includeMcpTools,
  })
  const executableRefs = harnessGrantedRefs(grants, "execute")
  const registryIDs = executableRefs
    .filter((ref) => ref.kind === "tool" && ref.owner_ref === "tool-registry")
    .map((ref) => ref.local_ref)
  const projectableRegistryIDs = await ToolRegistry.projectableRuntimeToolIDs(
    { providerID: input.model.providerID, modelID: input.model.api.id },
    input.agent,
    input.config,
    registryIDs,
  )
  const executionToolIDs = [
    ...projectableRegistryIDs,
    ...executableRefs
      .filter((ref) => ref.kind === "mcp_tool" || (ref.kind === "tool" && ref.owner_ref !== "tool-registry"))
      .map((ref) => ref.local_ref),
  ]
  const materializationScope = await CatalogOccurrenceBinding.materializationScope({
    model: input.model,
    config: input.config,
  })
  const occurrenceAssistant = {
    ...input.assistant,
    acceptedInputMessageIDs: [input.assistant.parentID],
  }
  let binding = CatalogOccurrenceBinding.bindingFromInput(refreshedParent)
  let payload
  if (binding) {
    payload = await CatalogOccurrenceBinding.read({ projectID: Instance.project.id, binding })
    await Session.beginAssistantReply(occurrenceAssistant)
  } else {
    const catalog = await RuntimeCapabilityCatalog.snapshot({
      config: input.config,
      sessionID: input.session.id,
      agentID: input.agentID,
      executionToolIDs,
      harnessGrants: grants,
      permission: [],
    })
    payload = CatalogOccurrenceBinding.payload({
      snapshot: catalog.snapshot,
      mcpToolParentBindings: catalog.mcpToolParentBindings,
      materializationScope,
      runtimeContract,
    })
    binding = await CatalogOccurrenceBinding.publish({ projectID: Instance.project.id, payload })
    await CatalogOccurrenceBinding.bindAndBeginAssistant({
      projectID: Instance.project.id,
      assistant: occurrenceAssistant,
      parent: refreshedParent,
      binding,
    })
  }
  return {
    grants,
    binding,
    payload,
    harnessProjection: bindHarnessProjection(grants, binding),
    ref(localRef: string): CapabilityRef {
      const matches = harnessGrantedRefs(grants, "execute").filter(
        (ref) => ref.kind !== "capability_set" && ref.local_ref === localRef,
      )
      if (matches.length !== 1) {
        throw new Error(`Test Harness grants ${matches.length} exact refs for ${JSON.stringify(localRef)}.`)
      }
      return matches[0]!
    },
  }
}

export async function resolveTestCapabilityTools(input: {
  config: Config.Info
  model: Provider.Model
  session: Session.Info
  assistant: Message.Assistant
  processor: SessionProcessor.Info
  agent: SessionAgentRuntime
  agentID: string
  messages: Message.WithParts[]
  activeLocalRefs?: readonly string[]
  tools?: Record<string, boolean>
  includeMcpTools?: boolean
  extra?: Record<string, unknown>
  reservedProviderToolNames?: readonly { name: string; owner: ProviderToolNameOwner }[]
}): Promise<{ tools: Record<string, AITool>; occurrence: Awaited<ReturnType<typeof bindTestCapabilityOccurrence>> }> {
  const occurrence = await bindTestCapabilityOccurrence(input)
  const stableHarnessProjection = occurrence.harnessProjection
  const reservedProviderTools = (input.reservedProviderToolNames ?? []).map((reservation) => ({
    ...reservation,
    tool: tool({
      description: `Reserved Provider Tool ${reservation.name}.`,
      inputSchema: jsonSchema({ type: "object", additionalProperties: false }),
      async execute() {
        return { output: "reserved", title: reservation.name, metadata: {} }
      },
    }),
  }))
  const resolve = (reservations?: typeof input.reservedProviderToolNames) =>
    SessionLoop.resolveTools({
      agent: input.agent,
      agentID: input.agentID,
      model: input.model,
      session: input.session,
      processor: input.processor,
      messages: input.messages,
      config: input.config,
      tools: input.tools,
      includeMcpTools: input.includeMcpTools,
      extra: input.extra,
      harnessProjection: stableHarnessProjection,
      occurrenceID: input.assistant.parentID,
      reservedProviderTools: reservations?.map((reservation) => {
        const reserved = reservedProviderTools.find((candidate) => candidate.name === reservation.name)
        if (!reserved) throw new Error(`Missing reserved test Provider Tool ${reservation.name}.`)
        return reserved
      }),
    })
  let tools = await resolve(input.reservedProviderToolNames)
  const searchTool = tools.capability_search
  if (!searchTool) throw new Error("Test occurrence has no capability_search Tool.")
  const baseDefinition = capabilityRevealBaseDefinitions([
    normalizedProviderToolDefinition("capability_search", searchTool),
    ...reservedProviderTools.map((reservation) =>
      normalizedProviderToolDefinition(reservation.name, reservation.tool),
    ),
  ])
  const prior = foldCapabilityRevealReceipts({
    occurrenceID: input.assistant.parentID,
    parts: await capabilityRevealOccurrenceParts({
      sessionID: input.session.id,
      occurrenceID: input.assistant.parentID,
    }),
    harnessProjectionHash: stableHarnessProjection.projection_hash,
    catalogSnapshotRef: stableHarnessProjection.catalog_snapshot_ref,
    catalogSnapshotHash: stableHarnessProjection.catalog_snapshot_hash,
    baseDefinition,
  })
  if (prior.revision === 0) {
    const initialToolNames = Object.keys(tools).sort()
    if (JSON.stringify(initialToolNames) !== JSON.stringify(["capability_search"])) {
      throw new Error(
        `Initial Provider surface must contain only capability_search; found ${initialToolNames.join(",") || "<none>"}.`,
      )
    }
  }
  const activeRefs = [...new Set(input.activeLocalRefs ?? [])]
    .map((localRef) => occurrence.ref(localRef))
    .filter((ref) => !prior.active.has(CapabilityRefCodec.encode(ref)))
  for (let offset = 0; offset < activeRefs.length; offset += 5) {
    const exactRefs = activeRefs.slice(offset, offset + 5)
    const search = tools.capability_search
    if (!search?.execute) throw new Error("Test occurrence has no capability_search Tool.")
    const revealResult = (await search.execute(
      { queries: [""], exact_refs: exactRefs, deactivate_refs: [], limit: 5 },
      {
        toolCallId: `call_test_reveal_${offset}_${Identifier.ascending("part")}`,
        messages: [],
        abortSignal: new AbortController().signal,
      },
    )) as { metadata?: Record<string, unknown> }
    const receipt = revealResult.metadata?.opencorvus_capability_reveal_v2 as
      | { harness_projection_hash?: unknown }
      | undefined
    if (receipt?.harness_projection_hash !== occurrence.harnessProjection.projection_hash) {
      throw new Error(
        `Test reveal Harness changed during execution: ${String(receipt?.harness_projection_hash)} != ${occurrence.harnessProjection.projection_hash}.`,
      )
    }
    tools = await resolve(input.reservedProviderToolNames)
  }
  return { tools, occurrence }
}

export function platformToolRef(localRef: string): CapabilityRef {
  return capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: localRef })
}
