import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import z from "zod"
import {
  ArtifactCatalogEntrySchema,
  ArtifactCatalogFacetsSchema,
  ArtifactCatalogProviderErrorSchema,
  ArtifactJSONValueSchema,
  ArtifactReadChunkSchema,
  ArtifactReadInputSchema,
  ArtifactSelectInputSchema,
  ArtifactInspectionError,
  ArtifactConsumptionProvenanceSchema,
  ArtifactSchemaLimits,
  ArtifactSearchAppliedFiltersSchema,
  ArtifactSearchInputSchema,
  ArtifactSearchPageSchema,
  ArtifactSearchTransportPageSchema,
  ArtifactSearchWithoutLimitSchema,
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  EngineArtifactPublishInputSchema,
  EngineArtifactTypeSchema,
  EvidenceLocatorListSchema,
  EvidenceLocatorSchema,
  SessionMessageEvidenceLocatorSchema,
  auditArtifactReadLocatorsFromFacts,
  inspectEngineArtifactEnvelope,
  readExactArtifact,
  readExactArtifactsSettled,
  selectExactArtifactSources,
  type ArtifactReadLocator,
  type EngineArtifactReadResult,
} from "../src/artifact-catalog"
import { ArtifactProducerSchema } from "../src/artifact-producer"

const sha256 = "a".repeat(64)
const identifier = "id"
const producer = {
  owner_kind: "projected-worker" as const,
  expert_squad_id: identifier,
  package_revision: {
    scope: "project" as const,
    project_id: "project-fixture",
    namespace: identifier,
    id: identifier,
    version: identifier,
    package_digest: sha256,
  },
  agent_id: identifier,
  projection_hash: sha256,
  session_id: identifier,
  message_id: identifier,
  tool_call_id: identifier,
}
const engineLocator = {
  source: "engine_artifact" as const,
  artifact_id: identifier,
  catalog_revision: 1,
  expected_sha256: sha256,
}
const resource = {
  snapshot: {
    schema_version: 2 as const,
    project_id: "project",
    task_id: "task",
    snapshot_id: "00000000-0000-4000-8000-000000000000",
    manifest_sha256: sha256,
  },
  tree: "assets",
  path: "reference.png",
  media_type: "image/png",
  bytes: 1,
  sha256,
}
const catalogEntry = {
  source: "engine_artifact" as const,
  locator: engineLocator,
  kind: "engine_artifact",
  artifact_type: "general/report",
  schema_diagnostic_truncated: false,
  label: "Report",
  label_truncated: false,
  goal_id: null,
  import_source_task_id: null,
  producer,
  created_at_ms: 1,
  bytes: 1,
  sha256,
  resource_count: 0,
  resource_media_types: [],
  resource_media_types_truncated: false,
  version: {
    state: "current" as const,
    catalog_revision: 1,
  },
}
const facets = {
  sources: ["engine_artifact" as const],
  kinds: ["engine_artifact"],
  artifact_types: ["general/report"],
  producer_agent_ids: [identifier],
  producer_squad_ids: [identifier],
  producer_session_ids: [identifier],
  goal_ids: [],
  import_source_task_ids: [],
  media_types: ["application/json"],
  created_at_min_ms: 1,
  created_at_max_ms: 1,
  truncated: false,
}
const searchPage = {
  entries: [catalogEntry],
  next_cursor: null,
  catalog_total: 1,
  filtered_total: 1,
  catalog_complete: true,
  metadata_truncated: false,
  provider_errors: [],
  applied_filters: {
    version_scope: "current" as const,
    limit: ArtifactSchemaLimits.defaultSearchLimit,
  },
  facets,
  resolution: {
    status: "unique_candidate" as const,
    candidate_count: 1,
    unmatched_filters: {
      sources: [],
      kinds: [],
      artifact_types: [],
      labels: [],
      producer_agent_ids: [],
      producer_squad_ids: [],
      producer_session_ids: [],
      goal_ids: [],
      import_source_task_ids: [],
      media_types: [],
    },
    filter_intersection_empty: false,
    limitations: [],
  },
}

function accepts(schema: { safeParse(value: unknown): { success: boolean } }, value: unknown): void {
  expect(schema.safeParse(value).success).toBe(true)
}

function rejects(schema: { safeParse(value: unknown): { success: boolean } }, value: unknown): void {
  expect(schema.safeParse(value).success).toBe(false)
}

