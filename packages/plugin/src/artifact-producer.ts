import { z } from "zod"

export const ArtifactSchemaLimits = Object.freeze({
  identifierLength: 512,
  artifactTypeLength: 512,
  catalogValueLength: 512,
  queryLength: 2_048,
  cursorLength: 16_384,
  schemaDiagnosticLength: 2_048,
  providerErrorLength: 2_048,
  labelLength: 512,
  storedLabelLength: 2_048,
  filterValues: 64,
  facetValues: 100,
  catalogEntries: 100,
  providerErrors: 2,
  resourceMediaTypes: 64,
  publishResources: 256,
  defaultSearchLimit: 25,
  maxSearchLimit: 100,
  defaultReadBytes: 24 * 1_024,
  maxReadBytes: 64 * 1_024,
  structuredOutputBytes: 40 * 1_024,
} as const)

// SHA-256 means Secure Hash Algorithm 256-bit.
export const ArtifactSHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const ArtifactIdentifierSchema = z.string().min(1).max(ArtifactSchemaLimits.identifierLength)

const ProjectedArtifactProducerSchema = z
  .object({
    owner_kind: z.enum(["projected-scheduler", "projected-worker"]),
    expert_squad_id: ArtifactIdentifierSchema,
    package_revision: z
      .object({
        scope: z.enum(["built_in", "project", "global"]),
        project_id: ArtifactIdentifierSchema.nullable(),
        namespace: ArtifactIdentifierSchema,
        id: ArtifactIdentifierSchema,
        version: ArtifactIdentifierSchema,
        package_digest: ArtifactSHA256Schema,
      })
      .strict()
      .superRefine((revision, context) => {
        if ((revision.scope === "project") !== (revision.project_id !== null)) {
          context.addIssue({
            code: "custom",
            path: ["project_id"],
            message: "project package revision requires project_id and non-project revisions require null",
          })
        }
      }),
    agent_id: ArtifactIdentifierSchema,
    projection_hash: ArtifactSHA256Schema,
    session_id: ArtifactIdentifierSchema,
    message_id: ArtifactIdentifierSchema,
    tool_call_id: ArtifactIdentifierSchema,
  })
  .strict()
  .refine((producer) => producer.package_revision.id === producer.expert_squad_id, {
    message: "package revision ID must match expert squad ID",
    path: ["package_revision", "id"],
  })

const MissionArtifactProducerSchema = z
  .object({
    owner_kind: z.literal("mission"),
    mission_id: ArtifactIdentifierSchema,
    session_id: ArtifactIdentifierSchema,
    message_id: ArtifactIdentifierSchema,
    tool_call_id: ArtifactIdentifierSchema,
  })
  .strict()

const CoreArtifactProducerSchema = z
  .object({
    owner_kind: z.literal("core"),
    component_id: ArtifactIdentifierSchema,
    operation_id: ArtifactIdentifierSchema,
  })
  .strict()

export const ArtifactProducerSchema = z.discriminatedUnion("owner_kind", [
  ProjectedArtifactProducerSchema,
  MissionArtifactProducerSchema,
  CoreArtifactProducerSchema,
])

export type ArtifactProducer = z.infer<typeof ArtifactProducerSchema>
