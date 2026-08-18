import { z } from "zod"
import { EngineArtifactLocatorSchema, ArtifactReadLocatorSchema } from "./artifact-catalog"
import { ArtifactSHA256Schema } from "./artifact-producer"

export function canonicalEvolutionJSON(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalEvolutionJSON).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalEvolutionJSON(record[key])}`).join(",")}}`
  }
  throw new Error("Evolution identity contains a non-canonical JSON value")
}

export const EvolutionExactRevisionSchema = z
  .object({
    namespace: z.string().min(1),
    id: z.string().min(1),
    version: z.string().min(1),
    package_digest: ArtifactSHA256Schema,
  })
  .strict()

const EvolutionProjectTargetSchema = z
  .object({
    scope: z.literal("project"),
    project_id: z.string().min(1),
    project_directory: z.string().min(1),
    namespace: z.string().min(1),
    id: z.string().min(1),
  })
  .strict()

const EvolutionGlobalTargetSchema = z
  .object({
    scope: z.literal("global"),
    project_id: z.null(),
    project_directory: z.null(),
    namespace: z.string().min(1),
    id: z.string().min(1),
  })
  .strict()

export const EvolutionInstallableTargetSchema = z.discriminatedUnion("scope", [
  EvolutionProjectTargetSchema,
  EvolutionGlobalTargetSchema,
])

export const EvolutionInstalledPackageRevisionSchema = z
  .object({
    installationScope: z.enum(["project", "global"]),
    projectDirectory: z.string().min(1).nullable(),
    namespace: z.string().min(1),
    id: z.string().min(1),
    version: z.string().min(1).nullable(),
    packageDigest: ArtifactSHA256Schema,
    targetRoot: z.string().min(1),
  })
  .strict()

export const EvolutionManagerMutationReceiptSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("installed"), before: z.null(), after: EvolutionInstalledPackageRevisionSchema }).strict(),
  z
    .object({
      operation: z.enum(["unchanged", "replaced", "restored"]),
      before: EvolutionInstalledPackageRevisionSchema,
      after: EvolutionInstalledPackageRevisionSchema,
    })
    .strict(),
])

export const EvolutionMutationAuthorizationSchema = z
  .object({
    project_id: z.string().min(1),
    task_id: z.string().min(1),
    session_id: z.string().min(1),
    message_id: z.string().min(1),
    message_sha256: ArtifactSHA256Schema,
    time_created: z.number().int().nonnegative(),
  })
  .strict()

export const EvolutionPromotionReceiptSchema = z
  .object({
    // A feedback revision replaces the installed revision exactly as a
    // promotion does; it is recorded as its own operation so the receipt states
    // what actually authorized it — user acceptance, not a measured comparison.
    operation: z.enum(["promotion", "restoration", "feedback_revision"]),
    authorization: EvolutionMutationAuthorizationSchema,
    target: EvolutionInstallableTargetSchema,
    expected_current_digest: ArtifactSHA256Schema,
    before_digest: ArtifactSHA256Schema,
    after_digest: ArtifactSHA256Schema,
    evidence: z.array(ArtifactReadLocatorSchema).min(1),
    manager_receipt: EvolutionManagerMutationReceiptSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const expectedManagerOperation = value.operation === "restoration" ? "restored" : "replaced"
    if (value.manager_receipt.operation !== expectedManagerOperation)
      context.addIssue({
        code: "custom",
        path: ["manager_receipt", "operation"],
        message: `${value.operation} requires the exact ${expectedManagerOperation} Manager receipt`,
      })
    if (
      value.manager_receipt.before?.packageDigest !== value.before_digest ||
      value.manager_receipt.after.packageDigest !== value.after_digest ||
      value.expected_current_digest !== value.before_digest
    )
      context.addIssue({
        code: "custom",
        path: ["manager_receipt"],
        message: "promotion receipt digests must equal the atomic Manager mutation facts",
      })
    const managerIdentity = value.manager_receipt.after
    if (
      managerIdentity.installationScope !== value.target.scope ||
      managerIdentity.projectDirectory !== value.target.project_directory ||
      managerIdentity.namespace !== value.target.namespace ||
      managerIdentity.id !== value.target.id ||
      value.manager_receipt.before?.installationScope !== value.target.scope ||
      value.manager_receipt.before?.projectDirectory !== value.target.project_directory ||
      value.manager_receipt.before?.namespace !== value.target.namespace ||
      value.manager_receipt.before?.id !== value.target.id
    )
      context.addIssue({
        code: "custom",
        path: ["manager_receipt"],
        message: "promotion receipt Manager identities must equal the exact installable target",
      })
  })

export const EvolutionMutationAuthorizationLocatorSchema = z
  .object({
    taskID: z.string().min(1),
    sessionID: z.string().min(1),
    messageID: z.string().min(1),
  })
  .strict()

export const EvolutionMutationIntentRequestSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("promotion"),
      campaignSpecLocator: EngineArtifactLocatorSchema,
      candidateRevisionLocator: EngineArtifactLocatorSchema,
      comparisonResultLocator: EngineArtifactLocatorSchema,
      expectedCurrentPackageDigest: ArtifactSHA256Schema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("restoration"),
      priorReceiptLocator: EngineArtifactLocatorSchema,
      restorePackageDigest: ArtifactSHA256Schema,
      expectedCurrentPackageDigest: ArtifactSHA256Schema,
    })
    .strict(),
  // Installing a revision authored from one piece of user feedback. There is no
  // Campaign and no comparison: a single piece of feedback has nothing to
  // measure, so the user's own confirmation is the authority — which is where
  // every shipped self-improving system puts the promotion decision. The
  // resulting receipt is the same shape a Campaign promotion produces, so the
  // restoration path reverts it without knowing the difference.
  z
    .object({
      operation: z.literal("feedback_revision"),
      candidateRevisionLocator: EngineArtifactLocatorSchema,
      expectedCurrentPackageDigest: ArtifactSHA256Schema,
    })
    .strict(),
])

export const EvolutionMutationRequestSchema = z.discriminatedUnion("operation", [
  EvolutionMutationIntentRequestSchema.options[0].safeExtend({
    authorization: EvolutionMutationAuthorizationLocatorSchema,
  }),
  EvolutionMutationIntentRequestSchema.options[1].safeExtend({
    authorization: EvolutionMutationAuthorizationLocatorSchema,
  }),
  EvolutionMutationIntentRequestSchema.options[2].safeExtend({
    authorization: EvolutionMutationAuthorizationLocatorSchema,
  }),
])

export const EvolutionMutationAuthorizationRequestSchema = z
  .object({
    taskID: z.string().min(1),
    sessionID: z.string().min(1),
    confirmationText: z.string().min(1),
    intent: EvolutionMutationIntentRequestSchema,
  })
  .strict()

export const EvolutionMutationAuthorizationResultSchema = z
  .object({
    authorization: EvolutionMutationAuthorizationLocatorSchema,
    verified: EvolutionMutationAuthorizationSchema,
    confirmationText: z.string().min(1),
  })
  .strict()

export type EvolutionPromotionReceipt = z.infer<typeof EvolutionPromotionReceiptSchema>
export type EvolutionMutationIntentRequest = z.infer<typeof EvolutionMutationIntentRequestSchema>
export type EvolutionMutationRequest = z.infer<typeof EvolutionMutationRequestSchema>
export type EvolutionMutationAuthorizationRequest = z.infer<typeof EvolutionMutationAuthorizationRequestSchema>
