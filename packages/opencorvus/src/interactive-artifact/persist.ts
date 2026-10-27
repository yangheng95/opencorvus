import { Identifier } from "@/id/id"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Instance } from "@/project/instance"
import {
  InteractiveArtifactTable,
  MessageTable,
  SessionTable,
  PartTable,
  ToolPartOutcomeTable,
} from "@/session/session.sql"
import { attachmentNameFromUrl } from "@/storage/attachment-reference"
import { AttachmentStore } from "@/storage/attachment-store"
import { Database, and, eq, sql } from "@/storage/db"
import { NamedError } from "@opencorvus-ai/util/error"
import { createHash } from "node:crypto"
import z from "zod"
import {
  InteractiveArtifactAttachment,
  InteractiveArtifactPayload,
  McpAppToolLifecycle,
  type InteractiveArtifactRecord,
} from "./schema"

export const McpAppLifecycleChanged = BusEvent.define(
  "interactive-artifact.mcp-app.lifecycle.changed",
  z.object({
    sessionID: z.string(),
    artifactID: z.string(),
  }),
)

export const InteractiveArtifactCorruptionError = NamedError.create(
  "InteractiveArtifactCorruptionError",
  z.object({
    message: z.string(),
    artifactID: z.string(),
  }),
)

function attachmentReferences(payload: z.infer<typeof InteractiveArtifactPayload>) {
  const direct =
    payload.renderer === "media@1" || payload.renderer === "file-preview@1" || payload.renderer === "model-3d@1"
      ? InteractiveArtifactAttachment.parse(payload.source)
      : undefined
  const presentation =
    payload.renderer === "presentation@1" ? payload.slides.flatMap((slide) => (slide.image ? [slide.image] : [])) : []
  const notebook =
    payload.renderer === "notebook@1"
      ? payload.cells.flatMap((cell) =>
          cell.kind === "code"
            ? cell.outputs.flatMap((output) => (output.kind === "media" ? [output.source] : []))
            : [],
        )
      : []
  const modelPoster = payload.renderer === "model-3d@1" && payload.poster ? [payload.poster] : []
  return [...(direct ? [direct] : []), ...presentation, ...notebook, ...modelPoster]
}

function gltfUsesOnlyEmbeddedResources(value: unknown): boolean {
  const pending: unknown[] = [value]
  while (pending.length) {
    const current = pending.pop()
    if (!current || typeof current !== "object") continue
    if (Array.isArray(current)) {
      pending.push(...current)
      continue
    }
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (key === "uri" && (typeof child !== "string" || !child.startsWith("data:"))) return false
      pending.push(child)
    }
  }
  return true
}

async function validateEmbeddedGltf(input: { projectID: string; url: string }) {
  const located = AttachmentStore.nameFromUrl(input.url)
  if (!located || located.projectID !== input.projectID) {
    throw new Error(`3D model attachment URL is not canonical: ${input.url}`)
  }
  const bytes = await AttachmentStore.read(located.projectID, located.name)
  let document: unknown
  try {
    document = JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new Error("3D model glTF attachment must contain valid JSON")
  }
  const asset =
    document && typeof document === "object" && !Array.isArray(document)
      ? (document as Record<string, unknown>).asset
      : undefined
  if (
    !asset ||
    typeof asset !== "object" ||
    Array.isArray(asset) ||
    (asset as Record<string, unknown>).version !== "2.0"
  ) {
    throw new Error("3D model glTF attachment must declare asset.version 2.0")
  }
  if (!gltfUsesOnlyEmbeddedResources(document)) {
    throw new Error("3D model glTF attachment resources must be embedded data URIs")
  }
}