describe("EvidenceLocator", () => {
  test("accepts only the closed typed locator family", () => {
    for (const locator of [
      engineLocator,
      { source: "task_artifact_snapshot", snapshot: resource.snapshot },
      { source: "task_artifact_resource", ref: resource },
      { source: "session", session_id: "session" },
      { source: "session_message", session_id: "session", message_id: "message" },
      { source: "goal_revision", goal_id: "goal" },
      { source: "coordination_request", request_id: "request" },
    ]) {
      accepts(EvidenceLocatorSchema, locator)
    }
    rejects(EvidenceLocatorSchema, "artifact:id")
    rejects(EvidenceLocatorSchema, "src/report.json")
    rejects(EvidenceLocatorSchema, { source: "engine_artifact", artifact_id: "id" })
  })

  test("keeps an empty list legal and rejects duplicate typed locators", () => {
    expect(EvidenceLocatorListSchema.parse([])).toEqual([])
    accepts(EvidenceLocatorListSchema, [engineLocator])
    rejects(EvidenceLocatorListSchema, [engineLocator, engineLocator])
    rejects(EvidenceLocatorListSchema, ["artifact:id"])
  })

  test("describes a session message as one exact producing-session pair", () => {
    const schema = z.toJSONSchema(SessionMessageEvidenceLocatorSchema) as {
      properties?: Record<string, { description?: string }>
    }
    expect(schema.properties?.session_id?.description).toContain("Exact producing Session ID")
    expect(schema.properties?.session_id?.description).toContain("do not substitute the current caller Session")
    expect(schema.properties?.message_id?.description).toContain("stored in the paired session_id")
  })
})

