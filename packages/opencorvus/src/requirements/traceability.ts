import type { AcceptanceSpec } from "@/acceptance/types"
import { RequirementDeclaredIDSchema } from "./types"

export function requirementIDFromAcceptanceSpec(spec: AcceptanceSpec): string | undefined {
  if (spec.source?.kind !== "requirement") return undefined
  return RequirementDeclaredIDSchema.parse(spec.source.id)
}

export function requirementIDsFromAcceptanceSpecs(specs: readonly AcceptanceSpec[]): string[] {
  return [...new Set(specs.flatMap((spec) => requirementIDFromAcceptanceSpec(spec) ?? []))]
}
