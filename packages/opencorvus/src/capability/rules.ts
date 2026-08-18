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

  const EDIT_TOOLS = new Set(["edit", "write", "patch", "multiedit"])

  /**
   * The permission a Tool ID draws on; identity for every other subject.
   *
   * `Config.Permission` has one `edit` key and no `write` / `patch` /
   * `multiedit` keys, so those three Tools can only ever be denied through
   * `edit`. The mapping used to live inside `disabled` alone, which meant
   * `{ edit: "deny" }` produced opposite verdicts depending on who asked:
   * `disabled(["write"])` denied, while `evaluate("write", "*")` — the form
   * `tool/execution-surface.ts` and `skill/eligibility.ts` call, and the one
   * that actually removes a Tool from the model-visible table — matched no
   * rule and fell back to allow. It belongs in the single matching entry
   * point so every caller asks the same question.
   */
  function permissionSubject(subject: string): string {
    return EDIT_TOOLS.has(subject) ? "edit" : subject
  }

  export function evaluate(permission: string, pattern: string, ...rulesets: (Ruleset | undefined)[]): Rule {
    const subject = permissionSubject(permission)
    const match = merge(...rulesets).findLast((rule) => matches(subject, pattern, rule))
    return match ?? { action: "allow", permission: subject, pattern: "*" }
  }

  /**
   * A Tool is disabled when the ruleset denies it for every pattern. That
   * question is answered by `evaluate` so this module has one matching
   * semantics: the previous scan here matched the permission alone and then
   * compared `pattern === "*"` as a literal string, so a blanket rule written
   * any other way silently failed to disable the Tool while `evaluate` — used
   * by the very next check in `skill/eligibility.ts` — denied it.
   */
  export function disabled(tools: string[], ruleset: Ruleset | undefined): Set<string> {
    const result = new Set<string>()
    if (!ruleset) return result
    for (const tool of tools) {
      if (evaluate(tool, "*", ruleset).action === "deny") result.add(tool)
    }
    return result
  }

  export class DeniedError extends Error {
    constructor(public readonly ruleset: Ruleset) {
      super(`Capability projection prevents this Tool call: ${JSON.stringify(ruleset)}`)
    }
  }
}
