import { CapabilitySearchInput } from "@/capability/descriptor"
import {
  CAPABILITY_REVEAL_OWNER_EXTRA_KEY,
  type CapabilityRevealOwner,
} from "@/capability/reveal-owner"
import { Tool } from "./tool"

export const CAPABILITY_SEARCH_TOOL_ID = "capability_search" as const
export const CAPABILITY_SEARCH_DESCRIPTION =
  'Search the occurrence-bound catalog or reveal up to five exact refs for the next model step. Put known refs from current instructions or results directly in exact_refs; group currently needed leaves in one call. Every ref is validated against the frozen catalog and grants. Discover unknown refs by name or purpose; never guess owners. Deactivate refs no longer needed. Non-empty structural filters are ANDed; omitted or empty filters do not narrow the authorized view. queries=[""] returns a bounded window, not the inventory. search_window gives candidate, matched and returned counts; refine incomplete searches before concluding a capability is unavailable. For held Expert Squads use kinds=["expert_squad"] and omit next_owner_kinds or use ["create_task_with_expert_squad"]. Search is not execution, authentication or approval. Fuzzy hits never activate implicitly.'

export const CapabilitySearchTool = Tool.define(CAPABILITY_SEARCH_TOOL_ID, async () => {
  return {
    description: CAPABILITY_SEARCH_DESCRIPTION,
    parameters: CapabilitySearchInput,
    async execute(params, ctx) {
      const owner = ctx.extra?.[CAPABILITY_REVEAL_OWNER_EXTRA_KEY] as CapabilityRevealOwner | undefined
      const toolPartID = typeof ctx.extra?.toolPartID === "string" ? ctx.extra.toolPartID : undefined
      if (!owner || !toolPartID) {
        throw new Error("capability_search requires its occurrence-bound reveal owner and ToolPart identity.")
      }
      return owner.execute(params, {
        callID: ctx.callID,
        messageID: ctx.messageID,
        sessionID: ctx.sessionID,
        toolPartID,
      })
    },
  }
})
