import { z } from "zod"
import { ProjectRelativePathSchema } from "./project-path"
import { TaskArtifactResourceSetLocatorSchema } from "./task-artifact"

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ExpertSquadPackageRevisionSchema = z
  .object({
    package_digest: SHA256Schema,
  })
  .strict()

export const ExpertSquadPackageCommitSubtreeSchema = z
  .object({
    source_commit: z.union([z.string().regex(/^[0-9a-f]{40}$/), z.string().regex(/^[0-9a-f]{64}$/)]),
    package_root: ProjectRelativePathSchema,
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

export const PreparedExpertSquadCandidateSchema = MaterializedExpertSquadPackageSchema.extend({
  package_root: ProjectRelativePathSchema,
}).strict()

export const InspectedExpertSquadPackageSchema = MaterializedExpertSquadPackageSchema.omit({ resource_set: true })
  .extend({
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
  })
  .strict()

export const ValidatedExpertSquadPackageSchema = InspectedExpertSquadPackageSchema.extend({
  resource_set: TaskArtifactResourceSetLocatorSchema,
}).strict()

export type ExpertSquadPackageHost = Readonly<{
  inspectRevision(input: {
    revision: z.infer<typeof ExpertSquadPackageRevisionSchema>
  }): Promise<z.infer<typeof InspectedExpertSquadPackageSchema>>
  prepareCandidate(input: {
    revision: z.infer<typeof ExpertSquadPackageRevisionSchema>
  }): Promise<z.infer<typeof PreparedExpertSquadCandidateSchema>>
  publishCommitSubtree(
    input: z.infer<typeof ExpertSquadPackageCommitSubtreeSchema>,
  ): Promise<z.infer<typeof MaterializedExpertSquadPackageSchema>>
  validateResourceSet(input: {
    resource_set: z.infer<typeof TaskArtifactResourceSetLocatorSchema>
  }): Promise<z.infer<typeof ValidatedExpertSquadPackageSchema>>
}>
