import {
  ArtifactJSONValueSchema,
  ArtifactReadInputSchema,
  ArtifactSelectInputSchema,
  ArtifactSelectOutputSchema,
  ArtifactSchemaLimits,
  ArtifactSearchInputSchema,
  ArtifactSearchTransportPageSchema,
  EngineArtifactPublishInputSchema,
  type ArtifactReadInput,
  type ArtifactSelectInput,
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
import { tool as aiTool } from "ai"
import { Tool } from "./tool"
import { resolveCoreProjectedWorkerToolExecutionScope } from "./task-tool-execution-scope"
import {
  completeArtifactReadsBeforePublication,
  selectedArtifactLocatorsBeforePublication,
} from "@/agent/artifact-read-facts"

const ARTIFACT_SEARCH_DESCRIPTION =
  "Enumerate the current Task's durable current, historical, or immutable Artifacts. " +
  "Task scope is derived from the current Session. Without query this is the complete existence path. " +
  "Use exact label, kind, type, Goal, and time filters for Core typed facts. Producer filters apply only when an " +
  "entry's producer field carries projected-Agent or Mission provenance; Core projections remain Core-owned even " +
  "when their payload records a source Agent turn. Substring is the default " +
  "discovery mode and fuzzy matching is available only when explicitly requested. Sort can be relevance, newest, " +
  "oldest, or name. A fuzzy candidate is never automatic evidence selection. Stable cursors freeze membership; " +
  "zero matches are valid. Inspect resolution, catalog_complete, provider_errors, and metadata_truncated."

const ARTIFACT_READ_DESCRIPTION =
  "Read one exact current-Task Artifact locator. Engine JSON, snapshot manifests, and text resources return " +
  "explicit UTF-8 byte chunks with total bytes and SHA-256. Binary resources return one verified complete media " +
  "attachment; byte_offset must remain zero and binary data is never split into invalid media fragments. " +
  "For a large text task_artifact_resource, delivery=materialized_file verifies the complete immutable bytes once " +
  "and returns a content-addressed local cache path for bounded command-line inspection without copying the body into model context. " +
  "Missing, foreign-Task, corrupt, wrong-path, and digest-mismatched locators fail explicitly; no locator is substituted."

const ARTIFACT_SELECT_DESCRIPTION =
  "Declare that one exact Artifact is a semantic source for the current consumer output. " +
  "Call only after artifact_read has completely covered this exact locator in the current Session and Turn. " +
  "The Host validates the selection against persisted complete-read facts; a consulted but unselected Artifact remains observation only. " +
  "Zero selections are valid when no Artifact semantically supports the output. Selection does not dispatch, route, accept, retry, or complete work."

const ARTIFACT_PUBLISH_DESCRIPTION =
  "Publish one immutable namespaced JSON expert_output into the current Task Artifact Catalog. " +
  "payload_json is strict JSON text with unique object keys; the Host parses it once and persists only the canonical " +
  "JSON value, never the transport string. " +
  "The Host derives Task, Session, Agent, active Expert Squad, projection, message, and tool-call provenance; " +
  "the model cannot supply or override them. artifact_type must begin with the active Expert Squad ID followed " +
  "by '/'. source_artifact_locators is optional and defaults to [] when the output has no semantic Artifact source. Every supplied source " +
  "must have been completely read earlier in this physical Turn. resource_set is required; pass null when there are no files. A supplied filesystem resource set must be an exact " +
  "current-Task ref and is verified before commit. " +
  "An exact retry of the same Task-scoped publication atomically reuses the canonical publication; changed JSON, resource set, or sources remain distinct. " +
  "Use this for durable inter-Agent evidence; the visible final message remains narrative and is not Artifact transport."

const ARTIFACT_SNAPSHOT_DESCRIPTION =
  "Publish real files from the current Task product repository as one immutable Task Artifact snapshot. " +
  "Supply canonical project-relative paths and normalized media types. The Host validates Task ownership and stable " +
  "regular-file bytes, then atomically publishes or reuses the exact Task-scoped content snapshot and returns one compact resource-set locator. The Host expands that set in canonical UTF-8 byte path order. Pass that locator to artifact_publish " +
  "when a semantic Engine Artifact owns the files. Downstream Agents discover and read locators from the catalog; " +
  "they never scan this worker's mutable directory."

const ArtifactSnapshotToolInputSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            path: ProjectRelativePathSchema.describe(
              "Exact current-Task project-relative source file path using forward slashes.",
            ),
            media_type: TaskArtifactMediaTypeSchema.describe(
              "Normalized media type for the immutable published bytes.",
            ),
          })
          .strict(),
      )
      .min(1)
      .max(ArtifactSchemaLimits.publishResources),
  })
  .strict()
  .superRefine((input, context) => {
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
  })

