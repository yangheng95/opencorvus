import { afterEach, describe, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Database, asc, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Protocol fact sequence allocation", () => {
  test("derives monotonic sequence identities from the immutable event log", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const aggregateID = "stream:fact-sequence"
        await Promise.all(Array.from({ length: 12 }, (_, index) => ProtocolStore.appendEvent({
          kind: "event",
          type: "sequence.fact",
          aggregate: "stream",
          aggregate_id: aggregateID,
          stream_id: aggregateID,
          source: "test.protocol-fact-sequence",
          payload: { index },
        })))
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "sequence.explicit",
          aggregate: "stream",
          aggregate_id: aggregateID,
          stream_id: aggregateID,
          source: "test.protocol-fact-sequence",
          seq: 20,
        })
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "sequence.after-explicit",
          aggregate: "stream",
          aggregate_id: aggregateID,
          stream_id: aggregateID,
          source: "test.protocol-fact-sequence",
        })

        const facts = Database.use((db) => db.select({ sequence: ProtocolEventTable.seq, type: ProtocolEventTable.type })
          .from(ProtocolEventTable)
          .where(eq(ProtocolEventTable.aggregate_id, aggregateID))
          .orderBy(asc(ProtocolEventTable.seq)).all())
        expect(facts).toEqual([
          ...Array.from({ length: 12 }, (_, index) => ({ sequence: index + 1, type: "sequence.fact" })),
          { sequence: 20, type: "sequence.explicit" },
          { sequence: 21, type: "sequence.after-explicit" },
        ])
      },
    })
  })
})
