import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { CapabilitySearchInput } from "@/capability/descriptor"
import { searchCapabilityCatalog } from "@/capability/catalog"
import { RuntimeCapabilityCatalog } from "./capability-runtime-catalog"
import { tool as aiTool } from "ai"
import { createAiSdkToolFromInfo } from "./ai-sdk-adapter"
import { Tool } from "./tool"
import { missionVisibleExpertSquadIDs, requireMissionSession } from "@/mission/session"

export const CAPABILITY_SEARCH_TOOL_ID = "capability_search" as const
export const CAPABILITY_SEARCH_DESCRIPTION =
  'Search the caller-visible capability catalog by fuzzy text and exact filters. Stored kind "tool" means a platform tool and "mcp_tool" means a Model Context Protocol tool; omit kinds to search both, or use next_owner_kinds:["call_tool"] for every executable capability. Results are metadata references only: this tool never mounts, authenticates, approves, or executes a capability.'

export const CapabilitySearchTool = Tool.define(CAPABILITY_SEARCH_TOOL_ID, async (initContext) => {
  const config = initContext?.config ?? (await Config.get())
  return {
    description: CAPABILITY_SEARCH_DESCRIPTION,
    parameters: CapabilitySearchInput,
    async execute(params, ctx) {
      const input = CapabilitySearchInput.parse(params)
      const { caller, snapshot } = await RuntimeCapabilityCatalog.snapshot({
        config,
        sessionID: ctx.sessionID,
        agentID: ctx.agent,
        executionToolIDs: ctx.executionSurface.toolIDs,
        harnessProjection: ctx.executionSurface.harness_projection,
      })
      const mission = caller === "mission" ? await requireMissionSession(ctx.sessionID) : undefined
      const effectiveInput = mission ? { ...input, product_pillar: mission.productPillar } : input
      const results = searchCapabilityCatalog(snapshot, caller, effectiveInput)
      const visibleExpertSquadCount = snapshot.views.filter(
        (entry) => entry.descriptor_ref.kind === "expert_squad" && entry.discoverable_by.includes(caller),
      ).length
      const heldExpertSquadCount = mission ? missionVisibleExpertSquadIDs(mission).length : undefined
      const productPillar = mission?.productPillar ?? input.product_pillar
      const requestedProductPillar = input.product_pillar
      return {
        title: "Capability search",
        metadata: {
          catalog_revision: snapshot.catalog_revision,
          caller,
          result_count: results.length,
          visible_expert_squad_count: visibleExpertSquadCount,
          ...(heldExpertSquadCount !== undefined ? { held_expert_squad_count: heldExpertSquadCount } : {}),
          ...(productPillar ? { product_pillar: productPillar } : {}),
          ...(requestedProductPillar && requestedProductPillar !== productPillar
            ? { requested_product_pillar: requestedProductPillar }
            : {}),
        },
        output: JSON.stringify(
          {
            catalog_revision: snapshot.catalog_revision,
            caller,
            visible_expert_squad_count: visibleExpertSquadCount,
            ...(heldExpertSquadCount !== undefined ? { held_expert_squad_count: heldExpertSquadCount } : {}),
            ...(productPillar ? { product_pillar: productPillar } : {}),
            ...(requestedProductPillar && requestedProductPillar !== productPillar
              ? { requested_product_pillar: requestedProductPillar }
              : {}),
            results,
          },
          null,
          2,
        ),
      }
    },
  }
})

export function createCapabilitySearchAiTool(input: { taskID: string; signal?: AbortSignal }) {
  return aiTool({
    description: CAPABILITY_SEARCH_DESCRIPTION,
    inputSchema: CapabilitySearchInput,
    execute: async (args, options) => {
      const meta = (options as { opencorvus?: Record<string, unknown> } | undefined)?.opencorvus
      const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
      const adapted = await createAiSdkToolFromInfo({
        info: CapabilitySearchTool,
        agent: "orchestrator",
        taskID: input.taskID,
        signal: input.signal,
        initCtx: {
          config: await EffectiveConfig.effective({
            taskID: input.taskID,
            sessionID,
          }),
        },
      })
      if (typeof adapted.execute !== "function") {
        throw new Error("capability_search: AI SDK adapter did not expose an executable Tool")
      }
      return adapted.execute(args, options)
    },
  })
}
