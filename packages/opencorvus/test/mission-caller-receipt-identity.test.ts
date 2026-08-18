import { afterEach, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"
import { Config } from "@/config/config"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Identifier } from "@/id/id"
import {
  attachMissionCaller,
  MissionCallerReceiptIdentityConflictError,
  recordMissionCallerReceipt,
} from "@/mission/caller-receipt"
import { missionCallerReceiptOccurrenceIdentity } from "@/mission/caller-receipt-identity"
import { Instance } from "@/project/instance"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, DatabaseUnavailableError } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createMissionCallerFixture() {
  await Config.updateProjectPatch({ model: "test/mission-caller-receipt" })
  const callerSession = await createRightSidebarConversationSession("work")
  const callerMessageID = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id: callerMessageID,
      sessionID: callerSession.id,
      role: "user",
      author: "user",
      time: { created: Date.now() },
      agent: "work",
      model: { providerID: "test", modelID: "mission-caller-receipt" },
    },
    parts: [],
  })
  const missionSession = await Session.create({
    kind: "mission",
    title: "Compact caller receipt",
    metadata: {
      configOverlay: { model: "test/mission-caller-receipt" },
      mission: {
        id: "compact-caller-receipt",
        channelKey: "mission:compact-caller-receipt",
        cwd: Instance.directory,
        productPillar: "work",
        visibleExpertSquadIDs: ["base"],
      },
    },
  })
  await attachMissionCaller({ missionSessionID: missionSession.id, callerSession, callerMessageID })
  return { callerSession, callerMessageID, missionSession: await Session.get(missionSession.id) }
}

const completed = { type: "terminal", reason: "completed" } as const

test("persists and replays one compact Mission caller receipt with complete provenance", async () => {
  await using project = await memoryProject()
  const provider = spyOn(Provider, "getModel").mockResolvedValue({
    id: "mission-caller-receipt",
    providerID: "test",
  } as never)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const fixture = await createMissionCallerFixture()
      const occurrence = missionCallerReceiptOccurrenceIdentity(fixture.missionSession.id)
      const first = await recordMissionCallerReceipt({ sessionID: fixture.missionSession.id, status: completed })
      const second = await recordMissionCallerReceipt({ sessionID: fixture.missionSession.id, status: completed })
      expect(first).toEqual(second)
      expect(first).toMatchObject({
        message_id: occurrence.messageID,
        part_id: occurrence.partID,
        terminal_reason: "completed",
      })
      expect([occurrence.messageID, occurrence.partID].every((id) => id.length <= Identifier.MAX_LENGTH)).toBe(true)
      expect(
        await MessageStore.get({ sessionID: fixture.callerSession.id, messageID: occurrence.messageID }),
      ).toMatchObject({
        info: {
          role: "assistant",
          author: "mission",
          agent: "mission",
          parentID: fixture.callerMessageID,
        },
        parts: [
          {
            id: occurrence.partID,
            type: "text",
            source: "system",
            metadata: {
              source: "right-sidebar-conversation",
              mission_id: "compact-caller-receipt",
              mission_session_id: fixture.missionSession.id,
              terminal_reason: "completed",
            },
          },
        ],
      })
      expect((await Session.get(fixture.missionSession.id)).metadata).toMatchObject({
        mission: { receipt: first },
      })
    },
  })
  provider.mockRestore()
})