describe("Artifact schema upper bounds", () => {
  test("canonicalizes JSON object omission centrally and preserves every legal string key", () => {
    const keys = [
      "",
      "__proto__",
      "constructor",
      "prototype",
      "\u0000__proto__",
      "中文",
      "😀",
      '"quoted"',
      "\\backslash",
      "\u2028",
      "\ud800",
    ]
    const value = Object.fromEntries(
      keys.map((key, index) => [
        key,
        {
          keep: index,
          omit: undefined,
          nested: Object.fromEntries([[key, `value-${index}`]]),
        },
      ]),
    )

    const parsed = ArtifactJSONValueSchema.parse({
      keep: true,
      omit: undefined,
      value,
    })
    expect(Object.hasOwn(parsed as object, "omit")).toBe(false)
    const parsedValue = (parsed as { value: Record<string, Record<string, unknown>> }).value
    expect(Reflect.ownKeys(parsedValue)).toEqual(keys)
    for (const [index, key] of keys.entries()) {
      expect(Object.hasOwn(parsedValue[key]!, "omit")).toBe(false)
      expect(parsedValue[key]!.nested).toEqual({ [key]: `value-${index}` })
    }
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed)

    const nullPrototype = Object.create(null) as Record<string, unknown>
    Object.defineProperty(nullPrototype, "__proto__", {
      configurable: true,
      enumerable: true,
      value: "preserved",
      writable: true,
    })
    expect(ArtifactJSONValueSchema.parse(nullPrototype)).toEqual({ ["__proto__"]: "preserved" })
  })

  test("rejects every JavaScript value that cannot cross the canonical JSON boundary exactly", () => {
    const sparse = Array(1)
    const arrayWithExtraProperty = [1] as unknown[] & { extra?: number }
    arrayWithExtraProperty.extra = 2
    const accessor = {}
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => 1,
    })
    const nonEnumerable = {}
    Object.defineProperty(nonEnumerable, "value", {
      enumerable: false,
      value: 1,
    })
    const symbolProperty = { keep: true } as Record<PropertyKey, unknown>
    symbolProperty[Symbol("hidden")] = true
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    for (const invalid of [
      undefined,
      [undefined],
      sparse,
      arrayWithExtraProperty,
      accessor,
      nonEnumerable,
      symbolProperty,
      () => undefined,
      Symbol("value"),
      1n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      new Date(0),
      new (class Custom {
        value = 1
      })(),
      cyclic,
      { nested: [undefined] },
      { nested: Number.NEGATIVE_INFINITY },
    ]) {
      rejects(ArtifactJSONValueSchema, invalid)
    }
  })

  test("bounds every producer identifier without making provenance optional", () => {
    const maximumIdentifier = "p".repeat(ArtifactSchemaLimits.identifierLength)
    for (const key of ["expert_squad_id", "agent_id", "session_id", "message_id", "tool_call_id"] as const) {
      const matching =
        key === "expert_squad_id"
          ? {
              ...producer,
              [key]: maximumIdentifier,
              package_revision: { ...producer.package_revision, id: maximumIdentifier },
            }
          : { ...producer, [key]: maximumIdentifier }
      accepts(ArtifactProducerSchema, matching)
      rejects(ArtifactProducerSchema, { ...matching, [key]: `${maximumIdentifier}x` })
    }
  })

  test("bounds Engine Artifact identifiers and namespaced artifact types", () => {
    const maximumIdentifier = "a".repeat(ArtifactSchemaLimits.identifierLength)
    accepts(EngineArtifactLocatorSchema, { ...engineLocator, artifact_id: maximumIdentifier })
    rejects(EngineArtifactLocatorSchema, { ...engineLocator, artifact_id: `${maximumIdentifier}a` })

    const maximumType = `s/${"a".repeat(ArtifactSchemaLimits.artifactTypeLength - 2)}`
    accepts(EngineArtifactTypeSchema, maximumType)
    rejects(EngineArtifactTypeSchema, `${maximumType}a`)
  })

  test("keeps omitted search filters legal and bounds query, cursor, and every filter array", () => {
    expect(ArtifactSearchInputSchema.parse({})).toEqual({
      version_scope: "current",
      limit: ArtifactSchemaLimits.defaultSearchLimit,
    })

    const maximumQuery = "q".repeat(ArtifactSchemaLimits.queryLength)
    const maximumCursor = "c".repeat(ArtifactSchemaLimits.cursorLength)
    accepts(ArtifactSearchInputSchema, {
      query: { text: maximumQuery, mode: "substring" },
      cursor: maximumCursor,
    })
    rejects(ArtifactSearchInputSchema, { query: { text: `${maximumQuery}q`, mode: "substring" } })
    rejects(ArtifactSearchInputSchema, { cursor: `${maximumCursor}c` })
    rejects(ArtifactSearchInputSchema, {
      sources: ["engine_artifact", "task_artifact", "engine_artifact"],
    })

    const maximumIdentifier = "i".repeat(ArtifactSchemaLimits.identifierLength)
    const maximumCatalogValue = "k".repeat(ArtifactSchemaLimits.catalogValueLength)
    const maximumType = `s/${"a".repeat(ArtifactSchemaLimits.artifactTypeLength - 2)}`
    const boundedFilters = {
      kinds: maximumCatalogValue,
      artifact_types: maximumType,
      media_types: "application/json",
      producer_agent_ids: maximumIdentifier,
      producer_squad_ids: maximumIdentifier,
      producer_session_ids: maximumIdentifier,
      import_source_task_ids: maximumIdentifier,
    } as const
    for (const [key, value] of Object.entries(boundedFilters)) {
      accepts(ArtifactSearchInputSchema, {
        [key]: Array.from({ length: ArtifactSchemaLimits.filterValues }, () => value),
      })
      rejects(ArtifactSearchInputSchema, {
        [key]: Array.from({ length: ArtifactSchemaLimits.filterValues + 1 }, () => value),
      })
    }
    rejects(ArtifactSearchInputSchema, { kinds: [`${maximumCatalogValue}k`] })
    rejects(ArtifactSearchInputSchema, { artifact_types: [`${maximumType}a`] })
    rejects(ArtifactSearchInputSchema, { producer_agent_ids: [`${maximumIdentifier}i`] })
  })

  test("derives structural variants before applying cross-field search validation", () => {
    expect(ArtifactSearchAppliedFiltersSchema.safeParse({ sort: "relevance" }).success).toBe(false)
    expect(
      ArtifactSearchAppliedFiltersSchema.parse({
        query: { text: "requirements", mode: "substring" },
        sort: "relevance",
      }),
    ).toEqual({
      query: { text: "requirements", mode: "substring" },
      sort: "relevance",
      version_scope: "current",
      limit: ArtifactSchemaLimits.defaultSearchLimit,
    })
    expect(
      ArtifactSearchAppliedFiltersSchema.safeParse({
        query: { text: "requirements", mode: "substring" },
        cursor: "not-an-applied-filter",
      }).success,
    ).toBe(false)
    expect(
      ArtifactSearchWithoutLimitSchema.safeParse({
        limit: ArtifactSchemaLimits.defaultSearchLimit,
      }).success,
    ).toBe(false)
    expect(ArtifactSearchWithoutLimitSchema.safeParse({ sort: "relevance" }).success).toBe(false)
  })

  test("documents producer filters as projected provenance rather than Core fact origin", () => {
    expect(ArtifactSearchInputSchema.shape.producer_agent_ids.description).toContain(
      "Core-owned typed projections never match",
    )
    expect(ArtifactSearchInputSchema.shape.producer_squad_ids.description).toContain(
      "Core-owned typed projections never match",
    )
    expect(ArtifactSearchInputSchema.shape.producer_session_ids.description).toContain(
      "Core-owned typed projections never match",
    )
  })

  test("bounds catalog entry metadata, facet values, cursors, and provider errors", () => {
    const maximumCatalogValue = "k".repeat(ArtifactSchemaLimits.catalogValueLength)
    const maximumIdentifier = "i".repeat(ArtifactSchemaLimits.identifierLength)
    const maximumLabel = "l".repeat(ArtifactSchemaLimits.labelLength)
    const maximumDiagnostic = "d".repeat(ArtifactSchemaLimits.schemaDiagnosticLength)
    accepts(ArtifactCatalogEntrySchema, {
      ...catalogEntry,
      kind: maximumCatalogValue,
      label: maximumLabel,
      schema_diagnostic: maximumDiagnostic,
      import_source_task_id: maximumIdentifier,
    })
    rejects(ArtifactCatalogEntrySchema, { ...catalogEntry, kind: `${maximumCatalogValue}k` })
    rejects(ArtifactCatalogEntrySchema, { ...catalogEntry, label: `${maximumLabel}l` })
    rejects(ArtifactCatalogEntrySchema, {
      ...catalogEntry,
      schema_diagnostic: `${maximumDiagnostic}d`,
    })
    rejects(ArtifactCatalogEntrySchema, {
      ...catalogEntry,
      import_source_task_id: `${maximumIdentifier}i`,
    })
    rejects(ArtifactCatalogEntrySchema, {
      ...catalogEntry,
      resource_media_types: Array.from(
        { length: ArtifactSchemaLimits.resourceMediaTypes + 1 },
        () => "application/json",
      ),
    })

    accepts(ArtifactCatalogFacetsSchema, {
      ...facets,
      kinds: Array.from({ length: ArtifactSchemaLimits.facetValues }, () => maximumCatalogValue),
      producer_agent_ids: Array.from({ length: ArtifactSchemaLimits.facetValues }, () => maximumIdentifier),
    })
    rejects(ArtifactCatalogFacetsSchema, { ...facets, kinds: [`${maximumCatalogValue}k`] })
    rejects(ArtifactCatalogFacetsSchema, {
      ...facets,
      kinds: Array.from({ length: ArtifactSchemaLimits.facetValues + 1 }, () => maximumCatalogValue),
    })
    rejects(ArtifactCatalogFacetsSchema, {
      ...facets,
      producer_agent_ids: [`${maximumIdentifier}i`],
    })

    const maximumError = "e".repeat(ArtifactSchemaLimits.providerErrorLength)
    accepts(ArtifactCatalogProviderErrorSchema, { source: "engine_artifact", message: maximumError })
    rejects(ArtifactCatalogProviderErrorSchema, {
      source: "engine_artifact",
      message: `${maximumError}e`,
    })
    accepts(ArtifactSearchPageSchema, {
      ...searchPage,
      next_cursor: "c".repeat(ArtifactSchemaLimits.cursorLength),
    })
    rejects(ArtifactSearchPageSchema, {
      ...searchPage,
      next_cursor: "c".repeat(ArtifactSchemaLimits.cursorLength + 1),
    })
    rejects(ArtifactSearchPageSchema, {
      ...searchPage,
      provider_errors: Array.from({ length: ArtifactSchemaLimits.providerErrors + 1 }, () => ({
        source: "engine_artifact",
        message: "failed",
      })),
    })
  })

  test("applied filters inherit the bounded search input contract", () => {
    accepts(ArtifactSearchPageSchema, searchPage)
    rejects(ArtifactSearchPageSchema, {
      ...searchPage,
      applied_filters: {
        ...searchPage.applied_filters,
        query: {
          text: "q".repeat(ArtifactSchemaLimits.queryLength + 1),
          mode: "substring",
        },
      },
    })
  })

  test("defines one strict bounded transport projection without duplicating page membership", () => {
    const { applied_filters: _appliedFilters, facets: _facets, ...transportPage } = searchPage
    accepts(ArtifactSearchTransportPageSchema, transportPage)
    rejects(ArtifactSearchTransportPageSchema, searchPage)
    rejects(ArtifactSearchTransportPageSchema, {
      ...transportPage,
      entries: Array.from({ length: ArtifactSchemaLimits.catalogEntries + 1 }, () => catalogEntry),
    })
  })

  test("bounds publish labels and resources while keeping resources omitted by default", () => {
    const request = {
      artifact_type: "general/report",
      schema_version: 1,
      label: "Report",
      payload: { status: "complete" },
    }
    expect(EngineArtifactPublishInputSchema.parse(request).resources).toEqual([])
    expect(EngineArtifactPublishInputSchema.parse(request).source_artifact_locators).toEqual([])
    expect(EngineArtifactPublishInputSchema.parse(request).idempotent).toBeUndefined()
    expect(EngineArtifactPublishInputSchema.parse({ ...request, idempotent: true }).idempotent).toBe(true)
    rejects(EngineArtifactPublishInputSchema, { ...request, idempotent: false })
    accepts(EngineArtifactPublishInputSchema, {
      ...request,
      label: "l".repeat(ArtifactSchemaLimits.labelLength),
      resources: Array.from({ length: ArtifactSchemaLimits.publishResources }, () => resource),
    })
    rejects(EngineArtifactPublishInputSchema, {
      ...request,
      label: "l".repeat(ArtifactSchemaLimits.labelLength + 1),
    })
    rejects(EngineArtifactPublishInputSchema, {
      ...request,
      resources: Array.from({ length: ArtifactSchemaLimits.publishResources + 1 }, () => resource),
    })
    rejects(EngineArtifactEnvelopeSchema, {
      artifact_type: request.artifact_type,
      schema_version: request.schema_version,
      producer,
      payload: request.payload,
      resources: Array.from({ length: ArtifactSchemaLimits.publishResources + 1 }, () => resource),
    })
  })

  test("keeps semantic selection explicit while accepting empty provenance", () => {
    expect(ArtifactConsumptionProvenanceSchema.parse({})).toEqual({
      observed_artifact_locators: [],
      source_artifact_locators: [],
    })
    accepts(ArtifactSelectInputSchema, {
      locator: engineLocator,
      purpose: "authoritative requirement source",
    })
    rejects(ArtifactSelectInputSchema, {
      locator: engineLocator,
      purpose: "",
    })
    accepts(ArtifactConsumptionProvenanceSchema, {
      observed_artifact_locators: [engineLocator],
      source_artifact_locators: [engineLocator],
    })
    rejects(ArtifactConsumptionProvenanceSchema, {
      observed_artifact_locators: [],
      source_artifact_locators: [engineLocator],
    })
    rejects(ArtifactConsumptionProvenanceSchema, {
      observed_artifact_locators: [engineLocator, engineLocator],
      source_artifact_locators: [],
    })
  })

  test("centralizes search-page and read-chunk volume limits", () => {
    expect(ArtifactSchemaLimits.structuredOutputBytes).toBe(40 * 1_024)
    accepts(ArtifactSearchPageSchema, {
      ...searchPage,
      entries: Array.from({ length: ArtifactSchemaLimits.catalogEntries }, () => catalogEntry),
    })
    rejects(ArtifactSearchPageSchema, {
      ...searchPage,
      entries: Array.from({ length: ArtifactSchemaLimits.catalogEntries + 1 }, () => catalogEntry),
    })
    expect(ArtifactReadInputSchema.parse({ locator: engineLocator })).toEqual({
      locator: engineLocator,
      byte_offset: 0,
      max_bytes: ArtifactSchemaLimits.defaultReadBytes,
      delivery: "inline",
    })
    rejects(ArtifactReadInputSchema, {
      locator: engineLocator,
      max_bytes: ArtifactSchemaLimits.maxReadBytes + 1,
    })
    rejects(ArtifactReadChunkSchema, {
      locator: engineLocator,
      media_type: "application/json",
      byte_start: 0,
      byte_end: ArtifactSchemaLimits.maxReadBytes + 1,
      next_offset: null,
      total_bytes: ArtifactSchemaLimits.maxReadBytes + 1,
      complete: true,
      sha256,
      text: "x".repeat(ArtifactSchemaLimits.maxReadBytes + 1),
      attachment: false,
    })
  })
})

