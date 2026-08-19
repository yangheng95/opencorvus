import { createHash, randomBytes } from "node:crypto"
import { z } from "zod"
import {
  ArtifactIdentifierSchema,
  ArtifactProducerSchema,
  ArtifactSchemaLimits,
  ArtifactSHA256Schema,
} from "./artifact-producer"
import {
  TaskArtifactMediaTypeSchema,
  type TaskArtifactRef,
  TaskArtifactRefSchema,
  TaskArtifactSnapshotIdentitySchema,
} from "./task-artifact"

export {
  ArtifactIdentifierSchema,
  ArtifactProducerSchema,
  ArtifactSchemaLimits,
  ArtifactSHA256Schema,
} from "./artifact-producer"

export const EngineArtifactTypeSchema = z
  .string()
  .max(ArtifactSchemaLimits.artifactTypeLength)
  .regex(
    /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._/-]*$/,
    "must be a lowercase namespaced type in <expert-squad-id>/<artifact-name> form",
  )

const ArtifactCatalogValueSchema = z.string().min(1).max(ArtifactSchemaLimits.catalogValueLength)
const ArtifactExactLabelSchema = z.string().min(1).max(ArtifactSchemaLimits.storedLabelLength)
const ArtifactFilterValuesSchema = <T extends z.ZodType>(value: T) =>
  z.array(value).min(1).max(ArtifactSchemaLimits.filterValues)

export const EngineArtifactLocatorSchema = z
  .object({
    source: z.literal("engine_artifact"),
    artifact_id: ArtifactIdentifierSchema,
    catalog_revision: z.number().int().positive(),
    expected_sha256: ArtifactSHA256Schema,
  })
  .strict()

export const TaskArtifactSnapshotLocatorSchema = z
  .object({
    source: z.literal("task_artifact_snapshot"),
    snapshot: TaskArtifactSnapshotIdentitySchema,
  })
  .strict()

export const TaskArtifactResourceLocatorSchema = z
  .object({
    source: z.literal("task_artifact_resource"),
    ref: TaskArtifactRefSchema,
  })
  .strict()

/**
 * Model-facing locator primitives.
 *
 * A content digest, byte count, and media type are Host-owned facts derived
 * from the exact catalog revision or snapshot manifest entry, so the model
 * never restates them: transcribing 64 hexadecimal characters truncates
 * instead of verifying, and the copy proves nothing the exact revision does
 * not already prove. The Host stamps every derived field while resolving these
 * inputs into the durable unions above, which keep their complete digests.
 */
export const EngineArtifactLocatorInputSchema = EngineArtifactLocatorSchema.omit({
  expected_sha256: true,
})

export const TaskArtifactResourceLocatorInputSchema = z
  .object({
    source: z.literal("task_artifact_resource"),
    ref: TaskArtifactRefSchema.omit({ media_type: true, bytes: true, sha256: true }),
  })
  .strict()

export const ArtifactLocatorSchema = z.discriminatedUnion("source", [
  EngineArtifactLocatorSchema,
  TaskArtifactSnapshotLocatorSchema,
])

export const ArtifactReadLocatorSchema = z.discriminatedUnion("source", [
  EngineArtifactLocatorSchema,
  TaskArtifactSnapshotLocatorSchema,
  TaskArtifactResourceLocatorSchema,
])

function refineUniqueLocatorList(
  locators: readonly Record<string, unknown>[],
  context: z.RefinementCtx,
  subject: string,
) {
  const seen = new Set<string>()
  locators.forEach((locator, index) => {
    const identity = JSON.stringify(locator)
    if (seen.has(identity)) {
      context.addIssue({
        code: "custom",
        path: [index],
        message: `Duplicate ${subject} locator: ${identity}`,
      })
    }
    seen.add(identity)
  })
}

export const ArtifactReadLocatorListSchema = z
  .array(ArtifactReadLocatorSchema)
  .superRefine((locators, context) => refineUniqueLocatorList(locators, context, "Artifact read"))

export const ArtifactReadLocatorInputSchema = z.discriminatedUnion("source", [
  EngineArtifactLocatorInputSchema,
  TaskArtifactSnapshotLocatorSchema,
  TaskArtifactResourceLocatorInputSchema,
])

export const ArtifactReadLocatorInputListSchema = z
  .array(ArtifactReadLocatorInputSchema)
  .superRefine((locators, context) => refineUniqueLocatorList(locators, context, "Artifact read"))

