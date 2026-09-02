import { afterEach, describe, expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { detachDispatchExecution, waitForDetachedDispatchPipelinesForTest } from "@/orchestrator/dispatch-agent-tool"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import {
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("dispatch_agent detached execution", () => {
  test("returns a committed acceptance receipt while delivering the later terminal outcome", async () => {
    let commitLineage!: (lineage: { sessionID: string; artifactID: string }) => void
    const committedLineage = new Promise<{ sessionID: string; artifactID: string }>(
      (resolve) => (commitLineage = resolve),
    )
    let finishWorker!: () => void
    const workerFinished = new Promise<void>((resolve) => (finishWorker = resolve))
    let delivered!: (value: { sessionID: string; kind: string }) => void
    const delivery = new Promise<{ sessionID: string; kind: string }>((resolve) => (delivered = resolve))
    const execution = (async () => {
      await workerFinished
      return DispatchOutcome.terminal({ sessionID: "ses_detached_worker", finalMessageID: "msg_terminal" })
    })()

    const receiptPromise = detachDispatchExecution({
      execute: () => execution,
      runDetached: (run) => run(),
      runDetachedRecovery: (run) => run(),
      committedLineage,
      async deliver({ sessionID, outcome }) {
        delivered({ sessionID, kind: outcome.kind })
      },
      onDeliveryFailure({ error }) {
        throw error
      },
      onPipelineOwnerCleanupFailure({ error }) {
        throw error
      },
    })
    commitLineage({ sessionID: "ses_detached_worker", artifactID: "artifact_dispatch_lineage" })
    expect(await receiptPromise).toEqual({
      kind: "accepted",
      session_id: "ses_detached_worker",
      dispatch_lineage_id: "artifact_dispatch_lineage",
    })

    finishWorker()
    expect(await delivery).toEqual({ sessionID: "ses_detached_worker", kind: "terminal_success" })
  })

  test("delivers a detached worker failure after the acceptance receipt", async () => {
    let commitLineage!: (lineage: { sessionID: string; artifactID: string }) => void
    const committedLineage = new Promise<{ sessionID: string; artifactID: string }>(
      (resolve) => (commitLineage = resolve),
    )
    let failWorker!: (error: Error) => void
    const execution = new Promise<never>((_resolve, reject) => (failWorker = reject))
    let delivered!: (value: { sessionID: string; errorName?: string }) => void
    const delivery = new Promise<{ sessionID: string; errorName?: string }>((resolve) => (delivered = resolve))

    const receiptPromise = detachDispatchExecution({
      execute: () => execution,
      runDetached: (run) => run(),
      runDetachedRecovery: (run) => run(),
      committedLineage,
      async deliver({ sessionID, executionError }) {
        delivered({ sessionID, errorName: executionError instanceof Error ? executionError.name : undefined })
      },
      onDeliveryFailure({ error }) {
        throw error
      },
      onPipelineOwnerCleanupFailure({ error }) {
        throw error
      },
    })
    commitLineage({ sessionID: "ses_failed_worker", artifactID: "artifact_failed_lineage" })
    expect((await receiptPromise).kind).toBe("accepted")
    failWorker(new TypeError("worker provider failed"))
    expect(await delivery).toEqual({ sessionID: "ses_failed_worker", errorName: "TypeError" })
  })

  test("owns worker completion after the parent project lease is released", async () => {
    await using project = await memoryProject()
    let releaseWorker!: () => void
    const workerReleased = new Promise<void>((resolve) => (releaseWorker = resolve))
    let settleDelivery!: (projectID: string) => void
    let failDelivery!: (error: unknown) => void
    const delivery = new Promise<string>((resolve, reject) => {
      settleDelivery = resolve
      failDelivery = reject
    })
    let expectedProjectID = ""

    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        expectedProjectID = Instance.project.id
        const execute = async () => {
          await workerReleased
          return await Instance.provideProjectIdentity({
            directory: project.path,
            fn: () =>
              DispatchOutcome.terminal({
                sessionID: "ses_released_parent_worker",
                finalMessageID: `msg_${Instance.project.id}`,
              }),
          })
        }
        const committedLineage = Promise.resolve({
          sessionID: "ses_released_parent_worker",
          artifactID: "artifact_released_parent_lineage",
        })
        expect(
          await detachDispatchExecution({
            execute,
            runDetached: (run) =>
              runWithInitializedIndependentProject({
                directory: project.path,
                fn: run,
              }),
            runDetachedRecovery: (run) =>
              runWithIndependentProjectIdentity({
                directory: project.path,
                fn: run,
              }),
            committedLineage,
            async deliver({ outcome, executionError }) {
              if (executionError) throw executionError
              if (!outcome || outcome.kind !== "terminal_success") {
                throw new Error("detached worker did not produce its terminal outcome")
              }
              settleDelivery(outcome.final_message_id.slice("msg_".length))
            },
            onDeliveryFailure({ error }) {
              failDelivery(error)
            },
            onPipelineOwnerCleanupFailure({ error }) {
              failDelivery(error)
            },
          }),
        ).toMatchObject({ kind: "accepted", session_id: "ses_released_parent_worker" })
      },
    })

    releaseWorker()
    expect(
      await Promise.race([
        delivery,
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error("detached worker did not converge within one second")), 1_000)
        }),
      ]),
    ).toBe(expectedProjectID)
  }, 30_000)

  test("routes detached pipeline owner initialization failure through supervised recovery", async () => {
    let releaseWorker!: () => void
    const workerReleased = new Promise<void>((resolve) => (releaseWorker = resolve))
    let detachedOwner = 0
    let delivered!: (kind: string) => void
    const delivery = new Promise<string>((resolve) => (delivered = resolve))
    const receipt = await detachDispatchExecution({
      execute: async () => {
        await workerReleased
        return DispatchOutcome.terminal({ sessionID: "ses_owner_init_failure", finalMessageID: "msg_terminal" })
      },
      runDetached: (run) => {
        detachedOwner += 1
        if (detachedOwner === 2) return Promise.reject(new Error("pipeline owner initialization failed"))
        return run()
      },
      runDetachedRecovery: (run) => run(),
      committedLineage: Promise.resolve({
        sessionID: "ses_owner_init_failure",
        artifactID: "artifact_owner_init_failure",
      }),
      async deliver({ outcome }) {
        delivered(outcome?.kind ?? "missing")
      },
      onDeliveryFailure({ error }) {
        throw error
      },
      onPipelineOwnerCleanupFailure({ error }) {
        throw error
      },
    })
    expect(receipt.kind).toBe("accepted")
    releaseWorker()
    expect(await delivery).toBe("terminal_success")
    await waitForDetachedDispatchPipelinesForTest()
    expect(detachedOwner).toBe(3)
  })

  test("routes detached pipeline owner cleanup failure through supervised recovery", async () => {
    let releaseWorker!: () => void
    const workerReleased = new Promise<void>((resolve) => (releaseWorker = resolve))
    let detachedOwner = 0
    let delivered!: () => void
    const delivery = new Promise<void>((resolve) => (delivered = resolve))
    let recovered!: (error: unknown) => void
    const recovery = new Promise<unknown>((resolve) => (recovered = resolve))
    let recoveryOwner = 0
    const receipt = await detachDispatchExecution({
      execute: async () => {
        await workerReleased
        return DispatchOutcome.terminal({ sessionID: "ses_owner_cleanup_failure", finalMessageID: "msg_terminal" })
      },
      runDetached: async (run) => {
        detachedOwner += 1
        if (detachedOwner !== 2) return await run()
        await run()
        throw new Error("pipeline owner cleanup failed")
      },
      runDetachedRecovery: (run) => {
        recoveryOwner += 1
        return run()
      },
      committedLineage: Promise.resolve({
        sessionID: "ses_owner_cleanup_failure",
        artifactID: "artifact_owner_cleanup_failure",
      }),
      async deliver() {
        delivered()
      },
      onDeliveryFailure({ error }) {
        throw error
      },
      onPipelineOwnerCleanupFailure({ error }) {
        recovered(error)
      },
    })
    expect(receipt.kind).toBe("accepted")
    releaseWorker()
    await delivery
    expect(await recovery).toMatchObject({ name: "Error", message: "pipeline owner cleanup failed" })
    await waitForDetachedDispatchPipelinesForTest()
    expect(detachedOwner).toBe(2)
    expect(recoveryOwner).toBe(1)
  })

  test("keeps the execution observer through two delivery-owner initialization failures", async () => {
    let releaseWorker!: () => void
    const workerReleased = new Promise<void>((resolve) => (releaseWorker = resolve))
    let detachedOwner = 0
    let recoveryOwner = 0
    let delivered!: (kind: string) => void
    const delivery = new Promise<string>((resolve) => (delivered = resolve))
    const receipt = await detachDispatchExecution({
      execute: async () => {
        await workerReleased
        return DispatchOutcome.terminal({ sessionID: "ses_two_owner_failures", finalMessageID: "msg_terminal" })
      },
      runDetached: (run) => {
        detachedOwner += 1
        if (detachedOwner === 2 || detachedOwner === 3) {
          return Promise.reject(new Error(`pipeline delivery owner ${detachedOwner} initialization failed`))
        }
        return run()
      },
      runDetachedRecovery: (run) => {
        recoveryOwner += 1
        return run()
      },
      committedLineage: Promise.resolve({
        sessionID: "ses_two_owner_failures",
        artifactID: "artifact_two_owner_failures",
      }),
      async deliver({ outcome }) {
        delivered(outcome?.kind ?? "missing")
      },
      onDeliveryFailure({ error }) {
        throw error
      },
      onPipelineOwnerCleanupFailure({ error }) {
        throw error
      },
    })
    expect(receipt.kind).toBe("accepted")
    releaseWorker()
    expect(await delivery).toBe("terminal_success")
    await waitForDetachedDispatchPipelinesForTest()
    expect(detachedOwner).toBe(3)
    expect(recoveryOwner).toBe(1)
  })

  test("publishes recovery-owner cleanup failure after preserving the original terminal outcome", async () => {
    let releaseWorker!: () => void
    const workerReleased = new Promise<void>((resolve) => (releaseWorker = resolve))
    let detachedOwner = 0
    let recoveryOwner = 0
    let delivered!: (kind: string) => void
    const delivery = new Promise<string>((resolve) => (delivered = resolve))
    let recovered!: (error: unknown) => void
    const recovery = new Promise<unknown>((resolve) => (recovered = resolve))
    const receipt = await detachDispatchExecution({
      execute: async () => {
        await workerReleased
        return DispatchOutcome.terminal({ sessionID: "ses_recovery_cleanup_failure", finalMessageID: "msg_terminal" })
      },
      runDetached: (run) => {
        detachedOwner += 1
        if (detachedOwner === 2 || detachedOwner === 3) {
          return Promise.reject(new Error(`pipeline delivery owner ${detachedOwner} initialization failed`))
        }
        return run()
      },
      runDetachedRecovery: async (run) => {
        recoveryOwner += 1
        await run()
        if (recoveryOwner === 1) throw new Error("recovery owner cleanup failed")
      },
      committedLineage: Promise.resolve({
        sessionID: "ses_recovery_cleanup_failure",
        artifactID: "artifact_recovery_cleanup_failure",
      }),
      async deliver({ outcome }) {
        delivered(outcome?.kind ?? "missing")
      },
      onDeliveryFailure({ error }) {
        throw error
      },
      onPipelineOwnerCleanupFailure({ error }) {
        recovered(error)
      },
    })
    expect(receipt.kind).toBe("accepted")
    releaseWorker()
    expect(await delivery).toBe("terminal_success")
    expect(await recovery).toMatchObject({ name: "Error", message: "recovery owner cleanup failed" })
    await waitForDetachedDispatchPipelinesForTest()
    expect(detachedOwner).toBe(3)
    expect(recoveryOwner).toBe(2)
  })
})