describe("exact Artifact assembler", () => {
  test("assembles every contiguous text chunk and accepts the documented page-size default", async () => {
    const bytes = new TextEncoder().encode('{"status":"complete","findings":[]}')
    const locator = engineReadLocator(bytes)
    const calls: Array<{ byte_offset?: number; max_bytes?: number }> = []
    const host = textReadHost(bytes, locator, calls)

    const paged = await readExactArtifact(host, locator, { maxBytes: 7 })
    expect(paged.bytes).toEqual(bytes)
    expect(paged.media_type).toBe("application/json")
    expect(paged.sha256).toBe(locator.expected_sha256)
    expect(calls.length).toBeGreaterThan(1)
    expect(calls.map((call) => call.byte_offset)).toEqual(calls.map((_, index) => index * 7))

    calls.length = 0
    const defaulted = await readExactArtifact(host, locator)
    expect(defaulted.bytes).toEqual(bytes)
    expect(calls).toEqual([expect.objectContaining({ byte_offset: 0, max_bytes: ArtifactSchemaLimits.maxReadBytes })])
  })

  test("assembles one exact binary resource attachment and verifies locator-owned bytes", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const digest = createHash("sha256").update(bytes).digest("hex")
    const locator = {
      source: "task_artifact_resource" as const,
      ref: {
        ...resource,
        bytes: bytes.byteLength,
        sha256: digest,
      },
    }
    const exact = await readExactArtifact(
      {
        async read(input) {
          return {
            chunk: {
              locator,
              media_type: locator.ref.media_type,
              byte_start: input.byte_offset ?? 0,
              byte_end: bytes.byteLength,
              next_offset: null,
              total_bytes: bytes.byteLength,
              complete: true,
              sha256: digest,
              attachment: true,
            },
            attachment: { bytes, filename: "reference.png" },
          }
        },
      },
      locator,
    )
    expect(exact.bytes).toEqual(bytes)
  })

  test("hard-fails locator, media, range, digest, and content corruption", async () => {
    const bytes = new TextEncoder().encode('{"ok":true}')
    const locator = engineReadLocator(bytes)
    const cases: ReadonlyArray<{
      label: string
      mutate(result: EngineArtifactReadResult): EngineArtifactReadResult
      error: string
    }> = [
      {
        label: "locator drift",
        mutate: (result) => ({
          ...result,
          chunk: {
            ...result.chunk,
            locator: { ...locator, artifact_id: "different-artifact" },
          },
        }),
        error: "different locator",
      },
      {
        label: "media drift",
        mutate: (result) => ({
          ...result,
          chunk: { ...result.chunk, media_type: "text/plain" },
        }),
        error: "media type",
      },
      {
        label: "offset gap",
        mutate: (result) => ({
          ...result,
          chunk: { ...result.chunk, byte_start: 1 },
        }),
        error: "non-contiguous",
      },
      {
        label: "digest drift",
        mutate: (result) => ({
          ...result,
          chunk: { ...result.chunk, sha256: "b".repeat(64) },
        }),
        error: "digest",
      },
      {
        label: "content corruption",
        mutate: (result) => ({
          ...result,
          chunk: { ...result.chunk, text: '{"ok":fals}' },
        }),
        error: "locator digest",
      },
    ]
    for (const item of cases) {
      await expect(
        readExactArtifact(textReadHost(bytes, locator, [], item.mutate), locator),
        item.label,
      ).rejects.toThrow(item.error)
    }
  })

  test("hard-fails locator drift after a valid first page and contradictory terminal markers", async () => {
    const bytes = new TextEncoder().encode("abcdef")
    const locator = engineReadLocator(bytes)
    let page = 0
    await expect(
      readExactArtifact(
        textReadHost(bytes, locator, [], (result) => {
          page += 1
          return page === 2
            ? {
                ...result,
                chunk: {
                  ...result.chunk,
                  locator: { ...locator, artifact_id: "drifted-after-first-page" },
                },
              }
            : result
        }),
        locator,
        { maxBytes: 2 },
      ),
    ).rejects.toThrow("different locator")
    expect(page).toBe(2)

    await expect(
      readExactArtifact(
        textReadHost(bytes, locator, [], (result) => ({
          ...result,
          chunk: { ...result.chunk, next_offset: result.chunk.byte_end },
        })),
        locator,
      ),
    ).rejects.toThrow("invalid terminal range")
  })

  test("hard-fails missing terminal bytes and resource byte-count drift while accepting an empty Artifact", async () => {
    const bytes = new TextEncoder().encode("abc")
    const digest = createHash("sha256").update(bytes).digest("hex")
    const resourceLocator = {
      source: "task_artifact_resource" as const,
      ref: { ...resource, media_type: "text/plain", path: "note.txt", bytes: 4, sha256: digest },
    }
    await expect(readExactArtifact(textReadHost(bytes, resourceLocator), resourceLocator)).rejects.toThrow("byte count")

    const locator = engineReadLocator(bytes)
    await expect(
      readExactArtifact(
        textReadHost(bytes, locator, [], (result) => ({
          ...result,
          chunk: {
            ...result.chunk,
            byte_end: result.chunk.byte_end - 1,
            complete: true,
            next_offset: null,
            text: "ab",
          },
        })),
        locator,
      ),
    ).rejects.toThrow("terminal range")

    const empty = new Uint8Array()
    const emptyLocator = engineReadLocator(empty)
    const exact = await readExactArtifact(textReadHost(empty, emptyLocator), emptyLocator)
    expect(exact.bytes).toEqual(empty)
  })

  test("settles every exact read in caller order before semantic selection", async () => {
    const goodBytes = new TextEncoder().encode('{"ok":true}')
    const goodLocator = engineReadLocator(goodBytes)
    const badLocator = { ...goodLocator, artifact_id: "bad-read" }
    const delegate = textReadHost(goodBytes, goodLocator)
    const host = {
      async read(input: Parameters<typeof delegate.read>[0]) {
        if (input.locator.source === "engine_artifact" && input.locator.artifact_id === "bad-read") {
          throw new Error("deliberate read failure")
        }
        return delegate.read(input)
      },
    }
    const batch = await readExactArtifactsSettled(host, [badLocator, goodLocator])
    expect(batch.reads).toHaveLength(1)
    expect(batch.diagnostics).toMatchObject([{ index: 0, locator: badLocator }])

    const selected: ArtifactReadLocator[] = []
    await selectExactArtifactSources(
      {
        async select(input) {
          selected.push(input.locator)
          return input
        },
      },
      batch.reads,
      "validated source",
    )
    expect(selected).toEqual([goodLocator])
  })

  test("reports all independent Engine envelope expectation mismatches", async () => {
    const envelope = {
      artifact_type: "example/actual",
      schema_version: 3,
      producer,
      payload: {},
      resources: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
    }
    const bytes = new TextEncoder().encode(JSON.stringify(envelope))
    const locator = engineReadLocator(bytes)
    const exact = await readExactArtifact(textReadHost(bytes, locator), locator)
    let failure: unknown
    try {
      inspectEngineArtifactEnvelope(exact, {
        artifactType: "example/expected",
        schemaVersion: 1,
        producer: {
          ownerKind: "projected-scheduler",
          expertSquadID: "other-squad",
          agentID: "other-agent",
        },
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(ArtifactInspectionError)
    expect((failure as ArtifactInspectionError).diagnostics).toHaveLength(5)
  })
})

describe("completed Artifact read fact audit", () => {
  test("accepts one complete binary attachment larger than the text page limit", () => {
    const bytes = ArtifactSchemaLimits.defaultReadBytes + 4096
    const digest = "b".repeat(64)
    const locator = {
      source: "task_artifact_resource" as const,
      ref: {
        ...resource,
        bytes,
        sha256: digest,
      },
    }
    const request = {
      locator,
      byte_offset: 0,
      max_bytes: ArtifactSchemaLimits.defaultReadBytes,
    }
    const chunk = {
      locator,
      media_type: locator.ref.media_type,
      byte_start: 0,
      byte_end: bytes,
      next_offset: null,
      total_bytes: bytes,
      complete: true,
      sha256: digest,
      attachment: true,
    }

    expect(auditArtifactReadLocatorsFromFacts([{ request, chunk }])).toEqual({
      completeLocators: [locator],
      invalidLocators: [],
    })
  })

  test("keeps malformed binary transports and oversized text as evidence errors", () => {
    const bytes = ArtifactSchemaLimits.defaultReadBytes + 4096
    const digest = "b".repeat(64)
    const locator = {
      source: "task_artifact_resource" as const,
      ref: {
        ...resource,
        bytes,
        sha256: digest,
      },
    }
    const request = {
      locator,
      byte_offset: 0,
      max_bytes: ArtifactSchemaLimits.defaultReadBytes,
    }
    const chunk = {
      locator,
      media_type: locator.ref.media_type,
      byte_start: 0,
      byte_end: bytes,
      next_offset: null,
      total_bytes: bytes,
      complete: true,
      sha256: digest,
      attachment: true,
    }
    const engine = {
      source: "engine_artifact" as const,
      artifact_id: "binary-engine",
      catalog_revision: 1,
      expected_sha256: digest,
    }
    const validEngine = {
      source: "engine_artifact" as const,
      artifact_id: "valid-engine",
      catalog_revision: 2,
      expected_sha256: "d".repeat(64),
    }
    const validFact = {
      request: { locator: validEngine, byte_offset: 0, max_bytes: 1 },
      chunk: {
        locator: validEngine,
        media_type: "application/json",
        byte_start: 0,
        byte_end: 1,
        next_offset: null,
        total_bytes: 1,
        complete: true,
        sha256: validEngine.expected_sha256,
        text: "x",
        attachment: false,
      },
    }
    const invalidFacts = [
      {
        request,
        chunk: {
          ...chunk,
          byte_end: ArtifactSchemaLimits.defaultReadBytes,
          next_offset: ArtifactSchemaLimits.defaultReadBytes,
          complete: false,
        },
      },
      {
        request: { ...request, byte_offset: 1 },
        chunk: { ...chunk, byte_start: 1 },
      },
      {
        request,
        chunk: { ...chunk, byte_end: bytes - 1, total_bytes: bytes - 1 },
      },
      {
        request: { ...request, locator: engine },
        chunk: {
          ...chunk,
          locator: engine,
          media_type: "application/json",
          sha256: engine.expected_sha256,
        },
      },
      {
        request,
        chunk: { ...chunk, sha256: "c".repeat(64) },
      },
      {
        request,
        chunk: {
          ...chunk,
          locator: engine,
          media_type: "application/json",
          sha256: engine.expected_sha256,
        },
      },
      {
        request: { ...request, locator: engine },
        chunk: {
          ...chunk,
          locator: engine,
          media_type: "application/json",
          sha256: engine.expected_sha256,
          attachment: false,
        },
      },
      {
        request,
        chunk: {
          ...chunk,
          byte_end: 0,
          next_offset: 0,
          complete: false,
          text: "",
          attachment: false,
        },
      },
      {
        request: { ...request, max_bytes: 1 },
        chunk: {
          ...chunk,
          byte_end: 1,
          next_offset: 1,
          total_bytes: 1,
          complete: false,
          text: "x",
          attachment: false,
        },
      },
    ]

    for (const fact of invalidFacts) {
      const audit = auditArtifactReadLocatorsFromFacts([fact, validFact])
      expect(audit.completeLocators).toEqual([validEngine])
      expect(audit.invalidLocators).toEqual([fact.request.locator])
    }

    const earlyTerminal = {
      source: "engine_artifact" as const,
      artifact_id: "early-terminal",
      catalog_revision: 3,
      expected_sha256: "e".repeat(64),
    }
    const earlyTerminalAudit = auditArtifactReadLocatorsFromFacts([
      {
        request: { locator: earlyTerminal, byte_offset: 0, max_bytes: 5 },
        chunk: {
          locator: earlyTerminal,
          media_type: "application/json",
          byte_start: 0,
          byte_end: 5,
          next_offset: null,
          total_bytes: 10,
          complete: true,
          sha256: earlyTerminal.expected_sha256,
          text: "first",
          attachment: false,
        },
      },
      {
        request: { locator: earlyTerminal, byte_offset: 5, max_bytes: 5 },
        chunk: {
          locator: earlyTerminal,
          media_type: "application/json",
          byte_start: 5,
          byte_end: 10,
          next_offset: null,
          total_bytes: 10,
          complete: true,
          sha256: earlyTerminal.expected_sha256,
          text: "later",
          attachment: false,
        },
      },
      validFact,
    ])
    expect(earlyTerminalAudit.completeLocators).toEqual([validEngine])
    expect(earlyTerminalAudit.invalidLocators).toEqual([earlyTerminal])
  })
})

function engineReadLocator(bytes: Uint8Array) {
  return {
    source: "engine_artifact" as const,
    artifact_id: "artifact",
    catalog_revision: 1,
    expected_sha256: createHash("sha256").update(bytes).digest("hex"),
  }
}

function textReadHost(
  bytes: Uint8Array,
  locator: ArtifactReadLocator,
  calls: Array<{ byte_offset?: number; max_bytes?: number }> = [],
  mutate?: (result: EngineArtifactReadResult) => EngineArtifactReadResult,
) {
  return {
    async read(input: { byte_offset?: number; max_bytes?: number }) {
      calls.push(input)
      const byteStart = input.byte_offset ?? 0
      const byteEnd = Math.min(bytes.byteLength, byteStart + (input.max_bytes ?? bytes.byteLength))
      const complete = byteEnd === bytes.byteLength
      const result: EngineArtifactReadResult = {
        chunk: {
          locator,
          media_type: locator.source === "task_artifact_resource" ? locator.ref.media_type : "application/json",
          byte_start: byteStart,
          byte_end: byteEnd,
          next_offset: complete ? null : byteEnd,
          total_bytes: bytes.byteLength,
          complete,
          sha256:
            locator.source === "engine_artifact"
              ? locator.expected_sha256
              : locator.source === "task_artifact_snapshot"
                ? locator.snapshot.manifest_sha256
                : locator.ref.sha256,
          text: new TextDecoder().decode(bytes.slice(byteStart, byteEnd)),
          attachment: false,
        },
      }
      return mutate ? mutate(result) : result
    },
  }
}
