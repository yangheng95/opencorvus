import { afterEach, describe, expect, test } from "bun:test"
import { ChannelIngress, ChannelIngressInput, ChannelIngressOutcomeUnknownError } from "@/channel/ingress"
import { ChannelIngressAcceptedTable, ChannelIngressOutcomeTable } from "@/channel/channel.sql"
import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Channel ingress fact storage", () => {
  test("the public input requires a stable external request identity", () => {
    const parsed = ChannelIngressInput.safeParse({
      platform: "slack",
      channel: "channel-1",
      thread: "thread-1",
      text: "status",
    })
    expect(parsed.success ? undefined : parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })))
      .toEqual([{ path: ["request_id"], code: "invalid_type" }])
  })

  test("a settled ingress ends its effect lease with its outcome receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = {
          platform: "slack" as const,
          channel: "channel-settled",
          thread: "thread-settled",
          text: "status",
          request_id: "channel-request-settled",
          allow_create: false,
        }
        await expect(ChannelIngress.message(input)).resolves.toBeDefined()
        const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!
        expect(Database.use((db) => db.select().from(ChannelIngressOutcomeTable).all())).toHaveLength(1)
        // The outcome receipt is terminal, so the request's effect owner ends
        // with it and the request is immediately claimable again.
        const lease = Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id))!
        expect(lease.expires_at).toBeLessThanOrEqual(Date.now())
      },
    })
  })

  test("a crash after the effect remains unknown until an exact outcome is reconciled", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = {
          platform: "slack" as const,
          channel: "channel-1",
          thread: "thread-1",
          text: "status",
          request_id: "channel-request-1",
          allow_create: false,
        }
        using _crash = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
          throw new Error("injected crash after Channel effect")
        })
        await expect(ChannelIngress.message(input)).rejects.toThrow("injected crash")
        expect(Database.use((db) => ({
          accepted: db.select().from(ChannelIngressAcceptedTable).all().length,
          outcomes: db.select().from(ChannelIngressOutcomeTable).all().length,
        }))).toEqual({ accepted: 1, outcomes: 0 })
        expect(Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get()?.input)).toEqual({
          channel: "channel-1",
          thread: "thread-1",
          text: "status",
          allow_create: false,
          allow_session_mutation: false,
          bind: true,
          attachments: [],
        })
        _crash[Symbol.dispose]()

        await expect(ChannelIngress.message(input)).rejects.toBeInstanceOf(ChannelIngressOutcomeUnknownError)
        const reconciled = ChannelIngress.reconcile({
          platform: "slack",
          requestID: input.request_id,
          result: { kind: "panel_response", message: "No task is bound to this channel thread. Start a new thread to create a task." },
        })
        await expect(ChannelIngress.message(input)).resolves.toEqual(reconciled)
        expect(Database.use((db) => db.select().from(ChannelIngressOutcomeTable).all())).toHaveLength(1)
      },
    })
  })
})
