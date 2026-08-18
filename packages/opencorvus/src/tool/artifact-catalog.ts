import { PACKAGE_OWNED_ARTIFACT_TYPE_NAMESPACES } from "@opencorvus-ai/plugin"
import {
  ArtifactJSONValueSchema,
  ArtifactReadInputSchema,
  ArtifactReadReferenceInputSchema,
  ArtifactSelectReferenceInputSchema,
  ArtifactSelectReferenceOutputSchema,
  ArtifactSelectOutputSchema,
  ArtifactSchemaLimits,
  ArtifactSearchInputSchema,
  ArtifactSearchReferenceTransportPageSchema,
  EngineArtifactPublishInputSchema,
  mintArtifactLocatorReference,
  mintArtifactReadReference,
  mintArtifactSelectionReference,
  type ArtifactReadInput,
  type ArtifactReadReferenceInput,
  type ArtifactSelectReferenceInput,
  type ArtifactSearchInput,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { ProjectRelativePathSchema } from "@opencorvus-ai/plugin/project-path"
import { TaskArtifactMediaTypeSchema, TaskArtifactResourceSetLocatorSchema } from "@opencorvus-ai/plugin/task-artifact"
import { Buffer } from "node:buffer"
import { parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser"
import z from "zod"
import {
  artifactCatalogAuthority,
  readTaskArtifact,
  searchTaskArtifacts,
  publishExpertArtifact,
  type ArtifactReadResult,
} from "@/artifact-catalog"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { publishTaskArtifactProjectFiles, readTaskArtifactResourceSet } from "@/task-artifact/store"
import { resolveArtifactSnapshotReadAuthority } from "@/build/merge-back-publication-authority"
import { tool as aiTool } from "ai"
import { Tool } from "./tool"
import {
  resolveCoreProjectedTaskToolExecutionScope,
  resolveCoreProjectedWorkerToolExecutionScope,
  type TaskToolExecutionScope,
} from "./task-tool-execution-scope"
import {
  completeArtifactReadsBeforePublication,
  resolveArtifactLocatorReferenceBeforeRead,
  resolveArtifactReadReferenceBeforeSelection,
  resolveArtifactSelectionReferencesBeforePublication,
  selectedArtifactLocatorsBeforePublication,
} from "@/agent/artifact-read-facts"

const ARTIFACT_SEARCH_DESCRIPTION =
  "Enumerate the current Task's durable current, historical, or immutable Artifacts. " +
  "Task scope is derived from the current Session. Without query this is the complete existence path. " +
  "Use exact label, kind, type, Goal, and time filters for Core typed facts. Producer filters apply only when an " +
  "entry's producer field carries projected-Agent or Mission provenance; Core projections remain Core-owned even " +
  "when their payload records a source Agent turn. Substring is the default " +
  "discovery mode and fuzzy matching is available only when explicitly requested. Sort can be relevance, newest, " +
  "oldest, or name. Task Artifact snapshots are accompanied by independently pageable task_artifact_resource entries; " +
  "pass each returned artifact_locator_ref to artifact_read. A fuzzy candidate is never automatic evidence selection. Stable cursors freeze membership; " +
  "zero matches are valid. Inspect resolution, catalog_complete, provider_errors, and metadata_truncated."

const ARTIFACT_READ_DESCRIPTION =
  "Read one exact current-Task Artifact through an artifact_locator_ref returned by artifact_search or artifact_snapshot. Engine JSON, snapshot manifests, and text resources return " +
  "explicit UTF-8 byte chunks with total bytes and SHA-256. Binary resources return one verified complete media " +
  "attachment; byte_offset must remain zero and binary data is never split into invalid media fragments. " +
  "For a large text task_artifact_resource, delivery=materialized_file verifies the complete immutable bytes once " +
  "and returns a content-addressed local cache path for bounded command-line inspection without copying the body into model context. " +
  "Missing, foreign-Task, corrupt, wrong-path, and digest-mismatched references fail explicitly; no locator is inferred or substituted."

const ARTIFACT_SELECT_DESCRIPTION =
  "Declare that one exact Artifact is a semantic source for the current consumer output using artifact_read_ref. " +
  "Call only after artifact_read has completely covered this exact locator in the current Session and Turn. " +
  "The Host validates the selection against persisted complete-read facts; a consulted but unselected Artifact remains observation only. " +
  "Zero selections are valid when no Artifact semantically supports the output. Selection does not dispatch, route, accept, retry, or complete work."

const ARTIFACT_PUBLISH_DESCRIPTION =
  "Publish one immutable namespaced JSON expert_output into the current Task Artifact Catalog. " +
  "payload_json is strict JSON text with unique object keys; the Host parses it once and persists only the canonical " +
  "JSON value, never the transport string. " +
  "The Host derives Task, Session, Agent, active Expert Squad, projection, message, and tool-call provenance; " +
  "the model cannot supply or override them. artifact_type must begin with the active Expert Squad ID followed " +
  "by '/'. Package-owned strict ABI namespaces such as evolution-lab/ must use their package-owned typed publisher " +
  "and are rejected here. source_selection_refs is optional and defaults to [] when the output has no semantic Artifact source. Every supplied selection " +
  "must have been completely read earlier in this physical Turn. resource_set is required; pass null when there are no files. A supplied filesystem resource set must be an exact " +
  "current-Task ref and is verified before commit. " +
  "An exact retry of the same Task-scoped publication atomically reuses the canonical publication; changed JSON, resource set, or sources remain distinct. " +
  "Use this for durable inter-Agent evidence; the visible final message remains narrative and is not Artifact transport."

export class ArtifactPublisherAuthorityError extends Error {
  readonly code = "PACKAGE_TYPED_PUBLISHER_REQUIRED"

  constructor(readonly artifactType: string) {
    super(`artifact_publish cannot publish package-owned strict ABI type ${artifactType}; use its typed publisher`)
    this.name = "ArtifactPublisherAuthorityError"
  }
}

export function assertGenericArtifactPublisherAuthority(artifactType: string) {
  // Asked of the ABI that declares those types, not spelled out here: the Host
  // used to hardcode one plugin's namespace to arbitrate ownership of it.
  if (PACKAGE_OWNED_ARTIFACT_TYPE_NAMESPACES.some((namespace) => artifactType.startsWith(namespace))) {
    throw new ArtifactPublisherAuthorityError(artifactType)
  }
}

const CURRENT_PROJECT_ARTIFACT_SNAPSHOT_DESCRIPTION =
  "Publish real files from the canonical current Task primary project as one immutable Task Artifact snapshot. " +
  "This tool never reads a projected worker's mutable managed worktree and does not claim Build merge authority. " +
  "Supply canonical project-relative paths and normalized media types. The Host validates Task ownership and stable " +
  "regular-file bytes, then atomically publishes or reuses the exact Task-scoped content snapshot. The result returns the resource_set for publication plus artifact_locator_ref values for exact snapshot/resource reads; never reconstruct opaque IDs or digests. The Host expands the set in canonical UTF-8 byte path order. Pass resource_set to artifact_publish " +
  "when a semantic Engine Artifact owns the files. Downstream Agents discover and read locators from the catalog; " +
  "they never scan this worker's mutable directory."

const MANAGED_BUILD_ARTIFACT_SNAPSHOT_DESCRIPTION =
  "Publish real files from the exact immutable primary commit returned by this managed Build worker's completed merge_back. " +
  "Commit the managed worktree, call merge_back, and pass that result's exact primary_head as source_commit. The Host binds it to the latest completed merge_back and reads immutable Git commit bytes even if the primary worktree advances. " +
  "Supply canonical project-relative paths and normalized media types. The result returns Host-minted artifact_locator_ref values for exact reads."

const ArtifactSnapshotFilesSchema = z
  .array(
    z
      .object({
        path: ProjectRelativePathSchema.describe(
          "Exact current-Task project-relative source file path using forward slashes.",
        ),
        media_type: TaskArtifactMediaTypeSchema.describe("Normalized media type for the immutable published bytes."),
      })
      .strict(),
  )
  .min(1)
  .max(ArtifactSchemaLimits.publishResources)

function refineArtifactSnapshotFiles(
  input: { files: z.infer<typeof ArtifactSnapshotFilesSchema> },
  context: z.RefinementCtx,
) {
  const seen = new Map<string, string>()
  for (const [index, file] of input.files.entries()) {
    const folded = file.path.toLowerCase()
    const prior = seen.get(folded)
    if (prior) {
      context.addIssue({
        code: "custom",
        path: ["files", index, "path"],
        message:
          prior === file.path
            ? "artifact_snapshot file paths must be unique"
            : `artifact_snapshot file path case-collides with ${prior}`,
      })
    }
    seen.set(folded, file.path)
  }
}

const CurrentProjectArtifactSnapshotToolInputSchema = z
  .object({
    files: ArtifactSnapshotFilesSchema,
  })
  .strict()
  .superRefine(refineArtifactSnapshotFiles)

const ManagedBuildArtifactSnapshotToolInputSchema = z
  .object({
    source_commit: z
      .string()
      .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/)
      .describe("Exact immutable Git commit returned as primary_head by this worker's latest completed merge_back."),
    files: ArtifactSnapshotFilesSchema,
  })
  .strict()
  .superRefine(refineArtifactSnapshotFiles)

type ArtifactSnapshotToolInput =
  | z.infer<typeof CurrentProjectArtifactSnapshotToolInputSchema>
  | z.infer<typeof ManagedBuildArtifactSnapshotToolInputSchema>

const ArtifactPublishToolInputSchema = EngineArtifactPublishInputSchema.omit({
  payload: true,
  resources: true,
  source_artifact_locators: true,
  idempotent: true,
})
  .extend({
    source_selection_refs: z
      .array(ArtifactSelectReferenceOutputSchema.shape.artifact_selection_ref)
      .max(ArtifactSchemaLimits.publishResources)
      .default([])
      .describe("Explicit semantic sources returned by prior artifact_select calls in this Session Turn."),
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable().describe(
      "Exact current-Task immutable resource set, expanded by the Host in canonical UTF-8 byte path order; use null when the Artifact has no files.",
    ),
    payload_json: z
      .string()
      .min(1)
      .describe(
        "Strict JSON text containing the complete expert evidence payload. Object keys must be unique. Optional object fields are omitted; do not encode JavaScript undefined.",
      ),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>()
    for (const [index, reference] of value.source_selection_refs.entries()) {
      if (seen.has(reference)) {
        context.addIssue({
          code: "custom",
          path: ["source_selection_refs", index],
          message: "source_selection_refs must contain unique persisted selections",
        })
      }
      seen.add(reference)
    }
  })

function assertUniqueArtifactJSONKeys(node: Node, path = "$"): void {
  if (node.type === "object") {
    const keys = new Set<string>()
    for (const property of node.children ?? []) {
      const keyNode = property.children?.[0]
      const valueNode = property.children?.[1]
      if (
        property.type !== "property" ||
        keyNode?.type !== "string" ||
        typeof keyNode.value !== "string" ||
        !valueNode
      ) {
        throw new Error(`artifact_publish payload_json has an invalid object property at ${path}`)
      }
      if (keys.has(keyNode.value)) {
        throw new Error(`artifact_publish payload_json repeats object key ${JSON.stringify(keyNode.value)} at ${path}`)
      }
      keys.add(keyNode.value)
      assertUniqueArtifactJSONKeys(valueNode, `${path}[${JSON.stringify(keyNode.value)}]`)
    }
    return
  }
  if (node.type === "array") {
    for (const [index, item] of (node.children ?? []).entries()) {
      assertUniqueArtifactJSONKeys(item, `${path}[${index}]`)
    }
  }
}

function parseArtifactPublishJSON(text: string) {
  const errors: ParseError[] = []
  const tree = parseTree(text, errors, {
    allowTrailingComma: false,
    disallowComments: true,
  })
  if (!tree || errors.length > 0) {
    const detail =
      errors.length > 0
        ? errors.map((error) => `${printParseErrorCode(error.error)} at byte ${error.offset}`).join("; ")
        : "empty JSON document"
    throw new Error(`artifact_publish payload_json is invalid: ${detail}`)
  }
  assertUniqueArtifactJSONKeys(tree)
  return ArtifactJSONValueSchema.parse(JSON.parse(text))
}

function taskIDForToolSession(sessionID: string, toolName: string): string {
  const taskID = taskIDForSession(sessionID)
  if (!taskID) throw new Error(`${toolName}: Session ${sessionID} does not belong to a Task`)
  return taskID
}

function transportSearchPage(page: Awaited<ReturnType<typeof searchTaskArtifacts>>) {
  return ArtifactSearchReferenceTransportPageSchema.parse({
    entries: page.entries.map((entry) => ({
      ...entry,
      artifact_locator_ref: mintArtifactLocatorReference(),
    })),
    next_cursor: page.next_cursor,
    catalog_total: page.catalog_total,
    filtered_total: page.filtered_total,
    catalog_complete: page.catalog_complete,
    metadata_truncated: page.metadata_truncated,
    provider_errors: page.provider_errors,
    resolution: page.resolution,
  })
}

async function boundedSearchResult(input: { taskID: string; search: ArtifactSearchInput }) {
  let limit = input.search.limit
  for (;;) {
    const page = await searchTaskArtifacts({
      authority: artifactCatalogAuthority(input.taskID),
      search: {
        ...input.search,
        limit,
      },
    })
    const transportPage = transportSearchPage(page)
    const output = JSON.stringify(transportPage)
    if (Buffer.byteLength(output, "utf8") <= ArtifactSchemaLimits.structuredOutputBytes) {
      return resultForSearch(transportPage, output)
    }
    if (limit === 1) {
      throw new Error(
        `artifact_search cannot encode one catalog page within the ${ArtifactSchemaLimits.structuredOutputBytes}-byte transport boundary`,
      )
    }
    limit = Math.max(1, Math.floor(limit / 2))
  }
}

function resultForSearch(page: ReturnType<typeof transportSearchPage>, output: string) {
  return {
    title: `Artifact catalog (${page.entries.length}/${page.filtered_total})`,
    metadata: {
      truncated: false,
      catalogMetadataTruncated: page.metadata_truncated,
      catalogTotal: page.catalog_total,
      filteredTotal: page.filtered_total,
      hasMore: page.next_cursor !== null,
      catalogComplete: page.catalog_complete,
      providerErrors: page.provider_errors.length,
    },
    output,
  }
}

function resultForRead(result: ArtifactReadResult, artifactLocatorRef: string) {
  const transportChunk = {
    ...result.chunk,
    artifact_transport_version: 2 as const,
    artifact_locator_ref: artifactLocatorRef,
    artifact_read_ref: mintArtifactReadReference(),
  }
  return {
    title:
      result.chunk.locator.source === "engine_artifact"
        ? `Artifact ${result.chunk.locator.artifact_id}`
        : result.chunk.locator.source === "task_artifact_snapshot"
          ? `Artifact snapshot ${result.chunk.locator.snapshot.snapshot_id}`
          : `Artifact resource ${result.chunk.locator.ref.path}`,
    metadata: {
      truncated: !result.chunk.complete,
      complete: result.chunk.complete,
      byteStart: result.chunk.byte_start,
      byteEnd: result.chunk.byte_end,
      totalBytes: result.chunk.total_bytes,
      sha256: result.chunk.sha256,
    },
    output: JSON.stringify(transportChunk),
    ...(result.attachment
      ? {
          attachments: [
            {
              type: "file" as const,
              mime: result.chunk.media_type,
              filename: result.attachment.filename,
              url: `data:${result.chunk.media_type};base64,${Buffer.from(result.attachment.bytes).toString("base64")}`,
            },
          ],
        }
      : {}),
  }
}

async function readArtifactForTool(taskID: string, input: ArtifactReadInput) {
  return readTaskArtifact({
    authority: artifactCatalogAuthority(taskID),
    read: input,
  })
}

function resolveArtifactReadInput(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  transport: ArtifactReadReferenceInput
}): ArtifactReadInput {
  const locator = resolveArtifactLocatorReferenceBeforeRead({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolPartID: input.toolPartID,
    reference: input.transport.artifact_locator_ref,
  })
  return ArtifactReadInputSchema.parse({
    locator,
    byte_offset: input.transport.byte_offset,
    max_bytes: input.transport.max_bytes,
    delivery: input.transport.delivery,
  })
}

