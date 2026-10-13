import z from "zod"
import { Identifier } from "@/id/id"
import { PermissionDecision } from "./decision"

export const PermissionProviderKind = z.enum([
  "builtin",
  "plugin",
  "skill",
  "mcp",
  "mcp_app",
  "browser",
  "computer",
  "projected",
  "schedule",
  "external",
])
export type PermissionProviderKind = z.infer<typeof PermissionProviderKind>

export const PermissionIdentity = z
  .string()
  .max(Identifier.MAX_LENGTH)
  .regex(Identifier.canonicalPattern("permission"), { message: "Invalid canonical permission identifier" })
  .meta({ ref: "PermissionIdentity" })

export const PermissionMode = z.enum(["full_access", "ask"]).meta({ ref: "PermissionMode" })
export type PermissionMode = z.infer<typeof PermissionMode>

export const PermissionRequest = z
  .object({
    id: PermissionIdentity,
    projectID: z.string().min(1),
    taskID: z.string().min(1).optional(),
    sessionID: z.string().min(1),
    messageID: z.string().min(1),
    toolCallID: z.string().min(1),
    mode: PermissionMode,
    policyRevision: z.string().min(1),
    providerKind: PermissionProviderKind,
    providerID: z.string().min(1),
    providerDigest: z.string().min(1),
    toolName: z.string().min(1),
    effectClass: z.string().min(1),
    scopeVersion: z.string().min(1),
    scope: z.record(z.string(), z.unknown()),
    fingerprint: z.string().min(1),
    summary: z.string().min(1),
    projectGrantEligible: z.boolean(),
    choices: PermissionDecision.array(),
    timeCreated: z.number().int().positive(),
  })
  .meta({ ref: "PermissionRequest" })
export type PermissionRequest = z.infer<typeof PermissionRequest>
