import { z } from "zod"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { recordEngineArtifact } from "@/engine/artifact"
import { Identifier } from "@/id/id"
import { Database, and, eq } from "@/storage/db"

export const DesignResourceKindSchema = z.enum([
  "image",
  "pdf",
  "html",
  "css",
  "json",
  "markdown",
  "browser_preview_evidence",
])
export type DesignResourceKind = z.infer<typeof DesignResourceKindSchema>

export const DesignResourceIntentSchema = z.enum([
  "visual_reference",
  "design_source",
  "interaction_reference",
  "design_tokens",
  "implementation_reference",
  "verification_evidence",
])
export type DesignResourceIntent = z.infer<typeof DesignResourceIntentSchema>

export const DesignResourceOriginSchema = z.enum([
  "attachment",
  "material",
  "browser_preview",
  "rendered_design_source",
])
export type DesignResourceOrigin = z.infer<typeof DesignResourceOriginSchema>

export const DesignResourceEntrySchema = z
  .object({
    id: z.string().min(1),
    kind: DesignResourceKindSchema,
    intent: DesignResourceIntentSchema,
    origin: DesignResourceOriginSchema,
    mime: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    canonical_ref: z.string().min(1),
    size: z.number().int().nonnegative(),
    materializer: z.string().min(1),
    related_entries: z.array(z.string().min(1)).default([]),
    artifact_paths: z.array(z.string().min(1)).default([]),
    viewport: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    created_at: z.number().int().nonnegative(),
  })
  .strict()
export type DesignResourceEntry = z.infer<typeof DesignResourceEntrySchema>

export const DesignResourceManifestSchema = z
  .object({
    version: z.literal(1),
    task_id: z.string().min(1),
    created_at: z.number().int().nonnegative(),
    entries: z.array(DesignResourceEntrySchema).min(1),
  })
  .strict()
export type DesignResourceManifest = z.infer<typeof DesignResourceManifestSchema>

export const DesignResourceSourceSchema = z.enum(["user-upload", "material", "browser-preview"])
export type DesignResourceSource = z.infer<typeof DesignResourceSourceSchema>

export type DesignResourceFileRef = {
  sha: string
  url: string
  mime: string
  size: number
  filename?: string
  label?: string
  intent: DesignResourceIntent
  source: DesignResourceSource
}

export type DesignResourceManifestFileRef = Omit<DesignResourceFileRef, "source"> & {
  source: "user-upload" | "material" | "browser-preview" | "frontend-design-renderer" | "design-resource-manifest"
}

const DESIGN_RESOURCE_ORIGIN_BY_SOURCE: Record<DesignResourceSource, DesignResourceOrigin> = {
  "user-upload": "attachment",
  material: "material",
  "browser-preview": "browser_preview",
}

const FRONTEND_DESIGN_MATERIAL_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  log: "text/plain",
  json: "application/json",
  jsonc: "application/json",
  yaml: "text/yaml",
  yml: "text/yaml",
  css: "text/css",
  scss: "text/css",
  less: "text/css",
  html: "text/html",
  htm: "text/html",
}

export function frontendDesignMaterialMime(filename: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase()
  const mime = FRONTEND_DESIGN_MATERIAL_MIME_BY_EXTENSION[ext]
  if (!mime) {
    throw new Error(
      `unsupported frontend_design material extension '${ext ? `.${ext}` : "(none)"}' for ${filename}. ` +
        `Supported design material types: ${Object.keys(FRONTEND_DESIGN_MATERIAL_MIME_BY_EXTENSION)
          .sort()
          .map((item) => `.${item}`)
          .join(", ")}.`,
    )
  }
  return mime
}

function resourceID(input: DesignResourceFileRef, index: number): string {
  const source = input.source.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()
  return `design-resource-${source}-${input.sha.slice(0, 12)}-${index + 1}`
}

function manifestSha(input: DesignResourceFileRef): string {
  const sha = input.sha.trim().toLowerCase()
  if (/^[a-f0-9]{64}$/i.test(sha)) return sha
  throw new Error(`design resource ${input.filename ?? input.url} requires a 64-hex sha`)
}

function inferOrigin(input: DesignResourceFileRef): DesignResourceOrigin {
  return DESIGN_RESOURCE_ORIGIN_BY_SOURCE[input.source]
}

