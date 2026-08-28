import z from "zod"
import { SkillManager } from "@/skill/manager"
import { Tool } from "./tool"
import { SKILL_MARKET_TOOL_ID } from "./tool-id-catalog"

export { SKILL_MARKET_TOOL_ID } from "./tool-id-catalog"

const Parameters = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("search"),
      query: z.string().trim().min(2).max(120),
      limit: z.coerce.number().int().min(1).max(20).default(10),
    })
    .strict(),
  z.object({ action: z.literal("inspect"), id: z.string().min(1) }).strict(),
  z
    .object({
      action: z.literal("install"),
      id: z.string().min(1),
      expected_hash: z.string().regex(/^[a-f0-9]{64}$/),
      policy: SkillManager.Policy.optional(),
    })
    .strict(),
])

export const SkillMarketTool = Tool.define(SKILL_MARKET_TOOL_ID, {
  description: [
    "Search the current external Skill Market, inspect one exact candidate bundle, or request installation of that inspected candidate.",
    "Use search for an uninstalled capability that is not present in capability_search or the mounted skill Tool.",
    "Always inspect a candidate before installation and show the user its identity, repository, content hash, file/risk summary, and policy.",
    "Installation must reuse the exact hash returned by inspect. It is a separately authorized local mutation; never invent or alter the hash.",
    "A successful install refreshes the global catalog but the new Skill is available for mounting only on a subsequent turn, not this turn's frozen Skill surface.",
  ].join(" "),
  parameters: Parameters,
  async execute(params) {
    const input = Parameters.parse(params)
    if (input.action === "search") {
      const results = await SkillManager.searchMarket(input)
      return {
        title: `Skill Market search: ${input.query}`,
        metadata: {
          action: String(input.action),
          query: input.query,
          count: results.length,
          id: "",
          hash: "",
          risk: "",
          available: "",
        },
        output: JSON.stringify({ provider: await SkillManager.market(), results }, null, 2),
      }
    }
    if (input.action === "inspect") {
      const detail = await SkillManager.inspectMarket(input)
      return {
        title: `Skill Market candidate: ${detail.name}`,
        metadata: {
          action: String(input.action),
          query: "",
          count: 1,
          id: detail.id,
          hash: detail.hash,
          risk: String(detail.risk.level),
          available: "",
        },
        output: JSON.stringify(detail, null, 2),
      }
    }
    const installed = await SkillManager.installMarket(input)
    return {
      title: `Installed Skill: ${installed.name}`,
      metadata: {
        action: String(input.action),
        query: "",
        count: 1,
        id: installed.id,
        hash: installed.hash,
        risk: "",
        available: String(installed.available),
      },
      output: JSON.stringify(
        {
          ...installed,
          activation_note:
            "The Skill is installed globally and the catalog is refreshed. It can be mounted on a subsequent turn; it is not loaded into the current turn.",
        },
        null,
        2,
      ),
    }
  },
})
