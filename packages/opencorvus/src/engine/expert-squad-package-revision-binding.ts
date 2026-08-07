import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import z from "zod"

export const ExpertSquadPackageRevisionBindingSchema = z
  .object({
    scope: z.enum(["built_in", "project", "global"]),
    project_id: z.string().min(1).nullable(),
    namespace: z.string().min(1),
    id: z.string().min(1),
    version: z.string().min(1),
    package_digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === "project" && value.project_id === null) {
      context.addIssue({
        code: "custom",
        path: ["project_id"],
        message: "Project-scoped expert squad package revision requires project_id",
      })
    }
    if (value.scope !== "project" && value.project_id !== null) {
      context.addIssue({
        code: "custom",
        path: ["project_id"],
        message: `${value.scope} expert squad package revision must use project_id=null`,
      })
    }
  })

export type ExpertSquadPackageRevisionBinding = z.infer<typeof ExpertSquadPackageRevisionBindingSchema>

export function expertSquadPackageRevisionBinding(
  revision: PromptProfileResolver.ResolvedPackageRevision,
): ExpertSquadPackageRevisionBinding {
  return ExpertSquadPackageRevisionBindingSchema.parse({
    scope: revision.scope,
    project_id: revision.projectID,
    namespace: revision.namespace,
    id: revision.id,
    version: revision.version,
    package_digest: revision.packageDigest,
  })
}

export function resolvedPackageRevisionFromBinding(
  binding: ExpertSquadPackageRevisionBinding,
): PromptProfileResolver.ResolvedPackageRevision {
  const parsed = ExpertSquadPackageRevisionBindingSchema.parse(binding)
  return {
    scope: parsed.scope,
    projectID: parsed.project_id,
    namespace: parsed.namespace,
    id: parsed.id,
    version: parsed.version,
    packageDigest: parsed.package_digest,
  }
}

export function sameExpertSquadPackageRevisionBinding(
  left: ExpertSquadPackageRevisionBinding,
  right: ExpertSquadPackageRevisionBinding,
): boolean {
  return (
    JSON.stringify(ExpertSquadPackageRevisionBindingSchema.parse(left)) ===
    JSON.stringify(ExpertSquadPackageRevisionBindingSchema.parse(right))
  )
}