test("rejects a compact Part occupied after preparation at the Mission receipt transaction fence", async () => {
  await using project = await memoryProject()
  const provider = spyOn(Provider, "getModel").mockResolvedValue({
    id: "mission-caller-receipt",
    providerID: "test",
  } as never)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const fixture = await createMissionCallerFixture()
      const occurrence = missionCallerReceiptOccurrenceIdentity(fixture.missionSession.id)
      const foreignMessageID = Identifier.ascending("message")
      const original = Session.persistMessageWithCommit
      let foreignPartBefore: typeof PartTable.$inferSelect | undefined
      const persist = spyOn(Session, "persistMessageWithCommit").mockImplementation(async (...args) => {
        const now = Date.now()
        Database.use((db) => {
          db.insert(MessageTable).values({
            id: foreignMessageID,
            session_id: fixture.callerSession.id,
            data: { role: "user", author: "foreign" } as never,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(PartTable).values({
            id: occurrence.partID,
            message_id: foreignMessageID,
            session_id: fixture.callerSession.id,
            data: { type: "text", text: "Foreign Mission receipt Part" } as never,
            time_created: now,
            time_updated: now,
          }).run()
        })
        foreignPartBefore = Database.use((db) =>
          db.select().from(PartTable).where(eq(PartTable.id, occurrence.partID)).get(),
        )
        return original(...args)
      })
      try {
        await expect(
          recordMissionCallerReceipt({ sessionID: fixture.missionSession.id, status: completed }),
        ).rejects.toBeInstanceOf(MissionCallerReceiptIdentityConflictError)
        expect(persist).toHaveBeenCalledTimes(1)
        expect(
          Database.use((db) => db.select().from(PartTable).where(eq(PartTable.id, occurrence.partID)).get()),
        ).toEqual(foreignPartBefore)
        expect(
          Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, occurrence.messageID)).get()),
        ).toBeUndefined()
        expect((await Session.get(fixture.missionSession.id)).metadata).not.toHaveProperty("mission.receipt")
      } finally {
        persist.mockRestore()
      }
    },
  })
  provider.mockRestore()
})

for (const occupiedFamily of ["message", "part"] as const)
  test(`rejects an occupied compact Mission receipt ${occupiedFamily} before model preparation`, async () => {
    await using project = await memoryProject()
    const provider = spyOn(Provider, "getModel").mockResolvedValue({
      id: "mission-caller-receipt",
      providerID: "test",
    } as never)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createMissionCallerFixture()
        const occurrence = missionCallerReceiptOccurrenceIdentity(fixture.missionSession.id)
        const foreignMessageID =
          occupiedFamily === "message" ? occurrence.messageID : Identifier.ascending("message")
        const foreignPartID =
          occupiedFamily === "part" ? occurrence.partID : Identifier.ascending("part")
        const now = Date.now()
        Database.use((db) => {
          db.insert(MessageTable).values({
            id: foreignMessageID,
            session_id: fixture.callerSession.id,
            data: { role: "user", author: "foreign" } as never,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(PartTable).values({
            id: foreignPartID,
            message_id: foreignMessageID,
            session_id: fixture.callerSession.id,
            data: { type: "text", text: "Foreign Mission receipt occupant" } as never,
            time_created: now,
            time_updated: now,
          }).run()
        })
        const beforeMessage = Database.use((db) =>
          db.select().from(MessageTable).where(eq(MessageTable.id, foreignMessageID)).get(),
        )
        const beforePart = Database.use((db) =>
          db.select().from(PartTable).where(eq(PartTable.id, foreignPartID)).get(),
        )
        const preparation = spyOn(PrimaryAssistantRegistry, "get").mockRejectedValue(
          new Error("Mission model preparation must not run after a compact identity collision"),
        )
        try {
          await expect(
            recordMissionCallerReceipt({ sessionID: fixture.missionSession.id, status: completed }),
          ).rejects.toBeInstanceOf(MissionCallerReceiptIdentityConflictError)
          expect(preparation).not.toHaveBeenCalled()
          expect(
            Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, foreignMessageID)).get()),
          ).toEqual(beforeMessage)
          expect(
            Database.use((db) => db.select().from(PartTable).where(eq(PartTable.id, foreignPartID)).get()),
          ).toEqual(beforePart)
          expect((await Session.get(fixture.missionSession.id)).metadata).not.toHaveProperty("mission.receipt")
          const absentID = occupiedFamily === "message" ? occurrence.partID : occurrence.messageID
          expect(
            occupiedFamily === "message"
              ? Database.use((db) => db.select().from(PartTable).where(eq(PartTable.id, absentID)).get())
              : Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, absentID)).get()),
          ).toBeUndefined()
        } finally {
          preparation.mockRestore()
        }
      },
    })
    provider.mockRestore()
  })

