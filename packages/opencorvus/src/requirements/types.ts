/**
 * Requirements data shapes — narrow scope: REQ-N list + foundational decisions.
 *
 * The Requirements Agent no longer produces goals, acceptance-source mappings, fidelity
 * coverage, assembly ownership, or cross-goal contracts. The Architect owns
 * decomposition — see @/architect/types for the Architect-emitted types.
 */
import z from "zod"

export const RequirementDeclaredIDSchema = z
  .string()
  .trim()
  .regex(/^REQ-[1-9]\d*$/, "Requirement declared ID must use REQ-N format with a positive integer N")

export type RequirementDeclaredID = z.infer<typeof RequirementDeclaredIDSchema>

export const RequirementStringArraySchema = z.array(z.string().trim().min(1))
export const RequirementAcceptanceListSchema = RequirementStringArraySchema.min(1)

export function parseStoredRequirementAcceptance(input: unknown, context: string): string[] {
  if (typeof input !== "string") {
    throw new Error(`${context}: requirement acceptance must be JSON text`)
  }
  let decoded: unknown
  try {
    decoded = JSON.parse(input) as unknown
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${context}: requirement acceptance is not valid JSON: ${detail}`)
  }
  const result = RequirementAcceptanceListSchema.safeParse(decoded)
  if (!result.success) {
    throw new Error(`${context}: invalid requirement acceptance: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

export function parseStoredRequirementStringArray(input: unknown, context: string): string[] {
  const result = RequirementStringArraySchema.safeParse(input)
  if (!result.success) {
    throw new Error(`${context}: invalid requirement string array: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

export interface ParsedRequirement {
  id: string
  type: "explicit" | "implicit"
  description: string
  acceptance: string
  non_goals: string
  evidence_refs: ArtifactReadLocator[]
}

export interface RequirementsDecision {
  key: string
  value: string
  reason: string
}

export interface RequirementSet {
  requirements: ParsedRequirement[]
  decisions: RequirementsDecision[]
}
import type { ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"

export interface RequirementSetArtifactPayload extends RequirementSet {
  observed_artifact_locators: ArtifactReadLocator[]
  source_artifact_locators: ArtifactReadLocator[]
}