export function artifactSnapshotTransport(
  snapshot: {
    schema_version: 2
    project_id: string
    task_id: string
    snapshot_id: string
    manifest_sha256: string
  },
  resources: readonly {
    snapshot: {
      schema_version: 2
      project_id: string
      task_id: string
      snapshot_id: string
      manifest_sha256: string
    }
    tree: string
    path: string
    media_type: string
    bytes: number
    sha256: string
  }[],
) {
  const snapshotLocator = {
    source: "task_artifact_snapshot" as const,
    snapshot,
  }
  const resourceLocators = resources.map((ref) => ({
    source: "task_artifact_resource" as const,
    ref,
  }))
  return {
    resource_set: {
      snapshot,
      tree: "resources" as const,
    },
    locators: [
      {
        role: "snapshot" as const,
        locator: snapshotLocator,
        artifact_locator_ref: mintArtifactLocatorReference(),
      },
      ...resourceLocators.map((locator) => ({
        role: "resource" as const,
        locator,
        artifact_locator_ref: mintArtifactLocatorReference(),
      })),
    ],
    resource_count: resources.length,
  }
}

export const ArtifactSearchTool = Tool.define("artifact_search", {
  description: ARTIFACT_SEARCH_DESCRIPTION,
  parameters: ArtifactSearchInputSchema,
  async execute(args, ctx) {
    const taskID = taskIDForToolSession(ctx.sessionID, "artifact_search")
    return boundedSearchResult({ taskID, search: args })
  },
})

