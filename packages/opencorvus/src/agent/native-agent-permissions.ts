import type { Config } from "@/config/config"
import { WEBPAGE_EVIDENCE_BLOCKED_TOOL_IDS } from "@/frontend-design/tools/ids"
import { CapabilityRules } from "@/capability/rules"

export function nativeAgentPermissionProfiles(config: Config.Info) {
  const defaults = CapabilityRules.fromConfig({
    "*": "allow",
    invalid: "allow",
    doom_loop: "allow",
    list: "allow",
    glob: "allow",
    search_code: "allow",
    bash: "allow",
    edit: "allow",
    webfetch: "allow",
    websearch: "allow",
    external_code_search: "allow",
    lsp: "allow",
    memory: "allow",
    skill: "allow",
    panel: "allow",
    todoread: "allow",
    todowrite: "allow",
    screen: "allow",
    input: "allow",
    external_directory: "allow",
    question: "allow",
    read: "allow",
  })
  const webpageEvidenceDenied = CapabilityRules.fromConfig(
    Object.fromEntries(WEBPAGE_EVIDENCE_BLOCKED_TOOL_IDS.map((id) => [id, "deny"])),
  )
  return {
    nonDesign(...rulesets: CapabilityRules.Ruleset[]) {
      return CapabilityRules.merge(defaults, ...rulesets, webpageEvidenceDenied)
    },
  }
}
