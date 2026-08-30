import { Tool } from "./tool"
import { Config } from "../config/config"
import { Plugin } from "../plugin"
import { Log } from "@/util/log"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { builtInGlobalTools, builtInToolProviderState } from "./global-tools"
import { isSkillFamilyToolID } from "./skill"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

  async function all(): Promise<readonly Tool.Info[]> {
    return builtInGlobalTools()
  }

  function providerCompatible(toolID: string, modelID: string): boolean {
    const usePatch = modelID.includes("gpt-") && !modelID.includes("oss") && !modelID.includes("gpt-4")
    if (toolID === "apply_patch") return usePatch
    if (toolID === "edit" || toolID === "write") return !usePatch
    return true
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  type ToolVisibility =
    | { kind: "agent-template" }
    | {
        kind: "projected-worker"
        toolIDs: readonly string[]
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
    const providerEnvironment = {}

    const visibleToolIDs =
      visibility.kind === "projected-worker"
        ? new Set(visibility.toolIDs)
        : agent
          ? AgentToolPool.visibleToolIDs(agent.tools)
          : undefined
    if (visibleToolIDs) items = items.filter((t) => visibleToolIDs.has(t.id))
    items = items.filter((toolInfo) => builtInToolProviderState(toolInfo.id, providerEnvironment) !== "unavailable")

    const result = await Promise.all(
      items
        .filter((t) => {
          // SessionLoop initializes SkillTool from the exact projected-agent
          // skill surface after the rest of the turn tool set is known.
          if (isSkillFamilyToolID(t.id)) return false

          return providerCompatible(t.id, model.modelID)
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
    if (visibility.kind === "projected-worker") {
      const requested = visibility.toolIDs
      const requestedSet = new Set(requested)
      if (requestedSet.size !== requested.length) {
        throw new Error("Projected worker registry tool IDs must be unique")
      }
      const expected = [...requestedSet]
        .filter((toolID) => builtInToolProviderState(toolID, providerEnvironment) === "available")
        .filter((toolID) => providerCompatible(toolID, model.modelID))
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

  /** Resolve Provider-compatible registry identity without initializing definitions. */
  export async function projectableRuntimeToolIDs(
    model: { providerID: string; modelID: string },
    _agent: SessionAgentRuntime,
    config: Config.Info,
    requestedToolIDs: readonly string[],
  ): Promise<string[]> {
    const known = new Set((await all()).map((item) => item.id))
    const environment = {}
    const result: string[] = []
    for (const toolID of requestedToolIDs) {
      if (!known.has(toolID)) continue
      const state = builtInToolProviderState(toolID, environment)
      if (state === "unavailable" || !providerCompatible(toolID, model.modelID)) continue
      result.push(toolID)
    }
    return [...new Set(result)]
  }

  /** Materialize only the exact requested built-in leaf definitions. */
  export async function exactRuntimeTools(
    model: { providerID: string; modelID: string },
    agent: SessionAgentRuntime,
    agentID: string,
    config: Config.Info,
    toolIDs: readonly string[],
    options?: { artifactSnapshotSource?: "current_task_project" | "merged_primary_commit" },
  ) {
    if (new Set(toolIDs).size !== toolIDs.length) throw new Error("Exact registry Tool IDs must be unique")
    const requested = new Set(toolIDs)
    const known = new Set(await ids())
    for (const toolID of requested) {
      if (!known.has(toolID)) throw new Error(`Unknown exact registry Tool ${JSON.stringify(toolID)}`)
    }
    return materialize(model, agent, agentID, config, {
      kind: "projected-worker",
      toolIDs,
      artifactSnapshotSource: options?.artifactSnapshotSource ?? "current_task_project",
    })
  }

}