export const ArtifactReadTool = Tool.define("artifact_read", {
  description: ARTIFACT_READ_DESCRIPTION,
  parameters: ArtifactReadReferenceInputSchema,
  async execute(args, ctx) {
    const taskID = taskIDForToolSession(ctx.sessionID, "artifact_read")
    const read = resolveArtifactReadInput({
      sessionID: ctx.sessionID,
      assistantMessageID: ctx.messageID,
      toolPartID: requireArtifactToolPartID(ctx.extra?.toolPartID, "artifact_read"),
      transport: args,
    })
    return resultForRead(await readArtifactForTool(taskID, read), args.artifact_locator_ref)
  },
})

function selectArtifactForSession(
  sessionID: string,
  assistantMessageID: string,
  toolPartID: string,
  input: ArtifactSelectReferenceInput,
) {
  const selected = ArtifactSelectReferenceInputSchema.parse(input)
  const locator = resolveArtifactReadReferenceBeforeSelection({
    sessionID,
    assistantMessageID,
    toolPartID,
    reference: selected.artifact_read_ref,
  })
  const selection = ArtifactSelectOutputSchema.parse({ locator, purpose: selected.purpose })
  const output = ArtifactSelectReferenceOutputSchema.parse({
    artifact_transport_version: 2,
    selection,
    artifact_selection_ref: mintArtifactSelectionReference(),
  })
  return {
    title: `Selected Artifact source (${selected.purpose})`,
    metadata: {
      source: locator.source,
      purpose: selected.purpose,
    },
    output: JSON.stringify(output),
  }
}

