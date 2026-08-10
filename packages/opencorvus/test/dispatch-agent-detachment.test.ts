import { describe, expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { detachDispatchExecution } from "@/orchestrator/dispatch-agent-tool"
import { Instance, runAsInstanceActivity } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

describe("dispatch_agent detached execution", () => {
  test("returns a committed acceptance receipt while delivering the later terminal outcome", async () => {
    let commitLineage!: (lineage: { sessionID: string; artifactID: string }) => void
    const committedLineage = new Promise<{ sessionID: string; artifactID: string }>((resolve) => (commitLineage = resolve))
    let finishWorker!: () => void
    const workerFinished = new Promise<void>((resolve) => (finishWorker = resolve))
    let delivered!: (value: { sessionID: string; kind: string }) => void
    const delivery = new Promise<{ sessionID: string; kind: string }>((resolve) => (delivered = resolve))
    const execution = async () => {
      await workerFinished
      return DispatchOutcome.terminal({ sessionID: "ses_detached_worker", finalMessageID: "msg_terminal" })
    }

    const receiptPromise = detachDispatchExecution({
      execution,
      committedLineage,
      runAsActivity: async (run) => await run(),
      async deliver({ sessionID, outcome }) {
        delivered({ sessionID, kind: outcome.kind })
      },
      onDeliveryFailure({ error }) {
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
    const committedLineage = new Promise<{ sessionID: string; artifactID: string }>((resolve) => (commitLineage = resolve))
    let failWorker!: (error: Error) => void
    const workerFailure = new Promise<never>((_resolve, reject) => (failWorker = reject))
    let delivered!: (value: { sessionID: string; errorName?: string }) => void
    const delivery = new Promise<{ sessionID: string; errorName?: string }>((resolve) => (delivered = resolve))

    const receiptPromise = detachDispatchExecution({
      execution: async () => await workerFailure,
      committedLineage,
      runAsActivity: async (run) => await run(),
      async deliver({ sessionID, executionError }) {
        delivered({ sessionID, errorName: executionError instanceof Error ? executionError.name : undefined })
      },
      onDeliveryFailure({ error }) {
        throw error
      },
    })
    commitLineage({ sessionID: "ses_failed_worker", artifactID: "artifact_failed_lineage" })
    expect((await receiptPromise).kind).toBe("accepted")
    failWorker(new TypeError("worker provider failed"))
    expect(await delivery).toEqual({ sessionID: "ses_failed_worker", errorName: "TypeError" })
  })

  test("keeps the owning Instance lease alive through detached terminal delivery", async () => {
    await using project = await memoryProject()
    let commitLineage!: (lineage: { sessionID: string; artifactID: string }) => void
    const committedLineage = new Promise<{ sessionID: string; artifactID: string }>((resolve) => (commitLineage = resolve))
    let finishWorker!: () => void
    const workerFinished = new Promise<void>((resolve) => (finishWorker = resolve))
    let acceptReceipt!: (kind: string) => void
    const accepted = new Promise<string>((resolve) => (acceptReceipt = resolve))
    let deliveredProject!: (projectID: string) => void
    const delivery = new Promise<string>((resolve) => (deliveredProject = resolve))
    let executedProject!: (projectID: string) => void
    const executionProject = new Promise<string>((resolve) => (executedProject = resolve))
    let expectedProjectID = ""

    const provider = Instance.provide({
      directory: project.path,
      fn: async () => {
        expectedProjectID = Instance.project.id
        const execution = async () => {
          await workerFinished
          executedProject(Instance.project.id)
          return DispatchOutcome.terminal({ sessionID: "ses_instance_worker", finalMessageID: "msg_terminal" })
        }
        const receipt = await detachDispatchExecution({
          execution,
          committedLineage,
          runAsActivity: runAsInstanceActivity,
          async deliver() {
            deliveredProject(Instance.project.id)
          },
          onDeliveryFailure({ error }) {
            throw error
          },
        })
        acceptReceipt(receipt.kind)
      },
    })

    commitLineage({ sessionID: "ses_instance_worker", artifactID: "artifact_instance_lineage" })
    expect(await accepted).toBe("accepted")
    finishWorker()
    expect(await executionProject).toBe(expectedProjectID)
    expect(await delivery).toBe(expectedProjectID)
    await provider
  })
})
