import type { Tool as AITool } from "ai"
import type { WorkerTurnDescriptor } from "./worker-turn-descriptor"
import type { AgentDispatchAdapterID } from "./dispatch-adapter-contract"
import { DispatchAdapterContractRegistry } from "./dispatch-adapter-contract"
import type { DispatchStageOccurrenceBindingV2 } from "@/capability/catalog-binding"
import { durableToolkitInputRefs } from "@/capability/catalog-binding"
import { canonicalDigestSource, canonicalJSONValue, compareCanonicalStrings } from "@/util/canonical-digest"
import { CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import type { Message } from "@/session/message"
import { normalizeToolResult } from "@/session/tool-result-normalization"
import { compareTimelineOrderKeys } from "@/timeline/order"
import { PermissionAuthority } from "@/permission/authority"

type CollectorHistoryOrder = Pick<Message.ToolPart, "id" | "orderKey">

export class DispatchStageRecoveryAuthorityError extends PermissionAuthority.StaleContinuationError {
  constructor(requestID: string, message: string) {
    super(requestID, message)
    this.name = "DispatchStageRecoveryAuthorityError"
  }
}

/** Canonical total order for durable collector replay, including legacy Parts without timeline keys. */
export function compareDispatchStageCollectorHistory(
  left: CollectorHistoryOrder,
  right: CollectorHistoryOrder,
): number {
  const leftOrderKey = typeof left.orderKey === "string" && left.orderKey.trim() ? left.orderKey : undefined
  const rightOrderKey = typeof right.orderKey === "string" && right.orderKey.trim() ? right.orderKey : undefined
  if (leftOrderKey && !rightOrderKey) return -1
  if (!leftOrderKey && rightOrderKey) return 1
  if (leftOrderKey && rightOrderKey) {
    const timelineComparison = compareTimelineOrderKeys(leftOrderKey, rightOrderKey)
    if (timelineComparison !== 0) return timelineComparison
  }
  return compareCanonicalStrings(left.id, right.id)
}

export function createRecoveredDispatchStageToolFactory(input: {
  continuationRequestID: string
  payload: WorkerTurnDescriptor.Payload
  occurrenceBinding: DispatchStageOccurrenceBindingV2
  projectDirectory: string
  toolDirectory: string
  historyParts: readonly Message.Part[]
}) {
  const recoveryAuthorityError = (message: string): never => {
    throw new DispatchStageRecoveryAuthorityError(input.continuationRequestID, message)
  }
  const adapterID = input.payload.identity.dispatchAdapterID
  if (
    input.occurrenceBinding.adapter_id !== adapterID ||
    input.occurrenceBinding.adapter_abi_version !== input.payload.identity.dispatchAdapterABIVersion
  ) {
    recoveryAuthorityError(`Recovered dispatch-stage factory authority changed for ${adapterID}.`)
  }
  const expectedDispatchDigest = canonicalDigestSource(
    "dispatch-stage-turn-v1",
    input.payload.dispatchTurn ?? null,
  ).sha256
  if (input.occurrenceBinding.dispatch_turn_digest !== expectedDispatchDigest) {
    recoveryAuthorityError(`Recovered dispatch-stage ${adapterID} dispatch Turn digest changed.`)
  }
  const effectfulBindings = new Map<string, (typeof input.occurrenceBinding.effectful_tools)[number]>()
  for (const entry of input.occurrenceBinding.effectful_tools) {
    const toolID = entry.ref.local_ref
    if (effectfulBindings.has(toolID)) {
      recoveryAuthorityError(`Recovered dispatch-stage ${adapterID} repeats effectful Tool ${toolID}.`)
    }
    effectfulBindings.set(toolID, entry)
  }
  const descriptorEffectfulToolIDs = Object.keys(input.payload.tools.stageMaterializers).sort(compareCanonicalStrings)
  const catalogEffectfulToolIDs = [...effectfulBindings.keys()].sort(compareCanonicalStrings)
  if (canonicalJSONValue(descriptorEffectfulToolIDs) !== canonicalJSONValue(catalogEffectfulToolIDs)) {
    recoveryAuthorityError(`Recovered dispatch-stage ${adapterID} effectful Tool set changed.`)
  }
  for (const toolID of descriptorEffectfulToolIDs) {
    const entry = effectfulBindings.get(toolID)!
    if (
      entry.ref.kind !== "tool" ||
      entry.ref.source !== "platform" ||
      entry.ref.owner_ref !== `dispatch-stage:${adapterID}` ||
      entry.ref.local_ref !== toolID
    ) {
      recoveryAuthorityError(
        `Recovered dispatch-stage ${adapterID}:${toolID} has mismatched effectful ref ${CapabilityRefCodec.encode(entry.ref)}.`,
      )
    }
    const expectedDigest = canonicalDigestSource(
      "dispatch-stage-effectful-materializer-v1",
      input.payload.tools.stageMaterializers[toolID],
    ).sha256
    if (entry.materializer_binding_digest !== expectedDigest) {
      recoveryAuthorityError(`Recovered dispatch-stage ${adapterID}:${toolID} materializer binding changed.`)
    }
  }
  const toolkitInputRefs = durableToolkitInputRefs(input.payload)
  const collectorByToolID = new Map(
    input.occurrenceBinding.collector_tools.map((entry) => [entry.ref.local_ref, entry]),
  )
  let requirementsFactory: ReturnType<
    typeof import("@/requirements/output-tools").createRequirementsOutputToolFactory
  > | undefined
  let frontendFactory: ReturnType<typeof import("@/frontend-design/output-tools").createFrontendDesignOutputTools> | undefined
  let visualQaFactory: ReturnType<typeof import("@/visual-qa/output-tools").createVisualQaOutputTools> | undefined
  let integrityToolsPromise:
    | Promise<Awaited<ReturnType<typeof import("@/integrity/team-agent").createSingleSessionIntegrityToolKit>>>
    | undefined

  const collectorHistory = input.historyParts
    .filter(
      (part): part is Message.ToolPart & { state: Extract<Message.ToolPart["state"], { status: "completed" }> } =>
        part.type === "tool" && part.state.status === "completed" && collectorByToolID.has(part.tool),
    )
    .sort(compareDispatchStageCollectorHistory)

  const replayCollectorHistory = async (resolve: (toolID: string) => AITool | undefined | Promise<AITool | undefined>) => {
    for (const part of collectorHistory) {
      const exact = await resolve(part.tool)
      const execute = exact?.execute
      if (!execute) {
        return recoveryAuthorityError(`Dispatch-stage collector ${adapterID}:${part.tool} has no reducer execution.`)
      }
      const replayed = await execute(part.state.input, {
        toolCallId: part.callID,
        messages: [],
        abortSignal: new AbortController().signal,
      })
      const output = normalizeToolResult(replayed)
      if (output.output !== part.state.output) {
        recoveryAuthorityError(
          `Dispatch-stage collector ${adapterID}:${part.tool} reducer output changed for ${part.callID}.`,
        )
      }
    }
  }

  const assertCollectorBinding = (toolID: string) => {
    const binding = collectorByToolID.get(toolID)
    if (!binding) {
      return recoveryAuthorityError(`Dispatch-stage collector ${adapterID}:${toolID} has no occurrence binding.`)
    }
    const expectedOwner = `dispatch-stage:${adapterID}`
    if (
      binding.ref.kind !== "tool" ||
      binding.ref.owner_ref !== expectedOwner ||
      binding.ref.local_ref !== toolID
    ) {
      recoveryAuthorityError(
        `Dispatch-stage collector ${adapterID}:${toolID} has mismatched ref ${CapabilityRefCodec.encode(binding.ref)}.`,
      )
    }
    const reducerVersion = DispatchAdapterContractRegistry.collectorReducerVersion(adapterID)
    const digest = canonicalDigestSource("dispatch-stage-toolkit-input-v1", {
      tool_id: toolID,
      reducer_version: reducerVersion,
      refs: toolkitInputRefs,
      dispatch_turn: input.payload.dispatchTurn ?? null,
    }).sha256
    if (
      binding.reducer_version !== reducerVersion ||
      canonicalJSONValue(binding.toolkit_input_refs) !== canonicalJSONValue(toolkitInputRefs) ||
      binding.toolkit_input_digest !== digest
    ) {
      recoveryAuthorityError(`Dispatch-stage collector ${adapterID}:${toolID} toolkit input binding changed.`)
    }
  }

  const effectfulInput = (toolID: string): Record<string, unknown> | undefined =>
    input.payload.tools.stageMaterializers[toolID]?.input

  const ensureFrontendFactory = async () => {
    const factoryInput = effectfulInput("capture_frontend_visual_evidence")
    if (!factoryInput) return undefined
    if (!frontendFactory) {
      frontendFactory = (
        await import("@/frontend-design/output-tools")
      ).createFrontendDesignOutputTools(factoryInput as never)
      await replayCollectorHistory((historyToolID) => frontendFactory!.materializeExact(historyToolID))
    }
    return frontendFactory
  }

  const materializeCollectorExact = async (toolID: string): Promise<AITool> => {
    assertCollectorBinding(toolID)
    switch (adapterID as AgentDispatchAdapterID) {
      case "requirements": {
        if (!requirementsFactory) {
          requirementsFactory = (
            await import("@/requirements/output-tools")
          ).createRequirementsOutputToolFactory({ taskID: input.payload.lifecycle.taskID })
          await replayCollectorHistory((historyToolID) => requirementsFactory!.materializeExact(historyToolID))
        }
        const exact = requirementsFactory.materializeExact(toolID)
        if (exact) return exact
        break
      }
      case "frontend_design": {
        const exact = (await ensureFrontendFactory())?.materializeExact(toolID)
        if (exact) return exact
        break
      }
      case "visual_qa": {
        const factoryInput = effectfulInput("register_visual_qa_problem_dom_region")
        if (!factoryInput) break
        if (!visualQaFactory) {
          visualQaFactory = (
            await import("@/visual-qa/output-tools")
          ).createVisualQaOutputTools(factoryInput)
          await replayCollectorHistory((historyToolID) => visualQaFactory!.materializeExact(historyToolID))
        }
        const exact = visualQaFactory.materializeExact(toolID)
        if (exact) return exact
        break
      }
      case "integrity": {
        integrityToolsPromise ??= (async () => {
          const team = await import("@/integrity/team-agent")
          const output = await team.createSingleSessionIntegrityToolKit({
            agentID: input.payload.identity.agentID,
            collector: team.emptyConsensusCollector(),
          })
          await replayCollectorHistory((historyToolID) => output.materializeExact(historyToolID))
          return output
        })()
        const exact = await (await integrityToolsPromise).materializeExact(toolID)
        if (exact) return exact
        break
      }
      default:
        break
    }
    return recoveryAuthorityError(`Dispatch-stage collector ${adapterID}:${toolID} has no exact recovery factory.`)
  }

  const materializeProjectedRuntimeExact = async (toolID: string): Promise<AITool | undefined> => {
    if (adapterID === "frontend_design") {
      const output = (await ensureFrontendFactory())?.materializeExact(toolID)
      if (output) return output
      const visualRegion = (
        await import("@/frontend-design/visual-region-binding-tool")
      ).createVisualRegionBindingPackageToolFactory({ taskID: input.payload.lifecycle.taskID })
      return visualRegion.materializeExact(toolID)
    }
    if (adapterID === "visual_qa") {
      return (await import("@/visual-qa/agent")).createVisualQaEvidenceToolExact(toolID, {
        agentID: input.payload.identity.agentID,
        taskID: input.payload.lifecycle.taskID,
      })
    }
    if (adapterID === "frontend_research") {
      return (await import("@/research/agent")).createResearchWebpageEvidenceToolExact(
        toolID,
        input.payload.identity.agentID,
        { taskID: input.payload.lifecycle.taskID },
      )
    }
    return undefined
  }

  return { materializeCollectorExact, materializeProjectedRuntimeExact }
}
