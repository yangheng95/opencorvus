import z from "zod"

export const EXPERT_SQUAD_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export const ExpertSquadIDSchema = z
  .string()
  .min(1, "expert squad id cannot be empty")
  .max(64, "expert squad id must be at most 64 characters")
  .regex(EXPERT_SQUAD_ID_PATTERN, "expert squad id must be kebab-case")

export const ExpertSquadNamespaceSchema = ExpertSquadIDSchema
export const BUILTIN_EXPERT_SQUAD_NAMESPACE = "builtin"

export type ExpertSquadID = z.output<typeof ExpertSquadIDSchema>
