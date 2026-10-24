import { afterEach, expect, test } from "bun:test"
import { Database } from "@/storage/db"
import { Identifier } from "@/id/id"
import { ProjectMemory } from "@/memory/project-memory"
import { Entry, insertEntry } from "@/memory/project-memory-entry"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MemoryTool } from "@/tool/memory"
import { Server } from "@/server/server"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { EngineTaskTable } from "@/engine/engine.sql"
import { MemoryChunkTable } from "@/memory/memory.sql"
import { eq } from "drizzle-orm"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

for (const state of ["missing-task", "retired-conversation", "retired-task-source-session"] as const)
  test(`the original ${state} pending Entry projects to review with canonical bytes retained`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const root = await Session.create({ kind: "assistant", title: "Original owner" })
        let sourceSessionID = root.id
        const taskID = "retained-task-owner"
        if (state === "retired-task-source-session") {
          Database.use((db) =>
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: projectID,
                session_id: root.id,
                product_pillar: "work",
                title: "Actual retained Task",
                request: "Original request",
                time_created: 10,
              })
              .run(),
          )
          const child = await Session.create({ kind: "assistant", parentID: root.id, title: "Original source Session" })
          sourceSessionID = child.id
        }
        const original = Entry.parse({
          version: 1,
          occurrenceKind: "interaction_reply",
          occurrenceID: `original-${state}`,
          projectID,
          sessionID: sourceSessionID,
          ...(state === "retired-conversation" ? {} : { taskID }),
          ownerKind: state === "retired-conversation" ? "conversation" : "task",
          ownerID: state === "retired-conversation" ? root.id : taskID,
          ownerNameAtCapture: "Actual original name",
          surface: "http.permission",
          timeCreated: 100,
          text: "Preserve the complete old pending evidence.",
          attachments: [],
          context: [],
        })
        Database.immediateTransaction((db) => insertEntry(db, original))
        if (state !== "missing-task")
          Database.use((db) =>
            db
              .insert(ProtocolEventTable)
              .values({
                id: Identifier.ascending("protocol_event"),
                kind: "event",
                type: "session.deleted",
                aggregate_type: "session",
                aggregate_id: sourceSessionID,
                source: "session.delete",
                seq: 1,
                emitted_at: 200,
                payload: { cleanupOperationID: crypto.randomUUID() },
              })
              .run(),
          )
        const stored = () =>
          Database.use(
            (db) =>
              db
                .select()
                .from(MemoryChunkTable)
                .where(
                  eq(
                    MemoryChunkTable.id,
                    ProjectMemory.TestHooks.userChunk(projectID, "interaction_reply", original.occurrenceID),
                  ),
                )
                .get()!,
          )
        const before = stored()
        expect(ProjectMemory.read(projectID)).toMatchObject({ pendingCount: 0, unresolvedCount: 1 })
        const page = ProjectMemory.readRecovery(projectID, { occurrenceID: original.occurrenceID })
        expect(page).toMatchObject({
          status: "available",
          ownerResolution: "unresolved",
          content: before.content,
          nextOffset: null,
        })
        expect(stored()).toEqual(before)
        expect(JSON.parse(before.content)).toEqual(original)
      },
    })
  })

