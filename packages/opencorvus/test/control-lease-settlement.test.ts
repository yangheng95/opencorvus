import { afterAll, describe, expect, test } from "bun:test"
import {
  acquireControlLease,
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  currentControlLeaseInTransaction,
  releaseControlLease,
  releaseControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLeaseInTransaction,
} from "../src/engine/control-lease"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

describe("control lease settlement", () => {
  test("one transaction carries an exact domain activation through acquire, renewal, assertion and settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("call")
        const activationID = Identifier.ascending("activity")
        const now = 2_000_000
        const lifecycle = Database.immediateTransaction((db) => {
          const acquired = acquireControlLeaseInTransaction(db, {
            target: "task_root_ingress",
            targetID,
            ownerOccurrenceID: "domain-activation-owner",
            now,
            leaseMilliseconds: 10_000,
            leaseID: activationID,
          })
          if (!acquired.acquired) throw new Error("Expected the domain activation to acquire its lease")
          renewControlLeaseInTransaction(db, {
            target: "task_root_ingress",
            targetID,
            leaseID: activationID,
            ownerOccurrenceID: "domain-activation-owner",
            now: now + 100,
            expiresAt: now + 20_000,
          })
          const asserted = assertControlLeaseInTransaction(db, {
            target: "task_root_ingress",
            targetID,
            leaseID: activationID,
            ownerOccurrenceID: "domain-activation-owner",
            now: now + 200,
          })
          const released = releaseControlLeaseInTransaction(db, {
            target: "task_root_ingress",
            targetID,
            leaseID: activationID,
            ownerOccurrenceID: "domain-activation-owner",
            now: now + 300,
          })
          return { acquired: acquired.lease, asserted, released }
        })

        expect(lifecycle).toMatchObject({
          acquired: { id: activationID, owner_occurrence_id: "domain-activation-owner" },
          asserted: { id: activationID, expires_at: now + 20_000 },
          released: true,
        })
        expect(Database.use((db) => currentControlLeaseInTransaction(db, "task_root_ingress", targetID))).toMatchObject(
          {
            id: activationID,
            expires_at: now + 300,
          },
        )
      },
    })
  })

  test("a release fenced to the exact lease ends it and frees the target for the next owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("call")
        const now = 3_000_000
        const held = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-one",
          now,
          leaseMilliseconds: 120_000,
        })
        expect(held.acquired).toBe(true)

        expect(
          releaseControlLease({
            target: "effect",
            targetID,
            leaseID: held.lease.id,
            ownerOccurrenceID: "owner-one",
            now: now + 25,
          }),
        ).toBe(true)
        expect(Database.use((db) => currentControlLeaseInTransaction(db, "effect", targetID))).toMatchObject({
          id: held.lease.id,
          expires_at: now + 25,
        })

        const next = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-two",
          now: now + 25,
          leaseMilliseconds: 120_000,
        })
        expect(next.acquired).toBe(true)
        expect(next.lease.owner_occurrence_id).toBe("owner-two")
      },
    })
  })

  test("a release carrying a superseded lease identity leaves the current lease untouched", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("call")
        const now = 4_000_000
        const first = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-same",
          now,
          leaseMilliseconds: 1_000,
        })
        expect(first.acquired).toBe(true)
        const second = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-same",
          now: now + 1_000,
          leaseMilliseconds: 120_000,
        })
        expect(second.acquired).toBe(true)
        expect(second.lease.id).not.toBe(first.lease.id)

        // Owner identity alone is not an identity: the first attempt's stale
        // handback must not end the live second attempt.
        expect(
          releaseControlLease({
            target: "effect",
            targetID,
            leaseID: first.lease.id,
            ownerOccurrenceID: "owner-same",
            now: now + 1_100,
          }),
        ).toBe(false)
        expect(Database.use((db) => currentControlLeaseInTransaction(db, "effect", targetID))).toMatchObject({
          id: second.lease.id,
          expires_at: now + 1_000 + 120_000,
        })
      },
    })
  })

  test("the error-path release reports a lease it no longer owns rather than raising", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("call")
        const now = 6_000_000
        const mine = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-losing",
          now,
          leaseMilliseconds: 1_000,
        })
        expect(mine.acquired).toBe(true)
        const taken = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-taking",
          now: now + 1_000,
          leaseMilliseconds: 120_000,
        })
        expect(taken.acquired).toBe(true)

        // A caller on an error path is already carrying the failure that
        // matters. Discovering that the lease has moved on must be reported,
        // never raised in place of that failure.
        expect(
          releaseControlLeaseOnErrorPath({
            target: "effect",
            targetID,
            leaseID: mine.lease.id,
            ownerOccurrenceID: "owner-losing",
            now: now + 1_100,
          }),
        ).toEqual({ released: false })
        expect(Database.use((db) => currentControlLeaseInTransaction(db, "effect", targetID))).toMatchObject({
          id: taken.lease.id,
        })
      },
    })
  })

  test("the error-path release reports a successful handback", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const targetID = Identifier.ascending("call")
        const now = 5_000_000
        const held = acquireControlLease({
          target: "effect",
          targetID,
          ownerOccurrenceID: "owner-error-path",
          now,
          leaseMilliseconds: 120_000,
        })
        expect(held.acquired).toBe(true)
        expect(
          releaseControlLeaseOnErrorPath({
            target: "effect",
            targetID,
            leaseID: held.lease.id,
            ownerOccurrenceID: "owner-error-path",
            now: now + 5,
          }),
        ).toEqual({ released: true })
        expect(Database.use((db) => currentControlLeaseInTransaction(db, "effect", targetID))).toMatchObject({
          expires_at: now + 5,
        })
      },
    })
  })
})
