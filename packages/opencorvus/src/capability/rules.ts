import type { Config } from "@/config/config"
import { entries } from "@/util/object"
import { Wildcard } from "@/util/wildcard"
import os from "node:os"
import z from "zod"

/**
 * Tool capability projection rules.
 *
 * These rules decide which already-installed Tools are visible to an agent or
 * Session. They are deliberately not an operator authorization mechanism.
 */
export namespace CapabilityRules {
  function expand(pattern: string): string {
    const home = os.homedir()
    const userProfile = process.env.USERPROFILE || home
    if (pattern.startsWith("~/")) return home + pattern.slice(1)
    if (pattern === "~") return home
    if (pattern.startsWith("$HOME/")) return home + pattern.slice(5)
    if (pattern.startsWith("$HOME")) return home + pattern.slice(5)
    const token = "%USERPROFILE%"
    if (pattern.localeCompare(token, undefined, { sensitivity: "accent" }) === 0) return userProfile
    if (pattern.toUpperCase().startsWith(token)) {
      const suffix = pattern.slice(token.length)
      if (!suffix || suffix.startsWith("/") || suffix.startsWith("\\")) return userProfile + suffix
    }
    return pattern
  }

  export const Action = z.enum(["allow", "deny"])
  export type Action = z.infer<typeof Action>

  export const Rule = z.object({
    permission: z.string(),
    pattern: z.string(),
    action: Action,
  })
  export type Rule = z.infer<typeof Rule>

  export const Ruleset = Rule.array()
  export type Ruleset = z.infer<typeof Ruleset>

  export function fromConfig(permission: Config.Permission): Ruleset {
    if (typeof permission === "string") {
      return [{ permission: "*", pattern: "*", action: permission }]
    }
    const result: Ruleset = []
    for (const [key, value] of entries(permission)) {
      if (typeof value === "string") {
        result.push({ permission: key, pattern: "*", action: value })
        continue
      }
      for (const [pattern, action] of entries(value)) {
        result.push({ permission: key, pattern: expand(pattern), action })
      }
    }
    return result
  }

  export function merge(...rulesets: (Ruleset | undefined)[]): Ruleset {
    return rulesets.flatMap((ruleset) => ruleset ?? [])
  }

  export function matches(permission: string, pattern: string, rule: Rule): boolean {
    return Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern)
  }

  export function evaluate(permission: string, pattern: string, ...rulesets: (Ruleset | undefined)[]): Rule {
    const match = merge(...rulesets).findLast((rule) => matches(permission, pattern, rule))
    return match ?? { action: "allow", permission, pattern: "*" }
  }

  const EDIT_TOOLS = new Set(["edit", "write", "patch", "multiedit"])

  export function disabled(tools: string[], ruleset: Ruleset | undefined): Set<string> {
    const result = new Set<string>()
    if (!ruleset) return result
    for (const tool of tools) {
      const permission = EDIT_TOOLS.has(tool) ? "edit" : tool
      const rule = ruleset.findLast((candidate) => Wildcard.match(permission, candidate.permission))
      if (rule?.pattern === "*" && rule.action === "deny") result.add(tool)
    }
    return result
  }

  export class DeniedError extends Error {
    constructor(public readonly ruleset: Ruleset) {
      super(`Capability projection prevents this Tool call: ${JSON.stringify(ruleset)}`)
    }
  }
}