export const ArtifactSelectTool = Tool.define("artifact_select", {
  description: ARTIFACT_SELECT_DESCRIPTION,
  parameters: ArtifactSelectReferenceInputSchema,
  async execute(args, ctx) {
    taskIDForToolSession(ctx.sessionID, "artifact_select")
    return selectArtifactForSession(
      ctx.sessionID,
      ctx.messageID,
      requireArtifactToolPartID(ctx.extra?.toolPartID, "artifact_select"),
      args,
    )
  },
})

function artifactExecutionOptions(ctx: Tool.Context, toolName: "artifact_snapshot" | "artifact_publish") {
  if (!ctx.callID) throw new Error(`${toolName}: missing persisted tool call identity`)
  return {
    toolCallId: ctx.callID,
    opencorvus: {
      projectID: ctx.extra?.projectID,
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      toolCallID: ctx.callID,
      toolPartID: ctx.extra?.toolPartID,
      invocationAuthority: ctx.extra?.invocationAuthority,
    },
  }
}

async function resolveArtifactSnapshotScope(ctx: Tool.Context) {
  return resolveCoreProjectedTaskToolExecutionScope({
    options: artifactExecutionOptions(ctx, "artifact_snapshot"),
    toolName: "artifact_snapshot",
  })
}

async function resolveArtifactWorkerScope(ctx: Tool.Context) {
  return resolveCoreProjectedWorkerToolExecutionScope({
    options: artifactExecutionOptions(ctx, "artifact_publish"),
    toolName: "artifact_publish",
  })
}

