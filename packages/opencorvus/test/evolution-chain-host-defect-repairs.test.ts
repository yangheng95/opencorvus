import { afterEach, describe, expect, test } from "bun:test"
import { parseTree, type ParseError } from "jsonc-parser"
import { acquireControlLease, currentControlLeaseInTransaction, releaseControlLease } from "@/engine/control-lease"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { describeArtifactJSONParseError } from "@/tool/artifact-catalog"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("artifact publish payload parse diagnostics", () => {
  test("names the position in the author's own coordinates and quotes the offending text", () => {
    // Every character before the fault is CJK, so a UTF-8 byte offset and the
    // parser's string offset disagree by a factor of three. The author counts
    // characters, so the message has to as well.
    const payload = `{"会议纪要":"决策与行动项","行动项":{"负责人","到期日"}}`
    const errors: ParseError[] = []
    parseTree(payload, errors, { allowTrailingComma: false, disallowComments: true })
    expect(errors.length).toBeGreaterThan(0)

    const described = describeArtifactJSONParseError(payload, errors[0]!)
    const match = /at line (\d+), column (\d+) \(near (".*")\)$/.exec(described)
    expect(match).not.toBeNull()

    const [, line, column, excerpt] = match!
    expect(Number(line)).toBe(1)
    // Column is a 1-based character position that indexes the payload directly.
    expect(Number(column)).toBe(errors[0]!.offset + 1)
    expect(payload.length).toBeLessThan(Buffer.byteLength(payload, "utf8"))

    // The excerpt is checkable text, not another number to count to.
    expect(JSON.parse(excerpt!)).toContain("负责人")
  })
})

describe("control lease release", () => {
  test("hands the lease back so the next claim runs on the retry's own schedule", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("protocol_inbox")
        const now = 1_000_000
        const leaseMilliseconds = 120_000

        const first = acquireControlLease({
          target: "protocol_delivery",
          targetID,
          ownerOccurrenceID: "owner-first",
          now,
          leaseMilliseconds,
        })
        expect(first.acquired).toBe(true)

        const released = releaseControlLease({
          target: "protocol_delivery",
          targetID,
          leaseID: first.lease.id,
          ownerOccurrenceID: "owner-first",
          now: now + 500,
        })
        expect(released).toBe(true)

        // The delivery projection reads the current lease to decide whether the
        // row is still `leased`; an expired lease is what makes it claimable.
        const current = Database.use((db) => currentControlLeaseInTransaction(db, "protocol_delivery", targetID))
        expect(current?.expires_at).toBe(now + 500)

        // The retry asked for 500ms, and it gets 500ms instead of the lease TTL.
        const second = acquireControlLease({
          target: "protocol_delivery",
          targetID,
          ownerOccurrenceID: "owner-second",
          now: now + 500,
          leaseMilliseconds,
        })
        expect(second.acquired).toBe(true)
        expect(second.lease.owner_occurrence_id).toBe("owner-second")
      },
    })
  })

  test("only the recorded owner may end its own lease", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("protocol_inbox")
        const now = 2_000_000
        const holding = acquireControlLease({
          target: "protocol_delivery",
          targetID,
          ownerOccurrenceID: "owner-holding",
          now,
          leaseMilliseconds: 120_000,
        })

        const foreign = releaseControlLease({
          target: "protocol_delivery",
          targetID,
          leaseID: holding.lease.id,
          ownerOccurrenceID: "owner-other",
          now: now + 10,
        })
        expect(foreign).toBe(false)

        const current = Database.use((db) => currentControlLeaseInTransaction(db, "protocol_delivery", targetID))
        expect(current).toMatchObject({ owner_occurrence_id: "owner-holding", expires_at: now + 120_000 })
      },
    })
  })
})
