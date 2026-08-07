import type { Config } from "@/config/config"
import { WEBPAGE_EVIDENCE_BLOCKED_TOOL_IDS } from "@/frontend-design/tools/ids"
import { PermissionNext } from "@/permission/next"

export function nativeAgentPermissionProfiles(config: Config.Info) {
  const defaults = PermissionNext.fromConfig({
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
  const user = PermissionNext.fromConfig(config.permission ?? {})
  const webpageEvidenceDenied = PermissionNext.fromConfig(
    Object.fromEntries(WEBPAGE_EVIDENCE_BLOCKED_TOOL_IDS.map((id) => [id, "deny"])),
  )
  return {
    nonDesign(...rulesets: PermissionNext.Ruleset[]) {
      return PermissionNext.merge(defaults, ...rulesets, user, webpageEvidenceDenied)
    },
  }
}