export const ArtifactSnapshotTool = Tool.define<z.ZodType<ArtifactSnapshotToolInput>, {}>(
  "artifact_snapshot",
  async (initCtx) => {
    const managedBuild = initCtx?.artifactSnapshotSource === "merged_primary_commit"
    return {
      description: managedBuild
        ? MANAGED_BUILD_ARTIFACT_SNAPSHOT_DESCRIPTION
        : CURRENT_PROJECT_ARTIFACT_SNAPSHOT_DESCRIPTION,
      parameters: managedBuild
        ? ManagedBuildArtifactSnapshotToolInputSchema
        : CurrentProjectArtifactSnapshotToolInputSchema,
      async execute(args, ctx) {
        return executeArtifactSnapshot(args, await resolveArtifactSnapshotScope(ctx))
      },
    }
  },
)

async function executeArtifactSnapshot(args: ArtifactSnapshotToolInput, scope: TaskToolExecutionScope) {
  const source = await resolveArtifactSnapshotReadAuthority({
    scope,
    ...("source_commit" in args ? { claimedSourceCommit: args.source_commit } : {}),
  })
  const publication = await publishTaskArtifactProjectFiles({
    scope,
    source,
    files: args.files.map((file) => ({
      path: file.path,
      mediaType: file.media_type,
    })),
  })
  const output = JSON.stringify(artifactSnapshotTransport(publication.snapshot, publication.artifacts))
  return {
    title: `Published Artifact snapshot (${publication.artifacts.length} files)`,
    metadata: {
      truncated: false,
      snapshotID: publication.snapshot.snapshot_id,
      resources: publication.artifacts.length,
    },
    output,
  }
}

