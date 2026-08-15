import z from "zod"

export const PermissionDecision = z.enum(["allow_once", "allow_task", "allow_project", "deny"]).meta({
  ref: "PermissionDecision",
})

export type PermissionDecision = z.infer<typeof PermissionDecision>
