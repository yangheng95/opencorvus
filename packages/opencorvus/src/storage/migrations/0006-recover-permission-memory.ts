import type { Database as SQLite } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { and, eq, or, sql } from "drizzle-orm"
import { isDeepStrictEqual } from "node:util"
import fs from "node:fs"
import path from "node:path"
import { Filesystem } from "@/util/filesystem"
import { Identifier } from "@/id/id"
import { ApplicationSchema } from "../schema"
import { SchemaMigrationError, type SchemaMigrationContext } from "../schema-migration"
import {
  ProjectDeletionIdentity,
  CompletedNumericReceipt,
  PROJECT_DELETION_CLEANUP_FORMAT,
} from "@/project/deletion-cleanup-identity"
import { BusPublicationOutboxTable, BusPublicationDeliveryReceiptTable } from "@/bus/bus.sql"
import { readPermissionRequestFacts } from "@/permission/ledger-facts"
import { InteractionUserInput } from "@/memory/interaction-user-input"
import {
  Entry,
  fileID,
  chunkID,
  assertFileOwnership,
  assertChunkOwnership,
  insertEntry,
  sanitizeText,
  sanitizeJSON,
  safeMetadata,
} from "@/memory/project-memory-entry"
import { MemoryFileTable, MemoryChunkTable } from "@/memory/memory.sql"
import { EngineTaskTable, EngineInteractionRequestTable } from "@/engine/engine.sql"
import { SessionTable } from "@/session/session.sql"
import { ProjectTable } from "@/project/project.sql"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { permissionInteractionRequest } from "@/permission/interaction-projection"

const subscriber = "engine.interaction.permission-replied"

function projectRetirement(sqlite: SQLite, databasePath: string, projectID: string, directory: string): boolean {
  const statement = sqlite.query<{ instance_id: string }, []>(
    "SELECT instance_id FROM database_authority WHERE key='primary'",
  )
  const authority = statement.get()?.instance_id
  statement.finalize()
  if (!authority) return false
  const root = path.join(path.dirname(databasePath), "maintenance", "project-deletion-cleanup")
  // Active first, completed second: a concurrent durable rename retains its
  // original identity in one of these two canonical locations.
  for (const state of ["active", "completed"] as const) {
    const folder = state === "active" ? path.join(root, state) : path.join(root, state, authority)
    let names: string[]
    try {
      names = fs.readdirSync(folder)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
      throw error
    }
    for (const name of names.filter((name) => name.endsWith(".json"))) {
      let value: Record<string, unknown>
      try {
        value = JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
        throw error
      }
      if (value.projectID !== projectID) continue
      const identity = ProjectDeletionIdentity.parse(value)
      if (identity.databaseInstanceID !== authority || name !== `${identity.operationID}.json`) continue
      if (
        value.format !== PROJECT_DELETION_CLEANUP_FORMAT &&
        !(state === "completed" && CompletedNumericReceipt.safeParse(value).success)
      )
        continue
      const registered = value.registeredDirectories
      if (
        Array.isArray(registered) &&
        registered.some((item) => item && typeof item.path === "string" && Filesystem.contains(item.path, directory))
      )
        return true
    }
  }
  return false
}

function invalid(occurrenceID: string, detail: string): never {
  throw new SchemaMigrationError(
    "SCHEMA_MIGRATION_REQUIRED",
    `Permission memory recovery ${occurrenceID}: ${detail}. Original records and the migration backup are retained.`,
  )
}

/** Complete this recovery now; never infer whether a lost old receipt committed.
 * Original success remains the sole delivery authority. All other original rows,
 * including attempts, leases, payloads and documents, remain unchanged. */