export const ArtifactPublishTool = Tool.define("artifact_publish", {
  description: ARTIFACT_PUBLISH_DESCRIPTION,
  parameters: ArtifactPublishToolInputSchema,
  async execute(args, ctx) {
    assertGenericArtifactPublisherAuthority(args.artifact_type)
    const scope = await resolveArtifactWorkerScope(ctx)
    const { payload_json, resource_set, source_selection_refs, ...metadata } = args
    const resources = resource_set
      ? await readTaskArtifactResourceSet({
          projectID: scope.projectID,
          projectDirectory: scope.projectDirectory,
          taskID: scope.taskID,
          resourceSet: resource_set,
        })
      : []
    const sourceArtifactLocators = resolveArtifactSelectionReferencesBeforePublication({
      sessionID: scope.sessionID,
      assistantMessageID: scope.messageID,
      toolPartID: scope.toolPartID,
      references: source_selection_refs,
    })
    const artifact = EngineArtifactPublishInputSchema.parse({
      ...metadata,
      payload: parseArtifactPublishJSON(payload_json),
      resources,
      source_artifact_locators: sourceArtifactLocators,
      idempotent: true,
    })
    const observedArtifactLocators = completeArtifactReadsBeforePublication({
      sessionID: scope.sessionID,
      assistantMessageID: scope.messageID,
      toolPartID: scope.toolPartID,
    })
    const published = await publishExpertArtifact({
      scope,
      artifact,
      observedArtifactLocators,
      selectedArtifactLocators: selectedArtifactLocatorsBeforePublication({
        sessionID: scope.sessionID,
        assistantMessageID: scope.messageID,
        toolPartID: scope.toolPartID,
      }),
    })
    return {
      title: `Published ${args.artifact_type}`,
      metadata: {
        artifactType: args.artifact_type,
        sha256: published.sha256,
      },
      output: JSON.stringify(published),
    }
  },
})