export function inferDesignResourceKind(input: DesignResourceFileRef): DesignResourceKind {
  if (input.source === "browser-preview") return "browser_preview_evidence"
  if (input.mime.startsWith("image/")) return "image"
  if (input.mime === "application/pdf") return "pdf"
  if (input.mime === "text/html") return "html"
  if (input.mime === "text/css") return "css"
  if (input.mime === "application/json") return "json"
  if (input.mime === "text/markdown") return "markdown"
  if (input.mime === "text/plain" || input.mime === "text/yaml") return "markdown"
  throw new Error(
    `unsupported design resource mime '${input.mime}' for ${input.filename ?? input.url}. ` +
      "Materialize it through an explicit design-resource provider before calling frontend_design.",
  )
}

export function createDesignResourceManifest(input: {
  taskID: string
  resources: readonly DesignResourceFileRef[]
  now?: number
}): DesignResourceManifest {
  const createdAt = input.now ?? Date.now()
  const entries = input.resources.map((resource, index): DesignResourceEntry => {
    const source = DesignResourceSourceSchema.safeParse(resource.source)
    if (!source.success) {
      throw new Error(
        `unsupported design resource source '${String(resource.source)}' for ${resource.filename ?? resource.url}`,
      )
    }
    const normalizedResource = { ...resource, source: source.data }
    const kind = inferDesignResourceKind(normalizedResource)
    const intent = DesignResourceIntentSchema.safeParse(resource.intent)
    if (!intent.success) {
      throw new Error(
        `unsupported design resource intent '${String(resource.intent)}' for ${resource.filename ?? resource.url}`,
      )
    }
    return {
      id: resourceID(normalizedResource, index),
      kind,
      intent: intent.data,
      origin: inferOrigin(normalizedResource),
      mime: resource.mime,
      sha256: manifestSha(resource),
      canonical_ref: resource.url,
      size: resource.size,
      materializer: source.data,
      related_entries: [],
      artifact_paths: [],
      created_at: createdAt,
      ...(resource.filename ? { region: resource.filename } : {}),
    }
  })
  return DesignResourceManifestSchema.parse({
    version: 1,
    task_id: input.taskID,
    created_at: createdAt,
    entries,
  })
}

function fileRefSource(origin: DesignResourceOrigin): DesignResourceManifestFileRef["source"] {
  if (origin === "browser_preview") return "browser-preview"
  if (origin === "rendered_design_source") return "frontend-design-renderer"
  if (origin === "material") return "material"
  return "design-resource-manifest"
}

export function designResourceManifestFileRefs(manifest: DesignResourceManifest): DesignResourceManifestFileRef[] {
  return manifest.entries.map((entry) => ({
    sha: entry.sha256,
    url: entry.canonical_ref,
    mime: entry.mime,
    size: entry.size,
    ...(entry.region ? { label: entry.region } : {}),
    intent: entry.intent,
    source: fileRefSource(entry.origin),
  }))
}

export function recordDesignResourceManifest(input: {
  taskID: string
  manifest: DesignResourceManifest
  now?: number
}): string {
  const now = input.now ?? Date.now()
  const id = Identifier.ascending("artifact")
  recordEngineArtifact({
    id,
    taskID: input.taskID,
    kind: "design_resource_manifest",
    label: "frontend_design-resource-manifest",
    payload: input.manifest as unknown as Record<string, unknown>,
    timeCreated: now,
  })
  return id
}

export type DesignResourceManifestArtifact = {
  id: string
  manifest: DesignResourceManifest
}

export function listDesignResourceManifests(taskID: string): DesignResourceManifestArtifact[] {
  const rows = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "design_resource_manifest")))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  return rows.map((row) => {
    const parsed = DesignResourceManifestSchema.safeParse(row.payload)
    if (!parsed.success) {
      throw new Error(`design_resource_manifest artifact ${row.id} is malformed: ${parsed.error.message}`)
    }
    if (parsed.data.task_id !== taskID) {
      throw new Error(
        `design_resource_manifest artifact ${row.id} belongs to task ${parsed.data.task_id}, expected ${taskID}`,
      )
    }
    return { id: row.id, manifest: parsed.data }
  })
}

export function findDesignResourceManifestByID(input: {
  taskID: string
  artifactID: string
}): DesignResourceManifestArtifact | undefined {
  const row = Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.kind, "design_resource_manifest"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  const parsed = DesignResourceManifestSchema.safeParse(row.payload)
  if (!parsed.success) {
    throw new Error(`design_resource_manifest artifact ${row.id} is malformed: ${parsed.error.message}`)
  }
  if (parsed.data.task_id !== input.taskID) {
    throw new Error(
      `design_resource_manifest artifact ${row.id} belongs to task ${parsed.data.task_id}, expected ${input.taskID}`,
    )
  }
  return { id: row.id, manifest: parsed.data }
}