export function recoverHistoricalPermissionMemory(sqlite: SQLite, context: SchemaMigrationContext): void {
  const db = drizzle({ client: sqlite, schema: ApplicationSchema })
  const publications = db
    .select()
    .from(BusPublicationOutboxTable)
    .where(eq(BusPublicationOutboxTable.event_type, "permission.replied"))
    .all()
  for (const publication of publications) {
    const props = publication.properties as Record<string, unknown>
    if (!props || typeof props !== "object" || !props.userInput) continue
    const receipts = db
      .select()
      .from(BusPublicationDeliveryReceiptTable)
      .where(
        and(
          eq(BusPublicationDeliveryReceiptTable.occurrence_id, publication.occurrence_id),
          eq(BusPublicationDeliveryReceiptTable.phase, "exact"),
          eq(BusPublicationDeliveryReceiptTable.subscriber_id, subscriber),
        ),
      )
      .all()
    if (receipts.some((row) => row.outcome === "succeeded")) continue
    const fail = (detail: string): never => invalid(publication.occurrence_id, detail)
    if (typeof props.requestID !== "string") fail("missing original Permission request")
    const facts = readPermissionRequestFacts(db, props.requestID as string)
    if (!facts) fail("missing original requested ledger fact")
    const { request, requested, authority, decision, autoReply } = facts!
    if (!request.taskID) continue
    if (
      !authority ||
      props.sessionID !== request.sessionID ||
      publication.project_id !== request.projectID ||
      props.decision !== decision ||
      props.actorID !== authority.actor_id ||
      props.autoReply !== autoReply ||
      autoReply
    )
      fail("reply differs from its immutable human ledger decision")
    if (receipts.some((row) => row.outcome === "ignored"))
      fail("ignored terminal conflicts with this subscriber's required input effect")
    const input = InteractionUserInput.parse(props.userInput)
    const project = db.select().from(ProjectTable).where(eq(ProjectTable.id, request.projectID)).get()
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, request.taskID!)).get()
    const session = db.select().from(SessionTable).where(eq(SessionTable.id, request.sessionID)).get()
    if ((task && task.project_id !== request.projectID) || (session && session.project_id !== request.projectID))
      fail("owner has a conflicting Project")
    let interactions = db
      .select()
      .from(EngineInteractionRequestTable)
      .where(
        or(
          and(
            eq(EngineInteractionRequestTable.source_kind, "permission_request"),
            eq(EngineInteractionRequestTable.source_id, requested.id),
          ),
          eq(EngineInteractionRequestTable.external_id, request.id),
        ),
      )
      .all()
    if (interactions.length > 1) fail("multiple original interaction owners")
    const validateInteraction = (interaction: typeof EngineInteractionRequestTable.$inferSelect) => {
      const owners = db
        .select()
        .from(ProtocolEventTable)
        .where(
          and(
            eq(ProtocolEventTable.type, "interaction.requested"),
            eq(ProtocolEventTable.interaction_id, interaction.id),
          ),
        )
        .all()
      if (
        owners.length !== 1 ||
        owners[0]!.aggregate_type !== "task" ||
        owners[0]!.aggregate_id !== request.taskID ||
        (owners[0]!.project_id !== null && owners[0]!.project_id !== request.projectID) ||
        (interaction.task_id !== null && interaction.task_id !== request.taskID)
      )
        fail("interaction has a conflicting immutable Task owner")
      if (interaction.source_kind === "permission_request") {
        if (interaction.source_id !== requested.id) fail("interaction has a conflicting requested source")
      } else {
        const expected = permissionInteractionRequest(request)
        if (
          interaction.source_kind !== null ||
          interaction.session_id !== expected.sessionID ||
          interaction.external_id !== expected.externalID ||
          interaction.request_type !== expected.requestType ||
          interaction.title !== expected.title ||
          interaction.body !== expected.body ||
          !isDeepStrictEqual(interaction.payload, expected.payload) ||
          interaction.time_created !== expected.timeCreated
        )
          fail("interaction differs from its original requested source")
      }
    }
    if (interactions[0]) validateInteraction(interactions[0])
    const kind = decision === "deny" ? "interaction_reject" : "interaction_reply"
    const readOriginalPending = (occurrenceID: string) => {
      const id = fileID(request.projectID, kind, occurrenceID)
      const cid = chunkID(id)
      const pendingFile = db.select().from(MemoryFileTable).where(eq(MemoryFileTable.id, id)).get()
      const pendingChunk = db.select().from(MemoryChunkTable).where(eq(MemoryChunkTable.id, cid)).get()
      const identity = { id, projectID: request.projectID, occurrenceID: occurrenceID }
      assertFileOwnership(pendingFile, {
        ...identity,
        source: "user",
        kind: "user_message",
        key: `${kind}:${occurrenceID}`,
      })
      assertChunkOwnership(pendingChunk, {
        id: cid,
        fileID: id,
        projectID: request.projectID,
        occurrenceID: occurrenceID,
      })
      if (pendingFile || pendingChunk) {
        if (!pendingFile || !pendingChunk) fail("incomplete original inbox entry")
        const entry = Entry.parse(JSON.parse(pendingChunk!.content))
        const actual = {
          occurrenceKind: entry.occurrenceKind,
          occurrenceID: entry.occurrenceID,
          projectID: entry.projectID,
          taskID: entry.taskID,
          sessionID: entry.sessionID,
          ownerKind: entry.ownerKind,
          ownerID: entry.ownerID,
          surface: entry.surface,
          timeCreated: entry.timeCreated,
          text: entry.text,
          structured: entry.structured,
        }
        const expected = {
          occurrenceKind: kind,
          occurrenceID: occurrenceID,
          projectID: request.projectID,
          taskID: request.taskID,
          sessionID: request.sessionID,
          ownerKind: "task",
          ownerID: request.taskID,
          surface: input.surface,
          timeCreated: authority!.time_created,
          text: sanitizeText(input.text),
          structured: input.structured ? sanitizeJSON(input.structured) : undefined,
        }
        if (!isDeepStrictEqual(actual, expected)) fail("inbox differs from the original human source")
        return entry
      }
      return undefined
    }
    const retainedPending = interactions[0] ? readOriginalPending(interactions[0].id) : undefined
    const retired = db
      .select()
      .from(ProtocolEventTable)
      .where(
        or(
          and(
            eq(ProtocolEventTable.aggregate_type, "task"),
            eq(ProtocolEventTable.aggregate_id, request.taskID!),
            eq(ProtocolEventTable.type, "task.deleted"),
          ),
          and(
            eq(ProtocolEventTable.aggregate_type, "session"),
            eq(ProtocolEventTable.aggregate_id, request.sessionID),
            eq(ProtocolEventTable.type, "session.deleted"),
          ),
        ),
      )
      .get()
    const retiredProject =
      !project &&
      !task &&
      !session &&
      projectRetirement(sqlite, context.databasePath, request.projectID, publication.directory)
    if (!retired && !retiredProject && project && (!task || !session)) {
      // The Project ID may have been recreated, but the original ledger has no
      // generation edge. Preserve the input for review in the same inbox; never
      // give a new owner this old input or fabricate a lost interaction identity.
      if (!retainedPending)
        insertEntry(
          db,
          Entry.parse({
            version: 1,
            occurrenceKind: kind,
            occurrenceID: interactions[0]?.id ?? publication.occurrence_id,
            projectID: request.projectID,
            taskID: request.taskID,
            sessionID: request.sessionID,
            ownerKind: "task",
            ownerID: request.taskID,
            ownerNameAtCapture: task
              ? safeMetadata(task.title, "Unavailable original Task")
              : "Unavailable original Task",
            surface: input.surface,
            timeCreated: authority!.time_created,
            text: sanitizeText(input.text),
            ...(input.structured ? { structured: sanitizeJSON(input.structured) } : {}),
            attachments: [],
            context: [],
            recovery: {
              kind: "permission_memory_recovery",
              schemaVersion: 6,
              publicationID: publication.occurrence_id,
              previousCapture: "unknown",
              recoveredAt: Date.now(),
              ownerResolution: "unresolved",
            },
          }),
        )
    } else if (!retired && !retiredProject) {
      if (!project || !task || !session) fail("missing owner without a durable retirement fact")
      let ancestor: string | null = request.sessionID
      const visited = new Set<string>()
      while (ancestor && ancestor !== task!.session_id) {
        if (visited.has(ancestor)) fail("cyclic Session lineage")
        visited.add(ancestor)
        const row = db.select().from(SessionTable).where(eq(SessionTable.id, ancestor)).get()
        if (!row || row.project_id !== request.projectID) fail("incomplete Session lineage")
        const otherTask = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.session_id, ancestor)).get()
        if (otherTask && otherTask.id !== request.taskID) fail("Session belongs to another Task")
        ancestor = row!.parent_id
      }
      if (!ancestor) fail("Session does not belong to the requested Task")
      if (interactions.length === 0) {
        const id = Identifier.deterministic("interaction", `permission-memory-recovery\0${requested.id}`)
        db.insert(EngineInteractionRequestTable)
          .values({ id, source_kind: "permission_request", source_id: requested.id })
          .run()
        // A real migration projection, at its actual time. No synthetic user
        // message, permission decision, tool command or old completion is made.
        const sequence = db
          .select({ n: sql<number>`coalesce(max(${ProtocolEventTable.seq}),0)+1` })
          .from(ProtocolEventTable)
          .where(
            and(eq(ProtocolEventTable.aggregate_type, "task"), eq(ProtocolEventTable.aggregate_id, request.taskID!)),
          )
          .get()!.n
        db.insert(ProtocolEventTable)
          .values({
            id: Identifier.ascending("protocol_event"),
            kind: "event",
            type: "interaction.requested",
            aggregate_type: "task",
            aggregate_id: request.taskID!,
            project_id: request.projectID,
            interaction_id: id,
            source: "schema.migration.permission-memory",
            seq: sequence,
            emitted_at: Date.now(),
            payload: { requestType: "permission", summary: "Recovered original Permission interaction projection" },
          })
          .run()
        interactions = db
          .select()
          .from(EngineInteractionRequestTable)
          .where(eq(EngineInteractionRequestTable.id, id))
          .all()
      }
      const interaction = interactions[0]!
      validateInteraction(interaction)
      if (!readOriginalPending(interaction.id)) {
        const documentID = Identifier.deterministic("memory", `project-context\0${request.projectID}`)
        const documentCID = Identifier.deterministic("memchunk", `project-context\0${request.projectID}`)
        const document = db.select().from(MemoryFileTable).where(eq(MemoryFileTable.id, documentID)).get()
        const chunk = db.select().from(MemoryChunkTable).where(eq(MemoryChunkTable.id, documentCID)).get()
        assertFileOwnership(document, {
          id: documentID,
          projectID: request.projectID,
          source: "reflection",
          kind: "project_context",
          key: "project-memory-document",
          occurrenceID: "project-context",
        })
        assertChunkOwnership(chunk, {
          id: documentCID,
          fileID: documentID,
          projectID: request.projectID,
          occurrenceID: "project-context",
        })
        if (Boolean(document) !== Boolean(chunk)) fail("incomplete original MEMORY.MD")
        const envelope = chunk ? JSON.parse(chunk.content) : undefined
        if (
          envelope &&
          (envelope.version !== 1 ||
            !Number.isInteger(envelope.revision) ||
            envelope.revision < 0 ||
            typeof envelope.markdown !== "string" ||
            !Array.isArray(envelope.recentCoveredOccurrenceIDs) ||
            envelope.recentCoveredOccurrenceIDs.length > 500 ||
            envelope.recentCoveredOccurrenceIDs.some((id: unknown) => typeof id !== "string"))
        )
          fail("invalid original MEMORY.MD coverage")
        if (!envelope?.recentCoveredOccurrenceIDs.includes(interaction.id)) {
          insertEntry(
            db,
            Entry.parse({
              version: 1,
              occurrenceKind: kind,
              occurrenceID: interaction.id,
              projectID: request.projectID,
              taskID: request.taskID,
              sessionID: request.sessionID,
              ownerKind: "task",
              ownerID: request.taskID,
              ownerNameAtCapture: safeMetadata(task!.title, "Untitled task"),
              surface: input.surface,
              timeCreated: authority!.time_created,
              text: sanitizeText(input.text),
              ...(input.structured ? { structured: sanitizeJSON(input.structured) } : {}),
              attachments: [],
              context: [],
              recovery: {
                kind: "permission_memory_recovery",
                schemaVersion: 6,
                publicationID: publication.occurrence_id,
                previousCapture: "unknown",
                recoveredAt: Date.now(),
              },
            }),
          )
        }
      }
    }
    db.insert(BusPublicationDeliveryReceiptTable)
      .values({
        id: Identifier.ascending("call"),
        occurrence_id: publication.occurrence_id,
        phase: "exact",
        subscriber_id: subscriber,
        outcome: "succeeded",
        error: null,
        retry_at: null,
        time_created: Date.now(),
      })
      .run()
  }
}
