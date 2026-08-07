import { z } from "zod"

export const CheckSelector = z.enum([
  "build",
  "test",
  "lint",
  "verify_cmd",
  "ui_review",
  "code_quality",
  "code_review",
  "dead_code_review",
  "startup",
  "spec_check",
])
export type CheckSelector = z.infer<typeof CheckSelector>

export const CheckFamily = z.enum(["build", "test", "lint", "verify_cmd"])
export type CheckFamily = z.infer<typeof CheckFamily>

/**
 * Check selectors must come from spec requirements' `check_selectors` field
 * or from the planner's structured output. Never inferred from keywords.
 */
export function inferSelectors(_text: string): CheckSelector[] {
  return []
}

/**
 * Check family must be explicitly declared in NamedCheckConfig.
 * If not provided, defaults to "build".
 */
export function inferFamily(_key: string): CheckFamily {
  return "build"
}

export function matchSelectors<T extends { name: string; status: string }>(selectors: string[], checks: T[]): T[] {
  return checks.filter((check) => selectors.some((selector) => matches(selector, check.name)))
}

export function selectorsSatisfied(selectors: string[], checks: Array<{ name: string; status: string }>): boolean {
  if (selectors.length === 0) return true
  // Exclude skipped checks — a skipped check provides no evidence that the
  // check actually ran. Every declared selector must have at least one
  // matching active check that passed; unmatched selectors mean the required
  // check never ran, which is not a pass.
  const activeChecks = checks.filter((check) => check.status !== "skipped")
  return selectors.every((selector) =>
    activeChecks.some((check) => matches(selector, check.name) && check.status === "passed"),
  )
}

function matches(selector: string, name: string) {
  if (name === selector || name.startsWith(`${selector}#`)) return true
  if (!CheckFamily.safeParse(selector).success) return false
  return inferFamily(name) === selector
}

export function selectorList(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return []
  const value = (metadata as Record<string, unknown>).check_selector
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}