const ArtifactPublishToolInputSchema = EngineArtifactPublishInputSchema.omit({
  payload: true,
  resources: true,
  idempotent: true,
})
  .extend({
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
  return ArtifactSearchTransportPageSchema.parse({
    entries: page.entries,
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

function resultForRead(result: ArtifactReadResult) {
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
    output: JSON.stringify(result.chunk),
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

function snapshotTransport(
  snapshot: {
    schema_version: 2
    project_id: string
    task_id: string
    snapshot_id: string
    manifest_sha256: string
  },
  resourceCount: number,
) {
  return {
    resource_set: {
      snapshot,
      tree: "resources" as const,
    },
    resource_count: resourceCount,
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
  parameters: ArtifactReadInputSchema,
  async execute(args, ctx) {
    const taskID = taskIDForToolSession(ctx.sessionID, "artifact_read")
    return resultForRead(await readArtifactForTool(taskID, args))
  },
})

function selectArtifactForSession(sessionID: string, assistantMessageID: string, input: ArtifactSelectInput) {
  const selected = ArtifactSelectInputSchema.parse(input)
  const completed = completeArtifactReadsBeforePublication({
    sessionID,
    assistantMessageID,
  })
  const selectedKey = JSON.stringify(selected.locator)
  if (!completed.some((locator) => JSON.stringify(locator) === selectedKey)) {
    throw new Error(`artifact_select: locator was not completely read in Session ${sessionID}: ${selectedKey}`)
  }
  const output = ArtifactSelectOutputSchema.parse(selected)
  return {
    title: `Selected Artifact source (${selected.purpose})`,
    metadata: {
      source: selected.locator.source,
      purpose: selected.purpose,
    },
    output: JSON.stringify(output),
  }
}

export const ArtifactSelectTool = Tool.define("artifact_select", {
  description: ARTIFACT_SELECT_DESCRIPTION,
  parameters: ArtifactSelectInputSchema,
  async execute(args, ctx) {
    taskIDForToolSession(ctx.sessionID, "artifact_select")
    return selectArtifactForSession(ctx.sessionID, ctx.messageID, args)
  },
})

async function resolveArtifactWorkerScope(ctx: Tool.Context, toolName: "artifact_snapshot" | "artifact_publish") {
  if (!ctx.callID) throw new Error(`${toolName}: missing persisted tool call identity`)
  return resolveCoreProjectedWorkerToolExecutionScope({
    options: {
      toolCallId: ctx.callID,
      opencorvus: {
        projectID: ctx.extra?.projectID,
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        toolCallID: ctx.callID,
        toolPartID: ctx.extra?.toolPartID,
        invocationAuthority: ctx.extra?.invocationAuthority,
      },
    },
    toolName,
  })
}

export const ArtifactSnapshotTool = Tool.define("artifact_snapshot", {
  description: ARTIFACT_SNAPSHOT_DESCRIPTION,
  parameters: ArtifactSnapshotToolInputSchema,
  async execute(args, ctx) {
    const scope = await resolveArtifactWorkerScope(ctx, "artifact_snapshot")
    const publication = await publishTaskArtifactProjectFiles({
      scope,
      files: args.files.map((file) => ({
        path: file.path,
        mediaType: file.media_type,
      })),
    })
    const output = JSON.stringify(snapshotTransport(publication.snapshot, publication.artifacts.length))
    return {
      title: `Published Artifact snapshot (${publication.artifacts.length} files)`,
      metadata: {
        truncated: false,
        snapshotID: publication.snapshot.snapshot_id,
        resources: publication.artifacts.length,
      },
      output,
    }
  },
})

export const ArtifactPublishTool = Tool.define("artifact_publish", {
  description: ARTIFACT_PUBLISH_DESCRIPTION,
  parameters: ArtifactPublishToolInputSchema,
  async execute(args, ctx) {
    const scope = await resolveArtifactWorkerScope(ctx, "artifact_publish")
    const { payload_json, resource_set, ...metadata } = args
    const resources = resource_set
      ? await readTaskArtifactResourceSet({
          projectID: scope.projectID,
          projectDirectory: scope.projectDirectory,
          taskID: scope.taskID,
          resourceSet: resource_set,
        })
      : []
    const artifact = EngineArtifactPublishInputSchema.parse({
      ...metadata,
      payload: parseArtifactPublishJSON(payload_json),
      resources,
      idempotent: true,
    })
    const observedArtifactLocators = completeArtifactReadsBeforePublication({
      sessionID: scope.sessionID,
      assistantMessageID: scope.messageID,
    })
    const published = await publishExpertArtifact({
      scope,
      artifact,
      observedArtifactLocators,
      selectedArtifactLocators: selectedArtifactLocatorsBeforePublication({
        sessionID: scope.sessionID,
        assistantMessageID: scope.messageID,
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
    inputSchema: ArtifactReadInputSchema,
    execute: async (args: ArtifactReadInput, options) => {
      const exactTaskID = orchestratorTaskID({ taskID, options, toolName: "artifact_read" })
      return resultForRead(await readArtifactForTool(exactTaskID, args))
    },
  })
}

export function createArtifactSelectAiTool(taskID: string) {
  return aiTool({
    description: ARTIFACT_SELECT_DESCRIPTION,
    inputSchema: ArtifactSelectInputSchema,
    execute: async (args: ArtifactSelectInput, options) => {
      orchestratorTaskID({ taskID, options, toolName: "artifact_select" })
      const meta = (options as { opencorvus?: Record<string, unknown> } | undefined)?.opencorvus
      const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
      const messageID = typeof meta?.messageID === "string" ? meta.messageID : ""
      if (!messageID) throw new Error("artifact_select: missing persisted Orchestrator message identity")
      return selectArtifactForSession(sessionID, messageID, args)
    },
  })
}