export async function publishInteractiveArtifact(input: {
  sessionID: string
  messageID: string
  payload: unknown
}): Promise<InteractiveArtifactRecord> {
  const payload = InteractiveArtifactPayload.parse(input.payload)
  if (
    payload.renderer === "mcp-app@1" &&
    createHash("sha256").update(payload.resource.html).digest("hex") !== payload.resource.sha
  ) {
    throw new Error("MCP App resource snapshot digest does not match the supplied HTML")
  }
  const owner = Database.use((db) =>
    db
      .select({ id: MessageTable.id, projectID: SessionTable.project_id })
      .from(MessageTable)
      .innerJoin(SessionTable, eq(MessageTable.session_id, SessionTable.id))
      .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
      .get(),
  )
  if (!owner) throw new Error(`Interactive artifact owner message not found: ${input.messageID}`)
  await Promise.all(
    attachmentReferences(payload).map(async (reference) => {
      const canonical = await AttachmentStore.requireReference({
        projectID: owner.projectID,
        url: reference.url,
        mime: reference.mime,
      })
      if (canonical.sha !== reference.sha || canonical.size !== reference.size) {
        throw new Error(`attachment payload does not match canonical metadata: ${reference.url}`)
      }
    }),
  )
  if (payload.renderer === "model-3d@1" && payload.source.mime.toLowerCase() === "model/gltf+json") {
    await validateEmbeddedGltf({ projectID: owner.projectID, url: payload.source.url })
  }
  const timeCreated = Date.now()
  const id = Identifier.ascending("artifact")
  Database.use((db) => {
    db.insert(InteractiveArtifactTable)
      .values({
        id,
        message_id: input.messageID,
        payload,
        time_created: timeCreated,
        time_updated: timeCreated,
      })
      .run()
  })
  return {
    id,
    sessionID: input.sessionID,
    messageID: input.messageID,
    payload,
    timeCreated,
    timeUpdated: timeCreated,
  }
}

