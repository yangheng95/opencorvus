import { afterEach, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { SessionPrompt } from "@/session/prompt"
import { Message } from "@/session/message"
import { Bus } from "@/bus"
import { Database, DatabaseUnavailableError } from "@/storage/db"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Identifier } from "@/id/id"
import {
  currentOrchestratorControlMessage,
  materializeOrReuseCurrentOrchestratorControlMessage,
  OrchestratorControlIdentityConflictError,
} from "@/orchestrator/agent"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { resetDatabase } from "./fixture/db"
import { tmpdir } from "./fixture/fixture"

const model = { providerID: "test", modelID: "orchestrator-control-message" }

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("exact terminal ingress persists one visible Orchestrator control Message and reuses it", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Orchestrator exact terminal ingress" })
      const wakeID = "art_exact_terminal_control_wake"
      const event = OrchestratorEventSchema.parse({
        dispatchInfrastructureFailure: {
          infrastructureFactID: "art_dispatch_infrastructure_failure",
          outcome: {
            kind: "infrastructure_failure",
            operation: "worker_dispatch",
            message: "worker dispatch could not acquire its physical owner",
            error_name: "WorkerDispatchUnavailableError",
            recovery_authority: { occurrence_status: "occurrence_not_committed" },
            infrastructure_error: {
              source: "engine_artifact",
              artifact_id: "art_dispatch_infrastructure_failure",
              catalog_revision: 1,
              expected_sha256: "a".repeat(64),
            },
          },
        },
      })
      const control = currentOrchestratorControlMessage(event, "tsk_exact_terminal_control", wakeID)!
      expect(control).toMatchObject(orchestratorControlOccurrenceIdentity(wakeID, wakeID))
      expect([control.messageID, control.partID].every((id) => id.length <= Identifier.MAX_LENGTH)).toBe(true)
      const prompt = spyOn(SessionPrompt, "prompt").mockImplementation(async (input: any) => {
        expect(input).toMatchObject({
          sessionID: session.id,
          messageID: control.messageID,
          author: "orchestrator",
          agent: "orchestrator",
          noReply: true,
          extra: control.extra,
        })
        return await Session.persistMessage({
          info: {
            id: input.messageID,
            role: "user",
            author: input.author,
            sessionID: input.sessionID,
            time: { created: Date.now() },
            agent: input.agent,
            model: input.model,
            extra: input.extra,
          },
          parts: input.parts.map((part: any) => ({
            ...part,
            sessionID: input.sessionID,
            messageID: input.messageID,
          })),
        })
      })
      try {
        await materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control })
        const first = await MessageStore.get({ sessionID: session.id, messageID: control.messageID })
        await materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control })
        const second = await MessageStore.get({ sessionID: session.id, messageID: control.messageID })

        expect(second).toEqual(first)
        expect(first).toMatchObject({
          info: {
            role: "user",
            author: "orchestrator",
            agent: "orchestrator",
            extra: control.extra,
          },
          parts: [
            {
              id: control.partID,
              type: "text",
              text: control.text,
              kind: "control",
              source: "system",
            },
          ],
        })
        const messages = []
        for await (const message of MessageStore.stream(session.id)) messages.push(message.info.id)
        expect(messages).toEqual([control.messageID])
        const visibleTranscript = await Session.messages({ sessionID: session.id })
        expect(visibleTranscript).toEqual([first])
        expect(prompt).toHaveBeenCalledTimes(1)
      } finally {
        prompt.mockRestore()
      }
    },
  })
})

test("rejects occupied compact control identity before overwriting another Message", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Orchestrator compact collision" })
      const wakeID = "art_compact_control_collision"
      const control = currentOrchestratorControlMessage(
        OrchestratorEventSchema.parse({
          dispatchInfrastructureFailure: {
            infrastructureFactID: "art_compact_control_fact",
            outcome: {
              kind: "infrastructure_failure",
              operation: "worker_dispatch",
              message: "compact collision",
              error_name: "WorkerDispatchUnavailableError",
              recovery_authority: { occurrence_status: "occurrence_not_committed" },
              infrastructure_error: {
                source: "engine_artifact",
                artifact_id: "art_compact_control_fact",
                catalog_revision: 1,
                expected_sha256: "c".repeat(64),
              },
            },
          },
        }),
        "tsk_compact_control_collision",
        wakeID,
      )!
      const foreign = {
        id: control.messageID,
        sessionID: session.id,
        role: "user" as const,
        author: "foreign",
        time: { created: Date.now() },
        agent: "orchestrator",
        model,
      }
      await Session.persistMessage({ info: foreign, parts: [] })
      const before = await MessageStore.get({ sessionID: session.id, messageID: control.messageID })
      await expect(
        materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control }),
      ).rejects.toBeInstanceOf(OrchestratorControlIdentityConflictError)
      expect(await MessageStore.get({ sessionID: session.id, messageID: control.messageID })).toEqual(before)
    },
  })
})

