import { createBatchTool } from "./batch"
import { Tool } from "./tool"
import { Config } from "../config/config"
import { Plugin } from "../plugin"
import { Log } from "@/util/log"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { assertBuiltInToolProviderClosure, builtInGlobalTools, builtInToolProviderState } from "./global-tools"
import { BATCH_TOOL_ID, TASK_ARTIFACT_TOOL_IDS } from "./tool-id-catalog"
import { isSkillFamilyToolID } from "./skill"
import type { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { CapabilityRules } from "@/capability/rules"
import { visibleExecutionToolIDs } from "./execution-surface"

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

  async function all(): Promise<readonly Tool.Info[]> {
    return builtInGlobalTools()
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  type ToolVisibility =
    | { kind: "agent-template" }
    | {
        kind: "projected-worker"
        toolIDs: readonly string[]
        batchTargetExclusions: readonly string[]
        artifactSnapshotSource: "current_task_project" | "merged_primary_commit"
      }

  async function materialize(
    model: {
      providerID: string
      modelID: string
    },
    agent?: SessionAgentRuntime,
    agentID?: string,
    config?: Config.Info,
    visibility: ToolVisibility = { kind: "agent-template" },
  ) {
    let items = await all()
    const providerEnvironment = { batchToolEnabled: config?.experimental?.batch_tool === true }

    const visibleToolIDs =
      visibility.kind === "projected-worker"
        ? new Set(visibility.toolIDs)
        : agent
          ? AgentToolPool.visibleToolIDs(agent.tools)
          : undefined
    if (visibleToolIDs) items = items.filter((t) => visibleToolIDs.has(t.id))
    items = items.filter((toolInfo) => builtInToolProviderState(toolInfo.id, providerEnvironment) !== "unavailable")

    const batchToolAllowed =
      builtInToolProviderState(BATCH_TOOL_ID, providerEnvironment) === "available" &&
      (!visibleToolIDs || visibleToolIDs.has(BATCH_TOOL_ID))

    const result = await Promise.all(
      items
        .filter((t) => {
          // SessionLoop initializes SkillTool from the exact projected-agent
          // skill surface after the rest of the turn tool set is known.
          if (isSkillFamilyToolID(t.id)) return false

          if (visibility.kind === "agent-template") {
            // Native agents retain their provider-specific editing interface.
            const usePatch =
              model.modelID.includes("gpt-") && !model.modelID.includes("oss") && !model.modelID.includes("gpt-4")
            if (t.id === "apply_patch") return usePatch
            if (t.id === "edit" || t.id === "write") return !usePatch
          }

          return true
        })
        .map(async (t) => {
          using _ = log.timeDebug(t.id)
          const tool = await t.init({
            agentID,
            config,
            artifactSnapshotSource:
              visibility.kind === "projected-worker" ? visibility.artifactSnapshotSource : undefined,
          })
          const output = {
            description: tool.description,
            parameters: tool.parameters,
          }
          await Plugin.trigger("tool.definition", { toolID: t.id }, output)
          return {
            id: t.id,
            ...tool,
            description: output.description,
            parameters: output.parameters,
          }
        }),
    )
    if (batchToolAllowed) {
      const batchTargetExclusions =
        visibility.kind === "projected-worker" ? new Set(visibility.batchTargetExclusions) : new Set<string>()
      const batchTargets = result.filter((item) => !batchTargetExclusions.has(item.id))
      if (batchTargets.length > 0) {
        const batchInfo = createBatchTool(batchTargets)
        const tool = await batchInfo.init({ agentID, config })
        const output = {
          description: tool.description,
          parameters: tool.parameters,
        }
        await Plugin.trigger("tool.definition", { toolID: batchInfo.id }, output)
        result.push({
          id: batchInfo.id,
          ...tool,
          description: output.description,
          parameters: output.parameters,
        })
      }
    }
    if (visibility.kind === "projected-worker") {
      const requested = visibility.toolIDs
      const requestedSet = new Set(requested)
      if (requestedSet.size !== requested.length) {
        throw new Error("Projected worker registry tool IDs must be unique")
      }
      const expected = [...requestedSet]
        .filter((toolID) => builtInToolProviderState(toolID, providerEnvironment) !== "deferred")
        .sort()
      const actual = result.map((item) => item.id).sort()
      if (new Set(actual).size !== actual.length || JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Projected worker registry materialization mismatch: expected ${expected.join(",") || "<none>"}, found ${actual.join(",") || "<none>"}`,
        )
      }
    }
    return result
  }

  export async function tools(
    model: {
      providerID: string
      modelID: string
    },
    config?: Config.Info,
  ) {
    return materialize(model, undefined, undefined, config, { kind: "agent-template" })
  }

  export async function runtimeTools(
    model: { providerID: string; modelID: string },
    agent: SessionAgentRuntime,
    agentID: string,
    config: Config.Info,
  ) {
    return materialize(model, agent, agentID, config, { kind: "agent-template" })
  }

  export async function projectedWorkerTools(
    model: {
      providerID: string
      modelID: string
    },
    agent: SessionAgentRuntime,
    agentID: string,
    runtimeTemplateID: RuntimeTemplateID,
    config: Config.Info,
    toolIDs: readonly string[],
    policy: {
      sessionPermission?: CapabilityRules.Ruleset
      toolSwitches?: Readonly<Record<string, boolean>>
      batchTargetExclusions: readonly string[]
      artifactSnapshotSource: "current_task_project" | "merged_primary_commit"
    },
  ) {
    RuntimeTemplateRegistry.get(runtimeTemplateID)
    if (new Set(toolIDs).size !== toolIDs.length) {
      throw new Error("Projected worker registry tool IDs must be unique")
    }
    if (new Set(policy.batchTargetExclusions).size !== policy.batchTargetExclusions.length) {
      throw new Error("Projected worker batch target exclusions must be unique")
    }
    const projectable = AgentToolPool.projectableRuntimeTemplateBuiltInToolIDs(runtimeTemplateID)
    const providerEnvironment = { batchToolEnabled: config.experimental?.batch_tool === true }
    for (const toolID of toolIDs) {
      if (!projectable.has(toolID)) {
        throw new Error(`Runtime template ${runtimeTemplateID} cannot project registry tool ${JSON.stringify(toolID)}`)
      }
      if (builtInToolProviderState(toolID, providerEnvironment) === "unavailable") {
        throw new Error(
          `Runtime template ${runtimeTemplateID} cannot materialize unavailable registry tool ${JSON.stringify(toolID)}`,
        )
      }
    }
    assertBuiltInToolProviderClosure(toolIDs, providerEnvironment, `Runtime template ${runtimeTemplateID}`)
    const permission = CapabilityRules.merge(agent.permission, policy.sessionPermission)
    const policyVisibleToolIDs = new Set(
      visibleExecutionToolIDs({
        toolIDs,
        permission,
        switches: policy.toolSwitches,
      }),
    )
    const requiredTransportToolIDs = new Set<string>(
      TASK_ARTIFACT_TOOL_IDS.filter((toolID) => toolIDs.includes(toolID)),
    )
    let visibleToolIDs = toolIDs.filter(
      (toolID) => policyVisibleToolIDs.has(toolID) || requiredTransportToolIDs.has(toolID),
    )
    if (visibleToolIDs.includes(BATCH_TOOL_ID)) {
      const batchTargetExclusions = new Set(policy.batchTargetExclusions)
      const batchTargets = visibleToolIDs.filter(
        (toolID) =>
          toolID !== BATCH_TOOL_ID &&
          !batchTargetExclusions.has(toolID) &&
          builtInToolProviderState(toolID, providerEnvironment) !== "deferred",
      )
      if (batchTargets.length === 0) visibleToolIDs = visibleToolIDs.filter((toolID) => toolID !== BATCH_TOOL_ID)
    }
    const tools = await materialize(model, agent, agentID, config, {
      kind: "projected-worker",
      toolIDs: visibleToolIDs,
      batchTargetExclusions: policy.batchTargetExclusions,
      artifactSnapshotSource: policy.artifactSnapshotSource,
    })
    return {
      tools,
      visibleToolIDs: Object.freeze([...visibleToolIDs]) as readonly string[],
      permission,
    }
  }
}
