import { afterEach, describe, expect, test } from "bun:test"
import { ChannelIngress, ChannelIngressInput, ChannelIngressOutcomeUnknownError } from "@/channel/ingress"
import { ChannelIngressAcceptedTable, ChannelIngressOutcomeTable } from "@/channel/channel.sql"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { Project } from "@/project/project"
import { Identifier } from "@/id/id"
import { Server } from "@/server/server"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import z from "zod"
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
    expect(
      parsed.success ? undefined : parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
    ).toEqual([{ path: ["request_id"], code: "invalid_type" }])
  })

  test("an ingress without a bound Task commits its result with the original input", async () => {
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
        const result = await ChannelIngress.message(input)
        const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!
        const outcome = Database.use((db) => db.select().from(ChannelIngressOutcomeTable).get())!
        expect({
          result: outcome.result,
          source: outcome.request_id,
          time: outcome.time_created,
          generation: accepted.project_generation,
        }).toEqual({
          result,
          source: accepted.id,
          time: accepted.time_created,
          generation: Project.occurrence(Instance.project.id)!.generation,
        })
        await expect(ChannelIngress.message(input)).resolves.toEqual(result)
      },
    })
  })

  test("an old input with unknown effect exposes the original review evidence", async () => {
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
        const original = {
          channel: "channel-1",
          thread: "thread-1",
          text: "status",
          allow_create: false,
          allow_session_mutation: false,
          bind: true,
          attachments: [],
        }
        const acceptedID = Identifier.deterministic(
          "call",
          `channel-ingress\0${Instance.project.id}\0slack\0${input.request_id}`,
        )
        Database.immediateTransaction((db) =>
          db
            .insert(ChannelIngressAcceptedTable)
            .values({
              id: acceptedID,
              project_id: Instance.project.id,
              platform: "slack",
              request_id: input.request_id,
              input: original,
              time_created: 1234,
            })
            .run(),
        )
        const error = await ChannelIngress.message(input).catch((error) => error)
        expect(error).toBeInstanceOf(ChannelIngressOutcomeUnknownError)
        expect(error.toObject()).toMatchObject({
          name: "ChannelIngressOutcomeUnknownError",
          data: {
            code: "CHANNEL_INGRESS_OUTCOME_UNKNOWN",
            diagnostic: {
              acceptedID,
              owner: "unknown",
              effect: null,
              acceptedAt: 1234,
              body: {
                field: "input",
                encoding: "base64",
                data: Buffer.from(JSON.stringify(original)).toString("base64"),
              },
            },
          },
        })
        expect(Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!.input).toEqual(original)
        const response = await Server.App().request("/channel/message", {
          method: "POST",
          headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
          body: JSON.stringify(input),
        })
        expect({ status: response.status, body: await response.json() }).toMatchObject({
          status: 409,
          body: {
            name: "ChannelIngressOutcomeUnknownError",
            data: {
              code: "CHANNEL_INGRESS_OUTCOME_UNKNOWN",
              diagnostic: {
                acceptedID,
                owner: "unknown",
                body: {
                  field: "input",
                  encoding: "base64",
                  data: Buffer.from(JSON.stringify(original)).toString("base64"),
                },
              },
            },
          },
        })
      },
    })
  })

  test("the real HTTP evidence reader pages exact original JSON bytes and complete causal source history", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const requestID = "paged-original-channel"
        const acceptedID = Identifier.deterministic(
          "call",
          `channel-ingress\0${Instance.project.id}\0slack\0${requestID}`,
        )
        const original = {
          channel: "large-source",
          thread: "original-thread",
          text: "原始🧭输入".repeat(2000),
          allow_create: false,
          allow_session_mutation: false,
          bind: true,
          attachments: [{ filename: "literal.txt", mime: "text/plain", data: "YQ==".repeat(5000) }],
        }
        const event = BusEvent.define("test.channel.evidence-original-source", z.object({ ordinal: z.number().int() }))
        Database.immediateTransaction((db) => {
          db.insert(ChannelIngressAcceptedTable)
            .values({
              id: acceptedID,
              project_id: Instance.project.id,
              platform: "slack",
              request_id: requestID,
              input: original,
              time_created: 1000,
            })
            .run()
        })
        const publications = Bus.withCausation({ source: "channel.ingress", occurrenceID: acceptedID }, () =>
          Database.immediateTransaction(() =>
            Array.from({ length: 37 }, (_, ordinal) => Bus.publishOwnedInTransaction(event, { ordinal })),
          ),
        )
        const buffers: Buffer[] = [],
          sources: string[] = []
        let byteOffset: number | null = 0,
          afterSource: string | undefined
        while (byteOffset !== null) {
          const response = await Server.App().request(`/channel/message/slack/${requestID}?byteOffset=${byteOffset}`, {
            headers: { "x-opencorvus-directory": project.path },
          })
          expect(response.status).toBe(200)
          const page = (await response.json()) as any
          expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(32768)
          buffers.push(Buffer.from(page.body.data, "base64"))
          byteOffset = page.body.nextByteOffset
        }
        do {
          const query = new URLSearchParams({ limit: "16", ...(afterSource ? { afterSource } : {}) })
          const response = await Server.App().request(`/channel/message/slack/${requestID}?${query}`, {
            headers: { "x-opencorvus-directory": project.path },
          })
          expect(response.status).toBe(200)
          const page = (await response.json()) as any
          sources.push(...page.sourceOccurrences.map((source: any) => source.occurrenceID))
          afterSource = page.nextSource ?? undefined
        } while (afterSource)
        expect({ originalBytes: Buffer.concat(buffers).toString("utf8"), sources }).toEqual({
          originalBytes: JSON.stringify(original),
          sources: publications.map((publication) => publication.occurrenceID).sort(),
        })
      },
    })
  })
})
