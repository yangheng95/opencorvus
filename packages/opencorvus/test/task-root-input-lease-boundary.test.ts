import { settleScriptedStatusInput } from "./fixture/task-root-status-input"
import { afterEach, expect, test } from "bun:test"
import { EngineService } from "@/task-api"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { acquireTaskRootIngressLease, projectTaskRootIngress } from "@/engine/task-root-fact-store"
import { readTaskRootIngressEvidence, reconcileTaskControlPlane, TestHooks } from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

// Local protocol driver: Session/Tool requests are explicit scripted test inputs.
// Tool outputs and Task/ingress/lease facts come from production writers. No
// Provider response, Task status, ledger mutation, or decision output is invented.
test("public inputs queue behind a real activation and advance after the actual Tool receipt", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    init: InstanceBootstrap,
    fn: async () => {
      const firstStarted = Promise.withResolvers<string>()
      const releaseFirst = Promise.withResolvers<void>()
      const secondFinished = Promise.withResolvers<void>()
      const activated: string[] = []
      using _runner = TestHooks.replaceTaskIngressRunner({
        runner: async (input) => {
          const { taskID, event, wakeID, activationID, predecessorID } = input
          if (!event || !wakeID || !activationID || !predecessorID)
            throw new Error("Expected durable activation identity")
          activated.push(wakeID)
          if (activated.length === 1) {
            firstStarted.resolve(wakeID)
            await releaseFirst.promise
          }
          const result = await settleScriptedStatusInput({
            taskID,
            event,
            wakeID,
            activationID,
            predecessorID,
            directory: project.path,
          })
          if (activated.length === 2) secondFinished.resolve()
          return result
        },
      })
      let taskID: string | undefined
      try {
        taskID = await EngineService.createTask(
          {
            requestID: Identifier.ascending("artifact"),
            title: "Local input lease contract",
            request: "LOCAL PROTOCOL TEST: report the current lifecycle status.",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          { actor: "user" },
        )
        const firstID = await firstStarted.promise
        const followup = await EngineService.handleTaskMessage(taskID, {
          text: "LOCAL PROTOCOL TEST: report status for this second input.",
          source: "api",
        })
        if (!followup.ingress_id) throw new Error("Expected the public input acceptance receipt")
        const secondID = followup.ingress_id
        expect({ wake_status: followup.wake_status, ingress_id: secondID }).toMatchObject({
          wake_status: "accepted",
          ingress_id: expect.any(String),
        })
        expect(
          acquireTaskRootIngressLease({
            ingressID: secondID,
            ownerOccurrenceID: "local-competitor-driver",
            now: Date.now(),
            leaseMilliseconds: 1000,
            readEvidence: readTaskRootIngressEvidence,
            assertControlOwnerInTransaction: () => undefined,
          }),
        ).toMatchObject({ acquired: false, blockedByIngressID: firstID, projection: { state: "ready" } })
        expect(projectTaskRootIngress(firstID, Date.now(), readTaskRootIngressEvidence)).toMatchObject({
          state: "leased",
        })
        releaseFirst.resolve()
        await secondFinished.promise
        await reconcileTaskControlPlane(taskID)
        expect(activated).toEqual([firstID, secondID])
        expect(
          [firstID, secondID].map((id) => projectTaskRootIngress(id, Date.now(), readTaskRootIngressEvidence)),
        ).toEqual([
          { state: "resolved", decisionIDs: [expect.any(String)] },
          { state: "resolved", decisionIDs: [expect.any(String)] },
        ])
        expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "active", epoch: 1 })
      } finally {
        releaseFirst.resolve()
        if (taskID)
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID: "local-input-lease-cleanup",
              reason: "Finish isolated input-order test",
            },
          })
      }
      expect(taskLifecycleProjection(taskID!)).toMatchObject({ status: "cancelled", epoch: 1 })
    },
  })
}, 60_000)
