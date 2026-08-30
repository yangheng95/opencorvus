import { CapabilitySearchInput } from "@/capability/descriptor"
import {
  CAPABILITY_REVEAL_OWNER_EXTRA_KEY,
  type CapabilityRevealOwner,
} from "@/capability/reveal-owner"
import { Tool } from "./tool"

export const CAPABILITY_SEARCH_TOOL_ID = "capability_search" as const
export const CAPABILITY_SEARCH_DESCRIPTION =
  'Search the occurrence-bound capability catalog, explicitly reveal up to five exact result refs for the next model step, and deactivate refs no longer needed. Search never executes, authenticates, mounts, or approves a capability. Copy exact refs from results into exact_refs; fuzzy hits are never activated implicitly.'

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
