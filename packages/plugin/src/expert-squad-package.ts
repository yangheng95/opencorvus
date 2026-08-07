import { z } from "zod"
import { TaskArtifactResourceSetLocatorSchema } from "./task-artifact"

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ExpertSquadPackageRevisionSchema = z
  .object({
    package_digest: SHA256Schema,
  })
  .strict()

export const MaterializedExpertSquadPackageSchema = z
  .object({
    resource_set: TaskArtifactResourceSetLocatorSchema,
    package_digest: SHA256Schema,
    namespace: z.string().min(1),
    id: z.string().min(1),
    version: z.string().min(1),
  })
  .strict()

export const ValidatedExpertSquadPackageSchema = MaterializedExpertSquadPackageSchema.extend({
  manifest: z.unknown(),
  skill_closures: z.array(
    z
      .object({
        source: z.string().min(1),
        files: z.array(z.string().min(1)),
      })
      .strict(),
  ),
  files: z.array(
    z
      .object({
        path: z.string().min(1),
        sha256: SHA256Schema,
        bytes: z.number().int().nonnegative(),
        utf8_text: z.boolean(),
      })
      .strict(),
  ),
}).strict()

export type ExpertSquadPackageHost = Readonly<{
  materializeRevision(input: {
    revision: z.infer<typeof ExpertSquadPackageRevisionSchema>
  }): Promise<z.infer<typeof MaterializedExpertSquadPackageSchema>>
  validateResourceSet(input: {
    resource_set: z.infer<typeof TaskArtifactResourceSetLocatorSchema>
  }): Promise<z.infer<typeof ValidatedExpertSquadPackageSchema>>
}>