test("unresolved historical evidence remains readable while current input advances through FIFO and organization", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectID = Instance.project.id
      const session = await Session.create({
        kind: "assistant",
        title: "Actual new owner",
        metadata: { configOverlay: { model: null } },
      })
      const original = Entry.parse({
        version: 1,
        occurrenceKind: "interaction_reply",
        occurrenceID: "original-bus-publication",
        projectID,
        taskID: "unresolved-original-task",
        sessionID: "unresolved-original-session",
        ownerKind: "task",
        ownerID: "unresolved-original-task",
        ownerNameAtCapture: "Unavailable original Task",
        surface: "http.permission",
        timeCreated: 100,
        text: "原始𐀀🙂证据 ".repeat(4000),
        structured: { decision: "allow_once", original: true },
        attachments: [],
        context: [],
        recovery: {
          kind: "permission_memory_recovery",
          schemaVersion: 6,
          publicationID: "original-bus-publication",
          previousCapture: "unknown",
          recoveredAt: Date.now(),
          ownerResolution: "unresolved",
        },
      })
      Database.immediateTransaction((db) => insertEntry(db, original))
      expect(ProjectMemory.read(projectID)).toMatchObject({
        status: "idle",
        pendingCount: 0,
        unresolvedCount: 1,
        unresolvedOccurrences: [
          {
            occurrenceID: original.occurrenceID,
            originalTaskID: original.taskID,
            originalSessionID: original.sessionID,
            publicationID: original.occurrenceID,
            ownerResolution: "unresolved",
          },
        ],
      })
      Database.immediateTransaction((db) => {
        for (let index = 1; index <= 50; index++) {
          const occurrenceID = `additional-original-publication-${index}`
          insertEntry(
            db,
            Entry.parse({
              ...original,
              occurrenceID,
              timeCreated: 100 + index,
              text: `Original retained source ${index}`,
              recovery: { ...original.recovery!, publicationID: occurrenceID },
            }),
          )
        }
      })
      const inputIDs: string[] = []
      for (let index = 0; index < 2; index++) {
        const id = Identifier.ascending("message"),
          text = `New owner input ${index}`
        inputIDs.push(id)
        await Session.persistMessage({
          info: {
            id,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "work",
            model: { providerID: "test", modelID: "recovery" },
            time: { created: 1000 + index },
            extra: ProjectMemory.userInputExtra({ surface: "http.session", literalText: text }),
          },
          parts: [
            {
              id: Identifier.ascending("part"),
              messageID: id,
              sessionID: session.id,
              type: "text",
              text,
              kind: "user_content",
              source: "user",
            },
          ],
        })
      }
      expect(ProjectMemory.pending(projectID).map((e) => ({ id: e.occurrenceID, ownerID: e.ownerID }))).toEqual(
        inputIDs.map((id) => ({ id, ownerID: session.id })),
      )
      const response = await Server.App().request("/experimental/project-memory", {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect({ status: response.status, body: await response.json() }).toMatchObject({
        status: 200,
        body: { pendingCount: 2, unresolvedCount: 51, unresolvedNextOffset: 50 },
      })
      const tail = await Server.App().request("/experimental/project-memory?unresolvedOffset=50", {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect({ status: tail.status, body: await tail.json() }).toMatchObject({
        status: 200,
        body: {
          unresolvedCount: 51,
          unresolvedNextOffset: null,
          unresolvedOccurrences: [{ occurrenceID: "additional-original-publication-50" }],
        },
      })
      for (const attempt of [1, 2])
        Database.immediateTransaction((db) => {
          ProjectMemory.beginOrganizerAttemptInTransaction(db, {
            projectID,
            leaseID: `unavailable-${attempt}`,
            expectedRevision: 0,
          })
          const result = ProjectMemory.markUnavailableAndTrimInTransaction(db, {
            projectID,
            leaseID: `unavailable-${attempt}`,
            generation: "same-real-unavailable-generation",
            expectedRevision: 0,
            expectedOccurrenceIDs: inputIDs,
            pendingAvailabilityLimit: 1,
            allowTrim: attempt === 2,
            message: "Current owner has no configured model.",
          })
          expect(result).toEqual({ applied: true, droppedOccurrenceIDs: attempt === 2 ? [inputIDs[0]!] : [] })
        })
      expect(ProjectMemory.pending(projectID).map((e) => e.occurrenceID)).toEqual([inputIDs[1]!])
      Database.immediateTransaction((db) => {
        ProjectMemory.beginOrganizerAttemptInTransaction(db, {
          projectID,
          leaseID: "new-owner-commit",
          expectedRevision: 0,
        })
        const committed = ProjectMemory.commitOrganizationInTransaction(db, {
          projectID,
          leaseID: "new-owner-commit",
          baseRevision: 0,
          coveredOccurrenceIDs: [inputIDs[1]!],
          markdown: "# New Project context\n\nNew owner input 1.\n",
        })
        expect(committed).toMatchObject({ revision: 1, coveredOccurrenceIDs: [inputIDs[1]!] })
      })
      expect(ProjectMemory.read(projectID)).toMatchObject({
        pendingCount: 0,
        unresolvedCount: 51,
        revision: 1,
        droppedPendingCount: 1,
      })
      const tool = await MemoryTool.init()
      const context = {
        sessionID: session.id,
        messageID: inputIDs[1],
        callID: "read-actual-source",
        agent: "work",
        abort: AbortSignal.any([]),
        messages: [],
        metadata: () => {},
        ask: async () => {},
      } as never
      const found: string[] = []
      let listOffset = 0
      for (;;) {
        const result = await tool.execute({ action: "project_read", recoveryListOffset: listOffset }, context)
        expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(32768)
        const document = JSON.parse(result.output).document
        found.push(...document.unresolvedOccurrences.map((entry: { occurrenceID: string }) => entry.occurrenceID))
        if (document.unresolvedNextOffset === null) break
        listOffset = document.unresolvedNextOffset
      }
      expect(found).toEqual([
        original.occurrenceID,
        ...Array.from({ length: 50 }, (_, index) => `additional-original-publication-${index + 1}`),
      ])
      let all = "",
        offset = 0
      for (;;) {
        const result = await tool.execute(
          { action: "project_read", recoveryOccurrenceID: original.occurrenceID, offset, limit: 4000 },
          context,
        )
        expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(32768)
        const page = JSON.parse(result.output)
        expect({ status: page.status, ownerResolution: page.ownerResolution, offset: page.offset }).toEqual({
          status: "available",
          ownerResolution: "unresolved",
          offset,
        })
        all += page.content
        if (page.nextOffset === null) break
        offset = page.nextOffset
      }
      expect(JSON.parse(all)).toEqual(original)
      expect(ProjectMemory.readRecovery("different-project", { occurrenceID: original.occurrenceID })).toEqual({
        status: "not_found",
        occurrenceID: original.occurrenceID,
      })
    },
  })
})