test("rejects occupied compact control Part identity before writing the control occurrence", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Orchestrator compact Part collision" })
      const wakeID = "art_compact_control_part_collision"
      const control = currentOrchestratorControlMessage(
        OrchestratorEventSchema.parse({
          dispatchInfrastructureFailure: {
            infrastructureFactID: "art_compact_control_part_fact",
            outcome: {
              kind: "infrastructure_failure",
              operation: "worker_dispatch",
              message: "compact Part collision",
              error_name: "WorkerDispatchUnavailableError",
              recovery_authority: { occurrence_status: "occurrence_not_committed" },
              infrastructure_error: {
                source: "engine_artifact",
                artifact_id: "art_compact_control_part_fact",
                catalog_revision: 1,
                expected_sha256: "d".repeat(64),
              },
            },
          },
        }),
        "tsk_compact_control_part_collision",
        wakeID,
      )!
      const foreignMessageID = Identifier.ascending("message")
      const now = Date.now()
      Database.use((db) => {
        db.insert(MessageTable).values({
          id: foreignMessageID,
          session_id: session.id,
          data: { role: "user", author: "foreign" } as never,
          time_created: now,
          time_updated: now,
        }).run()
        db.insert(PartTable).values({
          id: control.partID,
          message_id: foreignMessageID,
          session_id: session.id,
          data: { type: "text", text: "Foreign Part" } as never,
          time_created: now,
          time_updated: now,
        }).run()
      })
      const before = Database.use((db) =>
        db.select().from(PartTable).where(eq(PartTable.id, control.partID)).get(),
      )
      await expect(
        materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control }),
      ).rejects.toBeInstanceOf(OrchestratorControlIdentityConflictError)
      expect(
        Database.use((db) => db.select().from(PartTable).where(eq(PartTable.id, control.partID)).get()),
      ).toEqual(before)
      expect(
        Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, control.messageID)).get()),
      ).toBeUndefined()
    },
  })
})

test("rejects a compact Part occupied after preparation at the persistence transaction fence", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Orchestrator compact transaction race" })
      const wakeID = "art_compact_control_transaction_race"
      const control = currentOrchestratorControlMessage(
        OrchestratorEventSchema.parse({
          dispatchInfrastructureFailure: {
            infrastructureFactID: "art_compact_control_transaction_fact",
            outcome: {
              kind: "infrastructure_failure",
              operation: "worker_dispatch",
              message: "compact transaction race",
              error_name: "WorkerDispatchUnavailableError",
              recovery_authority: { occurrence_status: "occurrence_not_committed" },
              infrastructure_error: {
                source: "engine_artifact",
                artifact_id: "art_compact_control_transaction_fact",
                catalog_revision: 1,
                expected_sha256: "e".repeat(64),
              },
            },
          },
        }),
        "tsk_compact_control_transaction_race",
        wakeID,
      )!
      const foreignMessageID = Identifier.ascending("message")
      let foreignPartBefore: typeof PartTable.$inferSelect | undefined
      const prompt = spyOn(SessionPrompt, "prompt").mockImplementation(async (input: any, hooks: any) => {
        const now = Date.now()
        Database.use((db) => {
          db.insert(MessageTable).values({
            id: foreignMessageID,
            session_id: session.id,
            data: { role: "user", author: "foreign" } as never,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(PartTable).values({
            id: control.partID,
            message_id: foreignMessageID,
            session_id: session.id,
            data: { type: "text", text: "Foreign transaction-race Part" } as never,
            time_created: now,
            time_updated: now,
          }).run()
        })
        foreignPartBefore = Database.use((db) =>
          db.select().from(PartTable).where(eq(PartTable.id, control.partID)).get(),
        )
        return Session.persistMessageWithCommit(
          {
            info: {
              id: input.messageID,
              role: "user",
              author: input.author,
              sessionID: input.sessionID,
              time: { created: now + 1 },
              agent: input.agent,
              model: input.model,
              extra: input.extra,
            },
            parts: input.parts.map((part: any) => ({
              ...part,
              sessionID: input.sessionID,
              messageID: input.messageID,
            })),
          },
          () => undefined,
          hooks?.beforeVisibilityEffects,
          hooks?.preflightBundle,
        )
      })
      try {
        await expect(
          materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control }),
        ).rejects.toBeInstanceOf(OrchestratorControlIdentityConflictError)
        expect(prompt).toHaveBeenCalledTimes(1)
        expect(
          Database.use((db) => db.select().from(PartTable).where(eq(PartTable.id, control.partID)).get()),
        ).toEqual(foreignPartBefore)
        expect(
          Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, control.messageID)).get()),
        ).toBeUndefined()
      } finally {
        prompt.mockRestore()
      }
    },
  })
})