test("rejects replay when persisted Mission receipt provenance is not the strict canonical metadata", async () => {
  await using project = await memoryProject()
  const provider = spyOn(Provider, "getModel").mockResolvedValue({
    id: "mission-caller-receipt",
    providerID: "test",
  } as never)
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const fixture = await createMissionCallerFixture()
      // The non-canonical receipt is written as it would already exist, not
      // produced and then rewritten. A completed assistant Part and the Mission
      // identity metadata are both immutable at the database, so tampering with
      // a recorded receipt is refused before this assertion can run — and
      // refusing it is the guard working. What remains reachable, and what this
      // test is about, is provenance persisted before the guard existed.
      const occurrence = missionCallerReceiptOccurrenceIdentity(fixture.missionSession.id)
      const sentAt = Date.now()
      Database.transaction((db) => {
        db.insert(MessageTable)
          .values({
            id: occurrence.messageID,
            session_id: fixture.callerSession.id,
            data: { role: "assistant", author: "mission", agent: "mission" } as never,
            time_created: sentAt,
            time_updated: sentAt,
          })
          .run()
        db.insert(PartTable)
          .values({
            id: occurrence.partID,
            message_id: occurrence.messageID,
            session_id: fixture.callerSession.id,
            data: {
              type: "text",
              text: "Legacy Mission receipt",
              source: "system",
              metadata: { foreign: true },
            } as never,
            time_created: sentAt,
            time_updated: sentAt,
          })
          .run()
      })
      await Session.mergeMetadata({
        sessionID: fixture.missionSession.id,
        patch: {
          // Merging replaces the whole Mission object, so it is carried over
          // rather than restated: dropping an identity field is what the
          // immutability trigger refuses, and dropping the caller would leave
          // nothing for the receipt to be recorded against.
          mission: {
            ...(await Session.get(fixture.missionSession.id)).metadata.mission!,
            receipt: {
              message_id: occurrence.messageID,
              part_id: occurrence.partID,
              terminal_reason: "completed",
              sent_at: sentAt,
            },
          },
        },
      })
      await expect(
        recordMissionCallerReceipt({ sessionID: fixture.missionSession.id, status: completed }),
      ).rejects.toBeInstanceOf(MissionCallerReceiptIdentityConflictError)
    },
  })
  provider.mockRestore()
})

for (const legacyFamily of ["message", "part"] as const)
  test(`requires a pre-release reset for an expanded Mission caller receipt ${legacyFamily} identity`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const callerSession = await createRightSidebarConversationSession("work")
        const missionID = `legacy-receipt-${legacyFamily}`
        const missionSession = await Session.create({
          kind: "mission",
          title: "Legacy caller receipt",
          metadata: {
            mission: {
              id: missionID,
              channelKey: `mission:${missionID}`,
              cwd: project.path,
              productPillar: "work",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        const messageID =
          legacyFamily === "message"
            ? `msg_mission_receipt_${missionSession.id}`
            : Identifier.ascending("message")
        const partID =
          legacyFamily === "part" ? `prt_mission_receipt_${missionSession.id}` : Identifier.ascending("part")
        const now = Date.now()
        Database.transaction((db) => {
          db.insert(MessageTable).values({
            id: messageID,
            session_id: callerSession.id,
            data: { role: "assistant", author: "mission", agent: "mission" } as never,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(PartTable).values({
            id: partID,
            message_id: messageID,
            session_id: callerSession.id,
            data: {
              type: "text",
              text: "Legacy Mission receipt",
              source: "system",
              metadata: {
                source: "right-sidebar-conversation",
                mission_id: missionID,
                mission_session_id: missionSession.id,
                terminal_reason: "completed",
              },
            } as never,
            time_created: now,
            time_updated: now,
          }).run()
        })
        await Session.mergeMetadata({
          sessionID: missionSession.id,
          patch: {
            mission: {
              id: missionID,
              channelKey: `mission:${missionID}`,
              cwd: project.path,
              productPillar: "work",
              visibleExpertSquadIDs: ["base"],
              receipt: {
                message_id: messageID,
                part_id: partID,
                terminal_reason: "completed",
                sent_at: now,
              },
            },
          },
        })
        await Database.awaitEffectIdle(30_000)
        Database.close()
        let observed: unknown
        try {
          Database.Client()
        } catch (error) {
          observed = error
        }
        expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
          code: "DATA_RESET_REQUIRED",
          operation: "Database.Client.dataIntegrity.compactMissionCallerReceiptIdentity",
          message: expect.stringContaining(legacyFamily === "message" ? messageID : partID),
        })
        await Database.resetFiles(Database.Path())
        Database.Client()
      },
    })
  }, 60_000)