function artifactReference(prefix: "al" | "ar" | "as"): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`
}

export const ArtifactLocatorReferenceSchema = z
  .string()
  .regex(/^al_[A-Za-z0-9_-]{16}$/)
  .describe("Host-minted reference to one exact locator emitted earlier in this Session Turn.")

export const ArtifactReadReferenceSchema = z
  .string()
  .regex(/^ar_[A-Za-z0-9_-]{16}$/)
  .describe("Host-minted reference to persisted complete-read facts for one exact locator in this Session Turn.")

export const ArtifactSelectionReferenceSchema = z
  .string()
  .regex(/^as_[A-Za-z0-9_-]{16}$/)
  .describe("Host-minted reference to one persisted semantic Artifact selection in this Session Turn.")

export function mintArtifactLocatorReference(): string {
  return ArtifactLocatorReferenceSchema.parse(artifactReference("al"))
}

export function mintArtifactReadReference(): string {
  return ArtifactReadReferenceSchema.parse(artifactReference("ar"))
}

export const ArtifactSelectInputSchema = z
  .object({
    locator: ArtifactReadLocatorSchema,
    purpose: z
      .string()
      .trim()
      .min(1)
      .max(ArtifactSchemaLimits.catalogValueLength)
      .describe(
        "Concise semantic role this exact completely read Artifact plays in the current consumer output.",
      ),
  })
  .strict()

export const ArtifactSelectOutputSchema = ArtifactSelectInputSchema

export function mintArtifactSelectionReference(): string {
  return ArtifactSelectionReferenceSchema.parse(artifactReference("as"))
}

export const ArtifactConsumptionProvenanceFields = {
  observed_artifact_locators: z
    .array(ArtifactReadLocatorSchema)
    .max(ArtifactSchemaLimits.publishResources)
    .default([]),
  source_artifact_locators: z
    .array(ArtifactReadLocatorSchema)
    .max(ArtifactSchemaLimits.publishResources)
    .default([]),
} as const

function refineArtifactConsumptionProvenance(
  value: {
    observed_artifact_locators: ArtifactReadLocator[]
    source_artifact_locators: ArtifactReadLocator[]
  },
  context: z.RefinementCtx,
) {
  const observed = new Set<string>()
  for (const [index, locator] of value.observed_artifact_locators.entries()) {
    const key = JSON.stringify(locator)
    if (observed.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["observed_artifact_locators", index],
        message: "observed Artifact locators must be unique exact identities",
      })
    }
    observed.add(key)
  }
  const sources = new Set<string>()
  for (const [index, locator] of value.source_artifact_locators.entries()) {
    const key = JSON.stringify(locator)
    if (sources.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["source_artifact_locators", index],
        message: "source Artifact locators must be unique exact identities",
      })
    }
    if (!observed.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["source_artifact_locators", index],
        message: "source Artifact locator must be a member of observed_artifact_locators",
      })
    }
    sources.add(key)
  }
}

export const ArtifactConsumptionProvenanceSchema = z
  .object(ArtifactConsumptionProvenanceFields)
  .strict()
  .superRefine(refineArtifactConsumptionProvenance)

export const CrossTaskArtifactImportSchema = z
  .object({
    source_task_id: ArtifactIdentifierSchema,
    locator: ArtifactReadLocatorSchema,
  })
  .strict()

export const CrossTaskArtifactImportListSchema = z
  .array(CrossTaskArtifactImportSchema)
  .max(ArtifactSchemaLimits.filterValues)
  .superRefine((imports, context) => {
    const identities = new Set<string>()
    for (const [index, item] of imports.entries()) {
      const identity = `${item.source_task_id}\u0000${JSON.stringify(item.locator)}`
      if (identities.has(identity)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "cross-Task Artifact imports must be unique exact source locators",
        })
      }
      identities.add(identity)
    }
  })

export const CrossTaskArtifactSourceSchema = z.discriminatedUnion("authority", [
  z
    .object({
      authority: z.literal("completion_decision"),
      source_task_id: ArtifactIdentifierSchema,
    })
    .strict(),
  z
    .object({
      authority: z.literal("terminal_lifecycle"),
      source_task_id: ArtifactIdentifierSchema,
      locator: ArtifactReadLocatorSchema,
    })
    .strict(),
])

export const CrossTaskArtifactSourceListSchema = z
  .array(CrossTaskArtifactSourceSchema)
  .max(ArtifactSchemaLimits.filterValues)
  .superRefine((sources, context) => {
    const identities = new Set<string>()
    for (const [index, source] of sources.entries()) {
      const identity = `${source.authority}\u0000${source.source_task_id}\u0000${
        source.authority === "terminal_lifecycle" ? JSON.stringify(source.locator) : ""
      }`
      if (identities.has(identity)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: "cross-Task Artifact sources must be unique exact authorities",
        })
      }
      identities.add(identity)
    }
  })

export const EngineArtifactImportLineageSchema = z
  .object({
    source_task_id: ArtifactIdentifierSchema,
    source_locator: ArtifactReadLocatorSchema,
    source_kind: ArtifactCatalogValueSchema,
    source_producer: ArtifactProducerSchema.nullable(),
    source_provenance: ArtifactConsumptionProvenanceSchema,
  })
  .strict()

export const CrossTaskArtifactImportMappingSchema = z
  .object({
    source_task_id: ArtifactIdentifierSchema,
    source_locator: ArtifactReadLocatorSchema,
    imported_locator: EngineArtifactLocatorSchema,
  })
  .strict()

const EvidenceIdentitySchema = z.string().trim().min(1).max(ArtifactSchemaLimits.catalogValueLength)

export const SessionEvidenceLocatorSchema = z
  .object({
    source: z.literal("session"),
    session_id: EvidenceIdentitySchema,
  })
  .strict()

export const SessionMessageEvidenceLocatorSchema = z
  .object({
    source: z.literal("session_message"),
    session_id: EvidenceIdentitySchema.describe(
      "Exact producing Session ID for message_id; do not substitute the current caller Session unless it produced that Message.",
    ),
    message_id: EvidenceIdentitySchema.describe("Exact Message ID stored in the paired session_id."),
  })
  .strict()

export const GoalRevisionEvidenceLocatorSchema = z
  .object({
    source: z.literal("goal_revision"),
    goal_id: EvidenceIdentitySchema,
  })
  .strict()

export const CoordinationRequestEvidenceLocatorSchema = z
  .object({
    source: z.literal("coordination_request"),
    request_id: EvidenceIdentitySchema,
  })
  .strict()

/**
 * The only model-visible durable-evidence pointer family.
 *
 * Filesystem evidence is represented by a verified Task Artifact snapshot or
 * resource locator. Arbitrary paths and display strings are intentionally not
 * evidence identities.
 */
export const EvidenceLocatorSchema = z.discriminatedUnion("source", [
  EngineArtifactLocatorSchema,
  TaskArtifactSnapshotLocatorSchema,
  TaskArtifactResourceLocatorSchema,
  SessionEvidenceLocatorSchema,
  SessionMessageEvidenceLocatorSchema,
  GoalRevisionEvidenceLocatorSchema,
  CoordinationRequestEvidenceLocatorSchema,
])

export const EvidenceLocatorListSchema = z
  .array(EvidenceLocatorSchema)
  .superRefine((locators, context) => refineUniqueLocatorList(locators, context, "evidence"))

export const EvidenceLocatorInputSchema = z.discriminatedUnion("source", [
  EngineArtifactLocatorInputSchema,
  TaskArtifactSnapshotLocatorSchema,
  TaskArtifactResourceLocatorInputSchema,
  SessionEvidenceLocatorSchema,
  SessionMessageEvidenceLocatorSchema,
  GoalRevisionEvidenceLocatorSchema,
  CoordinationRequestEvidenceLocatorSchema,
])

export const EvidenceLocatorInputListSchema = z
  .array(EvidenceLocatorInputSchema)
  .superRefine((locators, context) => refineUniqueLocatorList(locators, context, "evidence"))

export const ArtifactCatalogSourceSchema = z.enum(["engine_artifact", "task_artifact"])
export const ArtifactVersionScopeSchema = z.enum(["current", "historical", "all"])
export const ArtifactSearchSortSchema = z.enum(["relevance", "newest", "oldest", "name"])
export const ArtifactSearchMatchModeSchema = z.enum([
  "exact_identity",
  "exact_label",
  "exact_metadata_value",
  "label_prefix",
  "label_substring",
  "metadata_substring",
  "fuzzy_label",
  "fuzzy_metadata",
])

export const ArtifactSearchMatchSchema = z
  .object({
    tier: ArtifactSearchMatchModeSchema,
    score: z.number().finite().min(0).max(1).optional(),
    matched_fields: z.array(ArtifactCatalogValueSchema).min(1).max(ArtifactSchemaLimits.filterValues),
  })
  .strict()

export const ArtifactCatalogVersionSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("current"), catalog_revision: z.number().int().positive() }).strict(),
  z.object({ state: z.literal("historical"), catalog_revision: z.number().int().positive() }).strict(),
  z.object({ state: z.literal("immutable"), publication_sequence: z.number().int().positive() }).strict(),
])

export const ArtifactCatalogEntrySchema = z
  .object({
    source: ArtifactCatalogSourceSchema,
    locator: ArtifactReadLocatorSchema,
    kind: ArtifactCatalogValueSchema,
    artifact_type: EngineArtifactTypeSchema.optional(),
    schema_diagnostic: z.string().min(1).max(ArtifactSchemaLimits.schemaDiagnosticLength).optional(),
    schema_diagnostic_truncated: z.boolean(),
    label: z.string().max(ArtifactSchemaLimits.labelLength),
    label_truncated: z.boolean(),
    goal_id: ArtifactIdentifierSchema.nullable(),
    import_source_task_id: ArtifactIdentifierSchema.nullable(),
    producer: ArtifactProducerSchema.nullable(),
    created_at_ms: z.number().int().nonnegative(),
    updated_at_ms: z.number().int().nonnegative().optional(),
    bytes: z.number().int().nonnegative(),
    sha256: ArtifactSHA256Schema,
    resource_count: z.number().int().nonnegative(),
    resource_media_types: z.array(TaskArtifactMediaTypeSchema).max(ArtifactSchemaLimits.resourceMediaTypes),
    resource_media_types_truncated: z.boolean(),
    version: ArtifactCatalogVersionSchema,
    match: ArtifactSearchMatchSchema.optional(),
  })
  .strict()
  .superRefine((entry, context) => {
    const engineVersion = entry.version.state === "current" || entry.version.state === "historical"
    if (engineVersion !== (entry.source === "engine_artifact")) {
      context.addIssue({
        code: "custom",
        path: ["version"],
        message: "Engine entries must be current/historical and Task Artifact entries must be immutable",
      })
    }
    if (
      (entry.source === "engine_artifact") !== (entry.locator.source === "engine_artifact")
    ) {
      context.addIssue({
        code: "custom",
        path: ["locator", "source"],
        message: "Catalog entry source must match its exact locator authority",
      })
    }
    if (
      entry.source === "engine_artifact" &&
      entry.locator.source === "engine_artifact" &&
      (entry.version.state === "current" || entry.version.state === "historical") &&
      entry.locator.catalog_revision !== entry.version.catalog_revision
    ) {
      context.addIssue({
        code: "custom",
        path: ["locator", "catalog_revision"],
        message: "Engine locator catalog_revision must equal the entry version revision",
      })
    }
  })

const ArtifactSearchInputObjectSchema = z
  .object({
    query: z
      .object({
        text: z.string().trim().min(1).max(ArtifactSchemaLimits.queryLength),
        mode: z.enum(["substring", "fuzzy"]).default("substring"),
      })
      .strict()
      .optional()
      .describe(
        "Optional hierarchical candidate query over bounded catalog identity, label, type, producer, Goal, and resource metadata. Fuzzy mode is explicit and never selects evidence. Omit query to enumerate.",
      ),
    labels: ArtifactFilterValuesSchema(ArtifactExactLabelSchema)
      .optional()
      .describe("Optional exact stable Artifact-label filter."),
    sources: z
      .array(ArtifactCatalogSourceSchema)
      .min(1)
      .max(ArtifactCatalogSourceSchema.options.length)
      .optional()
      .describe("Optional authoritative-store filter. Omit it to include every catalog provider."),
    kinds: ArtifactFilterValuesSchema(ArtifactCatalogValueSchema)
      .optional()
      .describe("Optional exact persisted Artifact-kind filter."),
    artifact_types: ArtifactFilterValuesSchema(EngineArtifactTypeSchema)
      .optional()
      .describe("Optional exact namespaced Artifact-type filter."),
    import_source_task_ids: ArtifactFilterValuesSchema(ArtifactIdentifierSchema)
      .optional()
      .describe(
        "Optional exact source-Task lineage filter for imported Engine Artifacts. Non-imported entries never match.",
      ),
    media_types: ArtifactFilterValuesSchema(TaskArtifactMediaTypeSchema)
      .optional()
      .describe("Optional exact resource media-type filter."),
    producer_agent_ids: ArtifactFilterValuesSchema(ArtifactIdentifierSchema)
      .optional()
      .describe(
        "Optional exact projected producer Agent-identity filter. Core-owned typed projections never match this filter; select those by label, kind, artifact type, or Goal.",
      ),
    producer_squad_ids: ArtifactFilterValuesSchema(ArtifactIdentifierSchema)
      .optional()
      .describe(
        "Optional exact projected producer Expert Squad identity filter. Core-owned typed projections never match this filter.",
      ),
    producer_session_ids: ArtifactFilterValuesSchema(ArtifactIdentifierSchema)
      .optional()
      .describe(
        "Optional exact projected or Mission producer Session identity filter. Core-owned typed projections never match this filter.",
      ),
    goal_ids: ArtifactFilterValuesSchema(ArtifactIdentifierSchema)
      .optional()
      .describe("Optional exact logical Goal-subject filter."),
    created_at_or_after_ms: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Optional inclusive lower creation-time bound in Unix milliseconds."),
    created_before_ms: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional exclusive upper creation-time bound in Unix milliseconds."),
    version_scope: ArtifactVersionScopeSchema.default("current").describe(
      "Engine version scope at the frozen catalog revision. Task Artifact snapshots are immutable.",
    ),
    sort: ArtifactSearchSortSchema.optional().describe(
      "Explicit candidate order. Defaults to relevance when query is present and newest otherwise.",
    ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(ArtifactSchemaLimits.maxSearchLimit)
      .default(ArtifactSchemaLimits.defaultSearchLimit)
      .describe("Maximum entries in this stable catalog page."),
    cursor: z
      .string()
      .min(1)
      .max(ArtifactSchemaLimits.cursorLength)
      .optional()
      .describe("Opaque cursor returned by the preceding page; omit it for the first page."),
  })
  .strict()

export function refineArtifactSearchInput(
  input: Pick<z.infer<typeof ArtifactSearchInputObjectSchema>, "query" | "sort">,
  context: z.RefinementCtx,
) {
  if (input.sort === "relevance" && !input.query) {
    context.addIssue({
      code: "custom",
      path: ["sort"],
      message: "relevance sort requires query",
    })
  }
}

export const ArtifactSearchInputSchema = ArtifactSearchInputObjectSchema.superRefine(refineArtifactSearchInput)

export const ArtifactSearchAppliedFiltersSchema = ArtifactSearchInputObjectSchema.omit({
  cursor: true,
}).superRefine(refineArtifactSearchInput)

export const ArtifactSearchWithoutLimitSchema = ArtifactSearchInputObjectSchema.omit({
  limit: true,
}).superRefine(refineArtifactSearchInput)

export const ArtifactCatalogFacetsSchema = z
  .object({
    sources: z.array(ArtifactCatalogSourceSchema).max(ArtifactCatalogSourceSchema.options.length),
    kinds: z.array(ArtifactCatalogValueSchema).max(ArtifactSchemaLimits.facetValues),
    artifact_types: z.array(EngineArtifactTypeSchema).max(ArtifactSchemaLimits.facetValues),
    producer_agent_ids: z.array(ArtifactIdentifierSchema).max(ArtifactSchemaLimits.facetValues),
    producer_squad_ids: z.array(ArtifactIdentifierSchema).max(ArtifactSchemaLimits.facetValues),
    producer_session_ids: z.array(ArtifactIdentifierSchema).max(ArtifactSchemaLimits.facetValues),
    goal_ids: z.array(ArtifactIdentifierSchema).max(ArtifactSchemaLimits.facetValues),
    import_source_task_ids: z.array(ArtifactIdentifierSchema).max(ArtifactSchemaLimits.facetValues),
    media_types: z.array(TaskArtifactMediaTypeSchema).max(ArtifactSchemaLimits.facetValues),
    created_at_min_ms: z.number().int().nonnegative().nullable(),
    created_at_max_ms: z.number().int().nonnegative().nullable(),
    truncated: z.boolean(),
  })
  .strict()

export const ArtifactCatalogProviderErrorSchema = z
  .object({
    source: ArtifactCatalogSourceSchema,
    message: z.string().min(1).max(ArtifactSchemaLimits.providerErrorLength),
  })
  .strict()

export const ArtifactSearchResolutionSchema = z
  .object({
    status: z.enum(["no_match", "unique_candidate", "ambiguous_candidates", "incomplete_catalog"]),
    candidate_count: z.number().int().nonnegative(),
    unmatched_filters: z
      .object({
        sources: z.array(ArtifactCatalogSourceSchema),
        kinds: z.array(ArtifactCatalogValueSchema),
        artifact_types: z.array(EngineArtifactTypeSchema),
        labels: z.array(ArtifactExactLabelSchema),
        producer_agent_ids: z.array(ArtifactIdentifierSchema),
        producer_squad_ids: z.array(ArtifactIdentifierSchema),
        producer_session_ids: z.array(ArtifactIdentifierSchema),
        goal_ids: z.array(ArtifactIdentifierSchema),
        import_source_task_ids: z.array(ArtifactIdentifierSchema),
        media_types: z.array(TaskArtifactMediaTypeSchema),
      })
      .strict(),
    filter_intersection_empty: z.boolean(),
    limitations: z.array(z.enum(["provider_error", "metadata_truncated"])),
  })
  .strict()

export const ArtifactSearchPageSchema = z
  .object({
    entries: z.array(ArtifactCatalogEntrySchema).max(ArtifactSchemaLimits.catalogEntries),
    next_cursor: z.string().min(1).max(ArtifactSchemaLimits.cursorLength).nullable(),
    catalog_total: z.number().int().nonnegative(),
    filtered_total: z.number().int().nonnegative(),
    catalog_complete: z.boolean(),
    metadata_truncated: z.boolean(),
    provider_errors: z.array(ArtifactCatalogProviderErrorSchema).max(ArtifactSchemaLimits.providerErrors),
    applied_filters: ArtifactSearchAppliedFiltersSchema,
    facets: ArtifactCatalogFacetsSchema,
    resolution: ArtifactSearchResolutionSchema,
  })
  .strict()

/**
 * The complete catalog page projected into an Agent tool result.
 *
 * Facets and applied filters are search diagnostics, not page membership.
 * Omitting them keeps the exact entries, stable cursor, provider health, and
 * metadata-completeness facts within a bounded model transport. Callers
 * already own the filters they supplied and can issue a separate search when
 * they need different discovery metadata.
 */
export const ArtifactSearchTransportPageSchema = ArtifactSearchPageSchema.omit({
  applied_filters: true,
  facets: true,
})

export const ArtifactSearchReferenceTransportPageSchema = ArtifactSearchTransportPageSchema.extend({
  entries: z
    .array(
      ArtifactCatalogEntrySchema.extend({
        artifact_locator_ref: ArtifactLocatorReferenceSchema,
      }),
    )
    .max(ArtifactSchemaLimits.catalogEntries),
})

const ArtifactReadMaxBytesSchema = z
  .number()
  .int()
  .min(1)
  .max(ArtifactSchemaLimits.maxReadBytes)
  .default(ArtifactSchemaLimits.defaultReadBytes)
  .describe(
    "Maximum UTF-8 text bytes to return in this exact-read chunk. Binary resources use one complete attachment and ignore text pagination.",
  )

const ArtifactInlineReadFields = {
  locator: ArtifactReadLocatorSchema.describe(
    "Exact typed locator returned by Artifact search, including its immutable digest.",
  ),
  byte_offset: z
    .number()
    .int()
    .nonnegative()
    .default(0)
    .describe("Zero-based byte offset within the exact canonical payload or resource."),
  max_bytes: ArtifactReadMaxBytesSchema,
}

export const ArtifactInlineReadInputSchema = z.object(ArtifactInlineReadFields).strict()

export const ArtifactReadInputSchema = z
  .object({
    ...ArtifactInlineReadFields,
    delivery: z
      .enum(["inline", "materialized_file"])
      .default("inline")
      .describe(
        "inline returns one bounded content chunk. materialized_file verifies one complete text resource and returns an immutable local cache path for bounded command-line inspection.",
      ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.delivery !== "materialized_file") return
    if (value.locator.source !== "task_artifact_resource") {
      context.addIssue({
        code: "custom",
        path: ["delivery"],
        message: "materialized_file requires a task_artifact_resource locator",
      })
    }
    if (value.byte_offset !== 0) {
      context.addIssue({
        code: "custom",
        path: ["byte_offset"],
        message: "materialized_file requires byte_offset=0",
      })
    }
  })

export const ArtifactReadReferenceInputSchema = z
  .object({
    artifact_transport_version: z.literal(2),
    artifact_locator_ref: ArtifactLocatorReferenceSchema,
    byte_offset: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe("Zero-based byte offset within the exact locator identified by artifact_locator_ref."),
    max_bytes: ArtifactReadMaxBytesSchema,
    delivery: z
      .enum(["inline", "materialized_file"])
      .default("inline")
      .describe(
        "inline returns one bounded content chunk. materialized_file verifies one complete text resource and returns an immutable local cache path for bounded command-line inspection.",
      ),
  })
  .strict()

export const ArtifactReadChunkSchema = z
  .object({
    locator: ArtifactReadLocatorSchema,
    media_type: TaskArtifactMediaTypeSchema,
    byte_start: z.number().int().nonnegative(),
    byte_end: z.number().int().nonnegative(),
    next_offset: z.number().int().nonnegative().nullable(),
    total_bytes: z.number().int().nonnegative(),
    complete: z.boolean(),
    sha256: ArtifactSHA256Schema,
    text: z.string().max(ArtifactSchemaLimits.maxReadBytes).optional(),
    materialized_path: z.string().min(1).optional(),
    attachment: z.boolean(),
  })
  .strict()

export const ArtifactReadReferenceChunkSchema = ArtifactReadChunkSchema.extend({
  artifact_transport_version: z.literal(2),
  artifact_locator_ref: ArtifactLocatorReferenceSchema,
  artifact_read_ref: ArtifactReadReferenceSchema,
})

export const ArtifactSelectReferenceInputSchema = z
  .object({
    artifact_transport_version: z.literal(2),
    artifact_read_ref: ArtifactReadReferenceSchema,
    purpose: ArtifactSelectInputSchema.shape.purpose,
  })
  .strict()

export const ArtifactSelectReferenceOutputSchema = z
  .object({
    artifact_transport_version: z.literal(2),
    selection: ArtifactSelectOutputSchema,
    artifact_selection_ref: ArtifactSelectionReferenceSchema,
  })
  .strict()

export type ArtifactJSONValue =
  | null
  | boolean
  | number
  | string
  | ArtifactJSONValue[]
  | { [key: string]: ArtifactJSONValue }

const ArtifactJSONInvalid = Symbol("ArtifactJSONInvalid")

function encodeArtifactJSONKey(key: string): string {
  return JSON.stringify(key)
}

function restoreArtifactJSONKeys(value: ArtifactJSONValue): ArtifactJSONValue {
  if (Array.isArray(value)) return value.map(restoreArtifactJSONKeys)
  if (!value || typeof value !== "object") return value
  const restored: { [key: string]: ArtifactJSONValue } = {}
  for (const [encodedKey, item] of Object.entries(value)) {
    const key = JSON.parse(encodedKey)
    if (typeof key !== "string") throw new TypeError("Canonical Artifact JSON object key must decode to a string")
    Object.defineProperty(restored, key, {
      configurable: true,
      enumerable: true,
      value: restoreArtifactJSONKeys(item),
      writable: true,
    })
  }
  return restored
}

function canonicalizeArtifactJSONValue(
  value: unknown,
  ancestors: Set<object>,
): ArtifactJSONValue | typeof ArtifactJSONInvalid {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : ArtifactJSONInvalid
  if (!value || typeof value !== "object") return ArtifactJSONInvalid
  if (ancestors.has(value)) return ArtifactJSONInvalid
  const prototype = Object.getPrototypeOf(value)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(value)
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || keys.length !== value.length + 1) return ArtifactJSONInvalid
    const length = descriptors.length
    if (!length || !("value" in length) || length.enumerable || length.value !== value.length) {
      return ArtifactJSONInvalid
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)]
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return ArtifactJSONInvalid
    }
  } else {
    if (prototype !== Object.prototype && prototype !== null) return ArtifactJSONInvalid
    for (const key of keys) {
      if (typeof key !== "string") return ArtifactJSONInvalid
      const descriptor = descriptors[key]
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return ArtifactJSONInvalid
    }
  }
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const canonical: ArtifactJSONValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const item = canonicalizeArtifactJSONValue(descriptors[String(index)]!.value, ancestors)
        if (item === ArtifactJSONInvalid) return ArtifactJSONInvalid
        canonical.push(item)
      }
      return canonical
    }
    const canonical: { [key: string]: ArtifactJSONValue } = {}
    for (const key of keys) {
      const item = descriptors[key as string]!.value
      if (item === undefined) continue
      const normalized = canonicalizeArtifactJSONValue(item, ancestors)
      if (normalized === ArtifactJSONInvalid) return ArtifactJSONInvalid
      canonical[encodeArtifactJSONKey(key as string)] = normalized
    }
    return canonical
  } finally {
    ancestors.delete(value)
  }
}

const ArtifactJSONValueShapeSchema: z.ZodType<ArtifactJSONValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(ArtifactJSONValueShapeSchema),
    z.record(z.string(), ArtifactJSONValueShapeSchema),
  ]),
)

/**
 * Validate the raw JavaScript value before Zod reconstructs objects. The
 * recursive output schema remains representable as provider JSON Schema,
 * while the pre-parse check still rejects accessors, sparse arrays, cycles,
 * custom prototypes, and other values whose transport representation would
 * differ from the input.
 */
export const ArtifactJSONValueSchema = z.preprocess((value, context) => {
  const canonical = canonicalizeArtifactJSONValue(value, new Set())
  if (canonical !== ArtifactJSONInvalid) return canonical
  context.addIssue({
    code: "custom",
    message:
      "must be a finite, acyclic canonical JSON value without sparse arrays, extra array properties, root or array-item undefined, functions, symbols, accessors, or custom prototypes; undefined object properties are represented by omission",
  })
  return z.NEVER
}, ArtifactJSONValueShapeSchema.overwrite(restoreArtifactJSONKeys))

export const EngineArtifactPublishInputSchema = z
  .object({
    artifact_type: EngineArtifactTypeSchema,
    schema_version: z.number().int().positive(),
    label: z.string().trim().min(1).max(ArtifactSchemaLimits.labelLength),
    payload: ArtifactJSONValueSchema,
    resources: z.array(TaskArtifactRefSchema).max(ArtifactSchemaLimits.publishResources).default([]),
    source_artifact_locators: z
      .array(ArtifactReadLocatorSchema)
      .max(ArtifactSchemaLimits.publishResources)
      .default([]),
    idempotent: z
      .literal(true)
      .optional()
      .describe(
        "Trusted package publishers may request atomic reuse when owner, type, schema, label, payload, resource content identities, and exact sources are identical.",
      ),
  })
  .strict()

export const EngineArtifactEnvelopeSchema = z
  .object({
    artifact_type: EngineArtifactTypeSchema,
    schema_version: z.number().int().positive(),
    producer: ArtifactProducerSchema,
    payload: ArtifactJSONValueSchema,
    resources: z.array(TaskArtifactRefSchema).max(ArtifactSchemaLimits.publishResources),
    ...ArtifactConsumptionProvenanceFields,
    import_lineage: EngineArtifactImportLineageSchema.optional(),
  })
  .strict()
  .superRefine(refineArtifactConsumptionProvenance)

export const EngineArtifactPublishResultSchema = z
  .object({
    locator: EngineArtifactLocatorSchema,
    sha256: ArtifactSHA256Schema,
  })
  .strict()

export type { ArtifactProducer } from "./artifact-producer"
export type EngineArtifactLocator = z.infer<typeof EngineArtifactLocatorSchema>
export type CrossTaskArtifactImport = z.infer<typeof CrossTaskArtifactImportSchema>
export type CrossTaskArtifactSource = z.infer<typeof CrossTaskArtifactSourceSchema>
export type EngineArtifactImportLineage = z.infer<typeof EngineArtifactImportLineageSchema>
export type CrossTaskArtifactImportMapping = z.infer<typeof CrossTaskArtifactImportMappingSchema>
export type TaskArtifactSnapshotLocator = z.infer<typeof TaskArtifactSnapshotLocatorSchema>
export type TaskArtifactResourceLocator = z.infer<typeof TaskArtifactResourceLocatorSchema>
export type ArtifactLocator = z.infer<typeof ArtifactLocatorSchema>
export type ArtifactReadLocator = z.infer<typeof ArtifactReadLocatorSchema>
export type ArtifactLocatorReference = z.infer<typeof ArtifactLocatorReferenceSchema>
export type ArtifactReadReference = z.infer<typeof ArtifactReadReferenceSchema>
export type ArtifactSelectionReference = z.infer<typeof ArtifactSelectionReferenceSchema>
export type ArtifactSelectInput = z.infer<typeof ArtifactSelectInputSchema>
export type ArtifactSelectOutput = z.infer<typeof ArtifactSelectOutputSchema>
export type ArtifactSelectReferenceInput = z.infer<typeof ArtifactSelectReferenceInputSchema>
export type ArtifactSelectReferenceOutput = z.infer<typeof ArtifactSelectReferenceOutputSchema>
export type ArtifactConsumptionProvenance = z.infer<typeof ArtifactConsumptionProvenanceSchema>
export type SessionEvidenceLocator = z.infer<typeof SessionEvidenceLocatorSchema>
export type SessionMessageEvidenceLocator = z.infer<typeof SessionMessageEvidenceLocatorSchema>
export type GoalRevisionEvidenceLocator = z.infer<typeof GoalRevisionEvidenceLocatorSchema>
export type CoordinationRequestEvidenceLocator = z.infer<typeof CoordinationRequestEvidenceLocatorSchema>
export type EvidenceLocator = z.infer<typeof EvidenceLocatorSchema>
export type EvidenceLocatorInput = z.infer<typeof EvidenceLocatorInputSchema>
export type ArtifactReadLocatorInput = z.infer<typeof ArtifactReadLocatorInputSchema>
export type ArtifactCatalogEntry = z.infer<typeof ArtifactCatalogEntrySchema>
export type ArtifactSearchInput = z.infer<typeof ArtifactSearchInputSchema>
export type ArtifactSearchRequest = z.input<typeof ArtifactSearchInputSchema>
export type ArtifactSearchPage = z.infer<typeof ArtifactSearchPageSchema>
export type ArtifactReadInput = z.infer<typeof ArtifactReadInputSchema>
export type ArtifactReadRequest = z.input<typeof ArtifactReadInputSchema>
export type ArtifactReadReferenceInput = z.infer<typeof ArtifactReadReferenceInputSchema>
export type ArtifactReadChunk = z.infer<typeof ArtifactReadChunkSchema>
export type ArtifactReadReferenceChunk = z.infer<typeof ArtifactReadReferenceChunkSchema>
export type EngineArtifactPublishInput = z.infer<typeof EngineArtifactPublishInputSchema>
export type EngineArtifactPublishRequest = z.input<typeof EngineArtifactPublishInputSchema>
/**
 * Package-facing publish request. Host readers hand back `readonly` arrays
 * (`taskArtifacts.resources`), so the package-facing shape accepts them
 * directly rather than making every publisher copy the list to satisfy a
 * mutability the Host never needs.
 *
 * Sources are not among these fields. A package declares one by calling
 * `engineArtifacts.select`, which is the same act the Host's own publisher
 * requires, and the Host stamps the selected set onto the publication. Asking
 * a package to restate them made a Tool argument out of a fact the Host had
 * already derived — and a package that exposed that argument to its model
 * asked the model to hand-build locator objects, which is the shape that
 * produced publications no input could satisfy.
 */
export type PackageEngineArtifactPublishRequest = Omit<
  EngineArtifactPublishRequest,
  "idempotent" | "resources" | "source_artifact_locators"
> & {
  resources?: readonly TaskArtifactRef[]
}
export type EngineArtifactEnvelope = z.infer<typeof EngineArtifactEnvelopeSchema>
export type EngineArtifactPublishResult = z.infer<typeof EngineArtifactPublishResultSchema>

export type EngineArtifactReadResult = Readonly<{
  chunk: ArtifactReadChunk
  attachment?: Readonly<{
    bytes: Uint8Array
    filename: string
  }>
}>

export type ArtifactReadWindowFact = Readonly<{
  request: ArtifactReadInput
  chunk: ArtifactReadChunk
}>

export function artifactReadLocatorKey(locator: ArtifactReadLocator): string {
  return JSON.stringify(locator)
}

function artifactReadLocatorSHA256(locator: ArtifactReadLocator): string {
  if (locator.source === "engine_artifact") return locator.expected_sha256
  if (locator.source === "task_artifact_snapshot") return locator.snapshot.manifest_sha256
  return locator.ref.sha256
}

function artifactReadLocatorMediaType(locator: ArtifactReadLocator): string {
  return locator.source === "task_artifact_resource" ? locator.ref.media_type : "application/json"
}

/**
 * Derive exact locators whose verified read windows cover every byte from zero
 * through one explicit terminal chunk. This pure audit is shared by persisted
 * Session tool facts and invocation-local package ToolHost reads.
 */
export function auditArtifactReadLocatorsFromFacts(facts: readonly ArtifactReadWindowFact[]): {
  completeLocators: ArtifactReadLocator[]
  invalidLocators: ArtifactReadLocator[]
} {
  const grouped = new Map<string, { locator: ArtifactReadLocator; windows: ArtifactReadWindowFact[] }>()
  for (const raw of facts) {
    const request = ArtifactReadInputSchema.parse(raw.request)
    const chunk = ArtifactReadChunkSchema.parse(raw.chunk)
    const key = artifactReadLocatorKey(request.locator)
    const group = grouped.get(key) ?? { locator: request.locator, windows: [] }
    group.windows.push({ request, chunk })
    grouped.set(key, group)
  }
  const completeLocators: ArtifactReadLocator[] = []
  const invalidLocators: ArtifactReadLocator[] = []
  for (const { locator, windows } of grouped.values()) {
    const expectedSHA256 = artifactReadLocatorSHA256(locator)
    const expectedMediaType = artifactReadLocatorMediaType(locator)
    const totalBytes = windows[0]!.chunk.total_bytes
    const invalid = windows.some(({ request, chunk }) => {
      const textBytes =
        chunk.attachment || chunk.text === undefined ? undefined : new TextEncoder().encode(chunk.text).byteLength
      const transportDisagrees = chunk.attachment
        ? locator.source !== "task_artifact_resource" ||
          request.byte_offset !== 0 ||
          chunk.byte_start !== 0 ||
          chunk.text !== undefined ||
          !chunk.complete ||
          chunk.next_offset !== null ||
          chunk.byte_end !== chunk.total_bytes ||
          chunk.total_bytes !== locator.ref.bytes
        : textBytes === undefined || textBytes !== chunk.byte_end - chunk.byte_start || textBytes > request.max_bytes
      return (
        artifactReadLocatorKey(chunk.locator) !== artifactReadLocatorKey(locator) ||
        chunk.media_type !== expectedMediaType ||
        chunk.sha256 !== expectedSHA256 ||
        chunk.total_bytes !== totalBytes ||
        chunk.byte_end < chunk.byte_start ||
        chunk.byte_end > totalBytes ||
        chunk.byte_start !== request.byte_offset ||
        transportDisagrees ||
        (chunk.complete && chunk.byte_end !== chunk.total_bytes) ||
        (!chunk.complete && (chunk.byte_end <= chunk.byte_start || chunk.byte_end >= chunk.total_bytes)) ||
        chunk.next_offset !== (chunk.complete ? null : chunk.byte_end)
      )
    })
    if (invalid) {
      invalidLocators.push(locator)
      continue
    }
    const intervals = windows
      .map(({ chunk }) => [chunk.byte_start, chunk.byte_end] as const)
      .sort((left, right) => left[0] - right[0] || left[1] - right[1])
    let coveredThrough = 0
    let hasGap = false
    for (const [start, end] of intervals) {
      if (start > coveredThrough) {
        hasGap = true
        break
      }
      coveredThrough = Math.max(coveredThrough, end)
    }
    if (
      !hasGap &&
      coveredThrough === totalBytes &&
      windows.some(({ chunk }) => chunk.complete && chunk.byte_end === totalBytes)
    ) {
      completeLocators.push(locator)
    }
  }
  const byLocator = (left: ArtifactReadLocator, right: ArtifactReadLocator) =>
    artifactReadLocatorKey(left).localeCompare(artifactReadLocatorKey(right))
  return {
    completeLocators: completeLocators.sort(byLocator),
    invalidLocators: invalidLocators.sort(byLocator),
  }
}

export type EngineArtifactHost = Readonly<{
  publish(input: PackageEngineArtifactPublishRequest): Promise<EngineArtifactPublishResult>
  search(input: ArtifactSearchRequest): Promise<ArtifactSearchPage>
  read(input: ArtifactReadRequest): Promise<EngineArtifactReadResult>
  select(input: ArtifactSelectInput): Promise<ArtifactSelectOutput>
}>

export type ExactArtifactRead = Readonly<{
  locator: ArtifactReadLocator
  media_type: string
  bytes: Uint8Array
  sha256: string
}>

export interface ExactArtifactReadDiagnostic {
  readonly index: number
  readonly locator: ArtifactReadLocator
  readonly error: unknown
}

export interface ExactArtifactReadBatch {
  readonly reads: readonly ExactArtifactRead[]
  readonly diagnostics: readonly ExactArtifactReadDiagnostic[]
}

export interface EngineArtifactEnvelopeExpectation {
  readonly artifactType?: string
  readonly schemaVersion?: number
  readonly producer?: Readonly<{
    ownerKind: "projected-scheduler" | "projected-worker"
    expertSquadID: string
    agentID: string
  }>
}

export class ArtifactInspectionError extends AggregateError {
  readonly diagnostics: readonly string[]

  constructor(diagnostics: readonly string[]) {
    const ordered = [...diagnostics].sort()
    super(ordered.map((message) => new Error(message)), `Artifact inspection failed with ${ordered.length} diagnostics`)
    this.name = "ArtifactInspectionError"
    this.diagnostics = ordered
  }
}

/**
 * Assemble one exact Artifact locator without loss or semantic projection.
 *
 * The locator is the authority for media type and digest, and for filesystem
 * resources it also owns the exact byte count. Every Host chunk must preserve
 * that identity, form one contiguous byte stream, and end explicitly. The
 * returned bytes are exposed only after the complete stream has been hashed
 * and all locator metadata has been verified.
 *
 * `maxBytes` controls transport page size only. Omitting it is a valid default
 * and uses the largest page allowed by the shared Artifact ABI.
 */
export async function readExactArtifact(
  host: Pick<EngineArtifactHost, "read">,
  locatorInput: ArtifactReadLocator,
  options: Readonly<{ maxBytes?: number }> = {},
): Promise<ExactArtifactRead> {
  const locator = ArtifactReadLocatorSchema.parse(locatorInput)
  const expectedMediaType = locator.source === "task_artifact_resource" ? locator.ref.media_type : "application/json"
  const expectedSHA256 =
    locator.source === "engine_artifact"
      ? locator.expected_sha256
      : locator.source === "task_artifact_snapshot"
        ? locator.snapshot.manifest_sha256
        : locator.ref.sha256
  const locatorExpectedBytes = locator.source === "task_artifact_resource" ? locator.ref.bytes : undefined
  const maxBytes = ArtifactReadMaxBytesSchema.parse(options.maxBytes ?? ArtifactSchemaLimits.maxReadBytes)
  const chunks: Uint8Array[] = []
  let byteOffset = 0
  let streamTotalBytes: number | undefined

  while (true) {
    const result = await host.read({
      locator,
      byte_offset: byteOffset,
      max_bytes: maxBytes,
    })
    const chunk = ArtifactReadChunkSchema.parse(result.chunk)
    if (!sameArtifactReadLocator(chunk.locator, locator)) {
      throw new Error("artifact exact-read: Host returned a different locator")
    }
    if (chunk.media_type !== expectedMediaType) {
      throw new Error(
        `artifact exact-read: Host returned media type ${chunk.media_type}; expected ${expectedMediaType}`,
      )
    }
    if (chunk.sha256 !== expectedSHA256) {
      throw new Error("artifact exact-read: Host digest does not match the exact locator")
    }
    if (chunk.byte_start !== byteOffset || chunk.byte_end < chunk.byte_start) {
      throw new Error("artifact exact-read: Host returned a non-contiguous byte range")
    }
    if (chunk.byte_end > chunk.total_bytes) {
      throw new Error("artifact exact-read: Host byte range exceeds the declared total")
    }
    streamTotalBytes ??= chunk.total_bytes
    if (chunk.total_bytes !== streamTotalBytes) {
      throw new Error("artifact exact-read: Artifact byte count changed while reading")
    }
    if (locatorExpectedBytes !== undefined && chunk.total_bytes !== locatorExpectedBytes) {
      throw new Error("artifact exact-read: Host byte count does not match the exact resource locator")
    }

    const attachment = result.attachment
    let bytes: Uint8Array
    if (chunk.attachment) {
      if (
        chunk.text !== undefined ||
        !attachment ||
        !(attachment.bytes instanceof Uint8Array) ||
        typeof attachment.filename !== "string" ||
        attachment.filename.length === 0
      ) {
        throw new Error("artifact exact-read: Host returned invalid attachment transport")
      }
      if (
        locator.source !== "task_artifact_resource" ||
        chunk.byte_start !== 0 ||
        !chunk.complete ||
        chunk.next_offset !== null ||
        chunk.byte_end !== chunk.total_bytes
      ) {
        throw new Error("artifact exact-read: binary attachments must contain one complete resource")
      }
      bytes = attachment.bytes
    } else {
      if (attachment || chunk.text === undefined) {
        throw new Error("artifact exact-read: Host returned invalid UTF-8 text transport")
      }
      bytes = new TextEncoder().encode(chunk.text)
      if (bytes.byteLength > maxBytes) {
        throw new Error("artifact exact-read: Host text chunk exceeds the requested byte limit")
      }
    }
    if (bytes.byteLength !== chunk.byte_end - chunk.byte_start) {
      throw new Error("artifact exact-read: transported bytes do not match the declared byte range")
    }
    chunks.push(bytes)

    if (chunk.complete) {
      if (chunk.next_offset !== null || chunk.byte_end !== chunk.total_bytes) {
        throw new Error("artifact exact-read: Host returned an invalid terminal range")
      }
      break
    }
    if (
      chunk.next_offset !== chunk.byte_end ||
      chunk.byte_end >= chunk.total_bytes ||
      chunk.next_offset <= byteOffset
    ) {
      throw new Error("artifact exact-read: Host returned a missing or non-advancing chunk")
    }
    byteOffset = chunk.next_offset
  }

  const bytes = concatenateArtifactBytes(chunks)
  if (bytes.byteLength !== streamTotalBytes) {
    throw new Error("artifact exact-read: assembled bytes do not match the declared total")
  }
  if (createHash("sha256").update(bytes).digest("hex") !== expectedSHA256) {
    throw new Error("artifact exact-read: assembled bytes do not match the exact locator digest")
  }
  return {
    locator,
    media_type: expectedMediaType,
    bytes,
    sha256: expectedSHA256,
  }
}

/**
 * Completely read every exact input without allowing one rejection to cancel
 * sibling reads. Results and diagnostics preserve caller order. This function
 * performs no semantic selection or publication.
 */
export async function readExactArtifactsSettled(
  host: Pick<EngineArtifactHost, "read">,
  locators: readonly ArtifactReadLocator[],
  options: Readonly<{ maxBytes?: number }> = {},
): Promise<ExactArtifactReadBatch> {
  const settled = await Promise.allSettled(locators.map((locator) => readExactArtifact(host, locator, options)))
  const reads: ExactArtifactRead[] = []
  const diagnostics: ExactArtifactReadDiagnostic[] = []
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled") reads.push(result.value)
    else diagnostics.push({ index, locator: locators[index]!, error: result.reason })
  }
  return { reads, diagnostics }
}

/**
 * Decode and inspect the generic Engine Artifact envelope. Domain payload
 * validation remains package-owned.
 */
export function inspectEngineArtifactEnvelope(
  exact: ExactArtifactRead,
  expectation: EngineArtifactEnvelopeExpectation,
): EngineArtifactEnvelope {
  const diagnostics: string[] = []
  if (exact.locator.source !== "engine_artifact") {
    throw new ArtifactInspectionError(["locator must identify an exact Engine Artifact"])
  }
  let decoded: unknown
  try {
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(exact.bytes))
  } catch (error) {
    throw new ArtifactInspectionError([
      `body must be valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`,
    ])
  }
  const parsed = EngineArtifactEnvelopeSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new ArtifactInspectionError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "envelope"
        return `${path}: ${issue.message}`
      }),
    )
  }
  const envelope = parsed.data
  if (expectation.artifactType !== undefined && envelope.artifact_type !== expectation.artifactType) {
    diagnostics.push(`artifact_type must be ${expectation.artifactType}; received ${envelope.artifact_type}`)
  }
  if (expectation.schemaVersion !== undefined && envelope.schema_version !== expectation.schemaVersion) {
    diagnostics.push(`schema_version must be ${expectation.schemaVersion}; received ${envelope.schema_version}`)
  }
  const producer = expectation.producer
  if (producer) {
    if (envelope.producer.owner_kind !== producer.ownerKind) {
      diagnostics.push(`producer.owner_kind must be ${producer.ownerKind}; received ${envelope.producer.owner_kind}`)
    }
    if (
      envelope.producer.owner_kind === "projected-scheduler" ||
      envelope.producer.owner_kind === "projected-worker"
    ) {
      if (envelope.producer.expert_squad_id !== producer.expertSquadID) {
        diagnostics.push(
          `producer.expert_squad_id must be ${producer.expertSquadID}; received ${envelope.producer.expert_squad_id}`,
        )
      }
      if (envelope.producer.agent_id !== producer.agentID) {
        diagnostics.push(`producer.agent_id must be ${producer.agentID}; received ${envelope.producer.agent_id}`)
      }
    }
  }
  if (diagnostics.length > 0) throw new ArtifactInspectionError(diagnostics)
  return envelope
}

/**
 * Commit semantic source selection only after callers have completed all
 * generic and domain validation.
 */
export async function selectExactArtifactSources(
  host: Pick<EngineArtifactHost, "select">,
  reads: readonly ExactArtifactRead[],
  purpose: string,
): Promise<void> {
  await Promise.all(reads.map((read) => host.select({ locator: read.locator, purpose })))
}

function sameArtifactReadLocator(left: ArtifactReadLocator, right: ArtifactReadLocator): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function concatenateArtifactBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}
