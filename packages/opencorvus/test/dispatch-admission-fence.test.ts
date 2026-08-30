import { afterEach, expect, test } from "bun:test"
import {
  acquireControlLease,
  ControlLeaseFenceLostError,
  currentControlLease,
  releaseControlLease,
} from "../src/engine/control-lease"
import {
  DispatchLineageTestHooks,
  holdDispatchAdmission,
  type DispatchAdmissionOwner,
} from "../src/engine/dispatch-lineage"
import { Instance } from "../src/project/instance"
import { resetMemoryDatabase, memoryProject } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a successor admission fence aborts the stale physical executor with the exact fence-loss cause", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      using _timing = DispatchLineageTestHooks.replaceAdmissionTiming({
        leaseMilliseconds: 500,
        renewalMilliseconds: 10,
      })
      const targetID = "dispatch-lineage-fence-test"
      const staleOwnerOccurrenceID = "dispatch-owner-stale"
      const successorOwnerOccurrenceID = "dispatch-owner-successor"
      const startedAt = Date.now()
      const acquired = acquireControlLease({
        target: "dispatch_admission",
        targetID,
        ownerOccurrenceID: staleOwnerOccurrenceID,
        now: startedAt,
        leaseMilliseconds: 500,
      })
      if (!acquired.acquired) throw new Error("Stale-owner fixture did not acquire dispatch admission")
      const owner: DispatchAdmissionOwner = {
        lineageArtifactID: targetID,
        leaseID: acquired.lease.id,
        ownerOccurrenceID: staleOwnerOccurrenceID,
        expiresAt: acquired.lease.expires_at,
      }
      using hold = holdDispatchAdmission(owner)

      expect(releaseControlLease({
        target: "dispatch_admission",
        targetID,
        leaseID: owner.leaseID,
        ownerOccurrenceID: staleOwnerOccurrenceID,
        now: startedAt + 1,
      })).toBe(true)
      const successor = acquireControlLease({
        target: "dispatch_admission",
        targetID,
        ownerOccurrenceID: successorOwnerOccurrenceID,
        now: startedAt + 2,
        leaseMilliseconds: 500,
      })
      if (!successor.acquired) throw new Error("Successor fixture did not acquire dispatch admission")

      await Promise.race([
        new Promise<void>((resolve) => hold.signal.addEventListener("abort", () => resolve(), { once: true })),
        Bun.sleep(1_000).then(() => {
          throw new Error("Timed out waiting for the stale dispatch admission fence")
        }),
      ])

      expect({
        aborted: hold.signal.aborted,
        reasonName: hold.signal.reason instanceof Error ? hold.signal.reason.name : undefined,
        currentOwner: currentControlLease("dispatch_admission", targetID)?.owner_occurrence_id,
        currentLeaseID: currentControlLease("dispatch_admission", targetID)?.id,
      }).toEqual({
        aborted: true,
        reasonName: ControlLeaseFenceLostError.name,
        currentOwner: successorOwnerOccurrenceID,
        currentLeaseID: successor.lease.id,
      })
    },
  })
})