for (const legacyFamily of ["message", "part"] as const)
  test(`requires a pre-release reset for an expanded Orchestrator control ${legacyFamily} identity`, async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Legacy Orchestrator control identity" })
        const now = Date.now()
        const wakeID = "art_legacy_orchestrator_control"
        const messageID =
          legacyFamily === "message"
            ? `msg_orchestrator_control_${wakeID}`
            : Identifier.ascending("message")
        const partID =
          legacyFamily === "part" ? `prt_orchestrator_control_${wakeID}` : Identifier.ascending("part")
        Database.transaction((db) => {
          db.insert(MessageTable).values({
            id: messageID,
            session_id: session.id,
            data: {
              role: "user",
              author: "orchestrator",
              extra: {
                orchestrator_control_ingress: {
                  wake_id: wakeID,
                  source_kind: "dispatch_infrastructure_failure",
                  fact_id: "art_legacy_control_fact",
                },
              },
            } as never,
            time_created: now,
            time_updated: now,
          }).run()
          db.insert(PartTable).values({
            id: partID,
            message_id: messageID,
            session_id: session.id,
            data: {
              type: "text",
              text: "Legacy Orchestrator control",
              metadata: {
                wake_id: wakeID,
                source_kind: "dispatch_infrastructure_failure",
                fact_id: "art_legacy_control_fact",
              },
            } as never,
            time_created: now,
            time_updated: now,
          }).run()
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
          operation: "Database.Client.dataIntegrity.compactOrchestratorControlIdentity",
          message: expect.stringContaining(legacyFamily === "message" ? messageID : partID),
        })
        await Database.resetFiles(Database.Path())
        Database.Client()
      },
    })
  }, 60_000)

test("publishes the staged control runtime before the visible Message event", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const root = await Session.create({ kind: "root", title: "Atomic control publication root" })
      const session = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Atomic control publication",
      })
      const wakeID = "art_atomic_control_publication"
      const event = OrchestratorEventSchema.parse({
        dispatchInfrastructureFailure: {
          infrastructureFactID: "art_atomic_dispatch_failure",
          outcome: {
            kind: "infrastructure_failure",
            operation: "worker_dispatch",
            message: "worker dispatch lost its physical owner",
            error_name: "WorkerDispatchUnavailableError",
            recovery_authority: { occurrence_status: "occurrence_not_committed" },
            infrastructure_error: {
              source: "engine_artifact",
              artifact_id: "art_atomic_dispatch_failure",
              catalog_revision: 1,
              expected_sha256: "b".repeat(64),
            },
          },
        },
      })
      const control = currentOrchestratorControlMessage(event, "tsk_atomic_control", wakeID)!
      const order: string[] = []
      const prompt = spyOn(SessionPrompt, "prompt").mockImplementation(async (input: any, hooks: any) =>
        Session.persistMessageWithCommit(
          {
            info: {
              id: input.messageID,
              role: "user",
              author: input.author,
              sessionID: input.sessionID,
              time: { created: Date.now() },
              agent: input.agent,
              model: input.model,
              extra: input.extra,
            },
            parts: input.parts.map((part: any) => ({
              ...part,
              sessionID: input.sessionID,
              messageID: input.messageID,
            })),
          },
          () => undefined,
          hooks?.beforeVisibilityEffects,
        ),
      )
      const unsubscribe = Bus.subscribe(Message.Event.Updated, (messageEvent) => {
        if (messageEvent.properties.info.id === control.messageID) order.push("visible-message")
      })
      try {
        expect(
          await materializeOrReuseCurrentOrchestratorControlMessage({
            session,
            model,
            control,
            beforeVisibilityEffects: () => Database.effect(() => order.push("runtime-armed")),
          }),
        ).toBe("created")
        await Database.awaitEffectIdle(5_000)
        expect(order).toEqual(["runtime-armed", "visible-message"])
        expect(await materializeOrReuseCurrentOrchestratorControlMessage({ session, model, control })).toBe("reused")
      } finally {
        unsubscribe()
        prompt.mockRestore()
      }
    },
  })
})