export function findInteractiveArtifact(input: {
  sessionID: string
  artifactID: string
  projectID: string
}): InteractiveArtifactRecord | undefined {
  const row = Database.use((db) =>
    db
      .select({
        artifact: InteractiveArtifactTable,
        sessionID: MessageTable.session_id,
      })
      .from(InteractiveArtifactTable)
      .innerJoin(MessageTable, eq(InteractiveArtifactTable.message_id, MessageTable.id))
      .innerJoin(SessionTable, eq(MessageTable.session_id, SessionTable.id))
      .where(
        and(
          eq(InteractiveArtifactTable.id, input.artifactID),
          eq(MessageTable.session_id, input.sessionID),
          eq(SessionTable.project_id, input.projectID),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  const parsed = InteractiveArtifactPayload.safeParse(row.artifact.payload)
  if (!parsed.success) {
    throw new InteractiveArtifactCorruptionError({
      message: `Interactive artifact payload is corrupt: ${parsed.error.message}`,
      artifactID: row.artifact.id,
    })
  }
  if (
    parsed.data.renderer === "mcp-app@1" &&
    createHash("sha256").update(parsed.data.resource.html).digest("hex") !== parsed.data.resource.sha
  ) {
    throw new InteractiveArtifactCorruptionError({
      message: "MCP App resource snapshot digest does not match the stored HTML",
      artifactID: row.artifact.id,
    })
  }
  const completed = Database.use((db) =>
    db
      .select({ data: ToolPartOutcomeTable.data })
      .from(PartTable)
      .innerJoin(
        ToolPartOutcomeTable,
        eq(ToolPartOutcomeTable.request_part_id, sql<string>`json_extract(${PartTable.data}, '$.toolPartID')`),
      )
      .where(
        and(
          eq(PartTable.message_id, row.artifact.message_id),
          sql`json_extract(${PartTable.data}, '$.type') = 'interactive-artifact'`,
          sql`json_extract(${PartTable.data}, '$.artifactID') = ${row.artifact.id}`,
        ),
      )
      .all(),
  )
  const downloads = new Map<string, NonNullable<InteractiveArtifactRecord["downloads"]>[number]>()
  for (const { data } of completed) {
    if (data.outcome !== "completed" || data.metadata.sourceSha === undefined) continue
    const sha = data.metadata.sourceSha
    const attachment =
      typeof sha === "string" && /^[a-f0-9]{64}$/.test(sha)
        ? data.attachments?.find((file) => {
            const located = attachmentNameFromUrl(file.url)
            return located?.projectID === input.projectID && located.name.startsWith(`${sha}.`)
          })
        : undefined
    if (!attachment)
      throw new InteractiveArtifactCorruptionError({
        message: "Interactive artifact producing Tool has no attachment matching its declared source identity",
        artifactID: row.artifact.id,
      })
    downloads.set(attachment.url, {
      url: attachment.url,
      mime: attachment.mime,
      ...(attachment.filename ? { filename: attachment.filename } : {}),
    })
  }
  return {
    id: row.artifact.id,
    sessionID: row.sessionID,
    messageID: row.artifact.message_id,
    payload: parsed.data,
    ...(downloads.size ? { downloads: [...downloads.values()] } : {}),
    timeCreated: row.artifact.time_created,
    timeUpdated: row.artifact.time_updated,
  }
}

/** Commit copied snapshots with their new Messages in the caller's atomic fork. */
export function copyMessageInteractiveArtifactsInTransaction(
  db: Database.TxOrDb,
  input: {
    projectID: string
    sourceSessionID: string
    sessionID: string
    messages: readonly { sourceMessageID: string; messageID: string; artifacts: ReadonlyMap<string, string> }[]
  },
): void {
  Database.requireActiveTransaction("copyMessageInteractiveArtifactsInTransaction")
  for (const message of input.messages) {
    if (!message.artifacts.size) continue
    const target = db.select({ id: MessageTable.id }).from(MessageTable)
      .innerJoin(SessionTable, eq(MessageTable.session_id, SessionTable.id))
      .where(and(eq(MessageTable.id, message.messageID), eq(MessageTable.session_id, input.sessionID),
        eq(SessionTable.project_id, input.projectID))).get()
    if (!target) throw new Error(`Copied interactive artifact Message not found: ${message.messageID}`)
    for (const [sourceID, id] of message.artifacts) {
      const source = db.select({ artifact: InteractiveArtifactTable }).from(InteractiveArtifactTable)
        .innerJoin(MessageTable, eq(InteractiveArtifactTable.message_id, MessageTable.id))
        .innerJoin(SessionTable, eq(MessageTable.session_id, SessionTable.id))
        .where(and(eq(InteractiveArtifactTable.id, sourceID), eq(MessageTable.id, message.sourceMessageID),
          eq(MessageTable.session_id, input.sourceSessionID), eq(SessionTable.project_id, input.projectID))).get()
      if (!source) throw new InteractiveArtifactCorruptionError({
        artifactID: sourceID,
        message: `Copied Message ${message.sourceMessageID} has no owned interactive artifact ${sourceID}`,
      })
      db.insert(InteractiveArtifactTable).values({
        ...source.artifact, id, message_id: message.messageID,
      }).run()
    }
  }
}

export function updateMcpAppToolLifecycle(input: {
  sessionID: string
  artifactID: string
  projectID: string
  lifecycle: z.input<typeof McpAppToolLifecycle>
}): InteractiveArtifactRecord {
  const current = findInteractiveArtifact(input)
  if (!current || current.payload.renderer !== "mcp-app@1") {
    throw new Error(`MCP App artifact not found: ${input.artifactID}`)
  }
  const payload = InteractiveArtifactPayload.parse({
    ...current.payload,
    tool: {
      ...current.payload.tool,
      lifecycle: McpAppToolLifecycle.parse(input.lifecycle),
    },
  })
  const timeUpdated = Math.max(Date.now(), current.timeUpdated + 1)
  Database.use((db) =>
    db
      .update(InteractiveArtifactTable)
      .set({ payload, time_updated: timeUpdated })
      .where(eq(InteractiveArtifactTable.id, current.id))
      .run(),
  )
  GlobalBus.emit("event", {
    directory: Instance.directory,
    payload: {
      type: McpAppLifecycleChanged.type,
      properties: {
        sessionID: input.sessionID,
        artifactID: input.artifactID,
      },
    },
  })
  return {
    ...current,
    payload,
    timeUpdated,
  }
}