function orchestratorTaskID(input: { taskID: string; options: unknown; toolName: string }): string {
  const meta = (input.options as { opencorvus?: Record<string, unknown> } | undefined)?.opencorvus
  const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
  if (!sessionID) throw new Error(`${input.toolName}: missing persisted Orchestrator Session identity`)
  const sessionTaskID = taskIDForToolSession(sessionID, input.toolName)
  if (sessionTaskID !== input.taskID) {
    throw new Error(`${input.toolName}: Orchestrator Session belongs to another Task`)
  }
  return sessionTaskID
}

function orchestratorSessionIdentity(options: unknown, toolName: string) {
  const meta = (options as { opencorvus?: Record<string, unknown> } | undefined)?.opencorvus
  const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
  const messageID = typeof meta?.messageID === "string" ? meta.messageID : ""
  const toolPartID = typeof meta?.toolPartID === "string" ? meta.toolPartID : ""
  if (!sessionID || !messageID || !toolPartID) {
    throw new Error(`${toolName}: missing persisted Orchestrator Session, message, or Tool Part identity`)
  }
  return { sessionID, messageID, toolPartID }
}

function requireArtifactToolPartID(value: unknown, toolName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${toolName}: missing persisted Tool Part identity`)
  }
  return value
}

export function createArtifactSearchAiTool(taskID: string) {
  return aiTool({
    description: ARTIFACT_SEARCH_DESCRIPTION,
    inputSchema: ArtifactSearchInputSchema,
    execute: async (args: ArtifactSearchInput, options) => {
      const exactTaskID = orchestratorTaskID({ taskID, options, toolName: "artifact_search" })
      return boundedSearchResult({ taskID: exactTaskID, search: args })
    },
  })
}

export function createArtifactReadAiTool(taskID: string) {
  return aiTool({
    description: ARTIFACT_READ_DESCRIPTION,
    inputSchema: ArtifactReadReferenceInputSchema,
    execute: async (args: ArtifactReadReferenceInput, options) => {
      const exactTaskID = orchestratorTaskID({ taskID, options, toolName: "artifact_read" })
      const identity = orchestratorSessionIdentity(options, "artifact_read")
      const read = resolveArtifactReadInput({
        sessionID: identity.sessionID,
        assistantMessageID: identity.messageID,
        toolPartID: identity.toolPartID,
        transport: args,
      })
      return resultForRead(await readArtifactForTool(exactTaskID, read), args.artifact_locator_ref)
    },
  })
}

export function createArtifactSelectAiTool(taskID: string) {
  return aiTool({
    description: ARTIFACT_SELECT_DESCRIPTION,
    inputSchema: ArtifactSelectReferenceInputSchema,
    execute: async (args: ArtifactSelectReferenceInput, options) => {
      orchestratorTaskID({ taskID, options, toolName: "artifact_select" })
      const identity = orchestratorSessionIdentity(options, "artifact_select")
      return selectArtifactForSession(identity.sessionID, identity.messageID, identity.toolPartID, args)
    },
  })
}

export function createArtifactSnapshotAiTool(taskID: string) {
  return aiTool({
    description: CURRENT_PROJECT_ARTIFACT_SNAPSHOT_DESCRIPTION,
    inputSchema: CurrentProjectArtifactSnapshotToolInputSchema,
    execute: async (args: z.infer<typeof CurrentProjectArtifactSnapshotToolInputSchema>, options) => {
      const scope = await resolveCoreProjectedTaskToolExecutionScope({
        options,
        toolName: "artifact_snapshot",
      })
      if (scope.taskID !== taskID) {
        throw new Error("artifact_snapshot: Orchestrator Session belongs to another Task")
      }
      return executeArtifactSnapshot(args, scope)
    },
  })
}
