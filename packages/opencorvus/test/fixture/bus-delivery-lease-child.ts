import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Bus } from "../../src/bus"
import { BusEvent } from "../../src/bus/bus-event"
import { BusPublicationDeliveryReceiptTable } from "../../src/bus/bus.sql"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionTable } from "../../src/session/session.sql"
import { Database, eq } from "../../src/storage/db"
import { memoryProject } from "./memory"
import { EventService } from "../../src/scheduler/event-service"
import { EventJobFireTable } from "../../src/scheduler/event.sql"
import { SessionWake } from "../../src/session/wake"
import { Config } from "../../src/config/config"
import { installDefaultControlPlaneToolLoaders } from "../../src/tool/control-plane-tool-composition"

const [mode, root] = process.argv.slice(2)
const event = BusEvent.define("test.bus.terminal-before-lease", z.object({ sessionID: z.string(), title: z.string() }))
const sourceID = "original-terminal-before-lease"
const subscriberID = "test.original-title-consumer"
const meta = path.join(root!, "source.json")
let eventServer: ReturnType<typeof Bun.serve> | undefined
if (mode?.startsWith("event-")) {
  installDefaultControlPlaneToolLoaders()
  const prior = mode === "event-resume" ? JSON.parse(await fs.readFile(meta, "utf8")) : undefined
  eventServer = Bun.serve({
    hostname: "127.0.0.1",
    port: prior?.providerPort ?? 0,
    async fetch(request) {
      const body = (await request.json()) as any
      const { controlledMemoryReply, controlledProviderRequestKind } = await import("./controlled-streaming-provider")
      const content =
        controlledProviderRequestKind(body.messages ?? []) === "memory"
          ? controlledMemoryReply(body.messages)
          : "Actual Event target reply."
      const chunk = (delta: any, finish: any) =>
        `data: ${JSON.stringify({ id: "event-actual", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "event", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
      return new Response(
        chunk({ role: "assistant" }, null) + chunk({ content }, null) + chunk({}, "stop") + "data: [DONE]\n\n",
        { headers: { "content-type": "text/event-stream" } },
      )
    },
  })
}
if (mode === "event-prepare") {
  const fixture = await memoryProject("event-real-process-restart")
  await Instance.provide({
    directory: fixture.path,
    fn: async () => {
      await Config.updateProjectPatch({
        model: "event-current/event",
        provider: {
          "event-current": {
            name: "Actual local Event provider",
            npm: "@ai-sdk/openai-compatible",
            api: `http://127.0.0.1:${eventServer!.port}/v1`,
            models: {
              event: {
                name: "Actual Event streaming",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 1000000, output: 4096 },
              },
            },
          },
        },
      })
      const session = await Session.create({ kind: "assistant", title: "Actual Event target" })
      const job = await EventService.create({
        name: "Original Event consumer",
        eventType: event.type,
        prompt: "Original input",
        projectId: Instance.project.id,
        sessionId: session.id,
      })
      EventService.init({ sessionWake: SessionWake })
      EventService.TestHooks.installFireAcceptedHook(async () => {
        const fires = Database.use((db) =>
          db.select().from(EventJobFireTable).where(eq(EventJobFireTable.event_occurrence_id, sourceID)).all(),
        )
        await fs.writeFile(
          meta,
          JSON.stringify({
            directory: fixture.path,
            sessionID: session.id,
            projectID: Instance.project.id,
            jobID: job.id,
            providerPort: eventServer!.port,
            fires,
          }),
        )
        process.exit(23)
      })
      await Bus.publishOwnedExact(event, { sessionID: session.id, title: "Original Event source" }, sourceID).retry()
      throw new Error("actual Fire commit cut not reached")
    },
  })
} else if (mode === "event-resume") {
  const source = JSON.parse(await fs.readFile(meta, "utf8"))
  // The dead source's original delivery lease expires naturally. This probe
  // does not move a clock or forge a release on behalf of the failed process.
  const { EngineControlActivationLeaseTable } = await import("../../src/engine/engine.sql")
  const expiry = Database.use((db) => db.select().from(EngineControlActivationLeaseTable).all())
    .filter((row) => row.target === "bus_delivery" && row.target_id.startsWith(`${sourceID}\0`))
    .reduce((n, row) => Math.max(n, row.expires_at), 0)
  while (Date.now() <= expiry) await Bun.sleep(Math.min(100, expiry - Date.now() + 1))
  await Instance.provide({
    directory: source.directory,
    fn: async () => {
      EventService.remove(source.jobID, Instance.project.id)
      // First successor creates a real new definition. The original accepted
      // set is retained even though that definition would match today's source.
      if (!source.laterJobID) {
        const later = await EventService.create({
          name: "Later Event consumer",
          eventType: event.type,
          prompt: "Fresh input only",
          projectId: Instance.project.id,
          sessionId: source.sessionID,
        })
        source.laterJobID = later.id
        await fs.writeFile(meta, JSON.stringify(source))
      }
      EventService.init({ sessionWake: SessionWake })
      await Bus.publishOwnedExact(
        event,
        { sessionID: source.sessionID, title: "Original Event source" },
        sourceID,
      ).retry()
      await EventService.TestHooks.waitForIdle()
      const fires = Database.use((db) =>
        db.select().from(EventJobFireTable).where(eq(EventJobFireTable.event_occurrence_id, sourceID)).all(),
      )
      const projected = EventService.TestHooks.fires(Instance.project.id).map((fire) => ({
        id: fire.id,
        status: fire.status,
        disposition: fire.disposition,
      }))
      const receipts = Database.use((db) =>
        db
          .select({
            subscriber: BusPublicationDeliveryReceiptTable.subscriber_id,
            outcome: BusPublicationDeliveryReceiptTable.outcome,
          })
          .from(BusPublicationDeliveryReceiptTable)
          .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, sourceID))
          .all(),
      )
      console.log(JSON.stringify({ originalFires: source.fires, fires, projected, receipts }))
    },
  })
} else if (mode === "prepare") {
  const fixture = await memoryProject("same-source-two-process-lease")
  await Instance.provide({
    directory: fixture.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Original title" })
      Bus.publishOwnedExact(event, { sessionID: session.id, title: "Completed original title" }, sourceID)
      await fs.writeFile(meta, JSON.stringify({ directory: fixture.path, sessionID: session.id }))
    },
  })
} else {
  const source = JSON.parse(await fs.readFile(meta, "utf8"))
  await Instance.provide({
    directory: source.directory,
    fn: async () => {
      const stop = Bus.subscribe(
        event,
        async ({ properties }) => {
          Database.immediateTransaction((db) =>
            db
              .update(SessionTable)
              .set({ title: properties.title })
              .where(eq(SessionTable.id, properties.sessionID))
              .run(),
          )
          await fs.appendFile(
            path.join(root!, "actual-callbacks.jsonl"),
            `${JSON.stringify({ mode, sessionID: properties.sessionID, title: properties.title })}\n`,
          )
        },
        { durableID: subscriberID, effect: "idempotent_by_occurrence" },
      )
      const hook =
        mode === "paused"
          ? Bus.TestHooks.installBeforeDurableDeliveryLease(async (input) => {
              if (input.occurrenceID !== sourceID || input.subscriberID !== subscriberID) return
              await fs.writeFile(path.join(root!, "paused.ready"), "original read completed")
              const deadline = Date.now() + 30000
              while (
                !(await fs.stat(path.join(root!, "release")).then(
                  () => true,
                  () => false,
                ))
              ) {
                if (Date.now() > deadline) throw new Error("owned delivery lease barrier timed out")
                await Bun.sleep(10)
              }
            })
          : undefined
      try {
        await Bus.publishOwnedExact(
          event,
          { sessionID: source.sessionID, title: "Completed original title" },
          sourceID,
        ).retry()
        const receipt = Database.use((db) =>
          db
            .select({ outcome: BusPublicationDeliveryReceiptTable.outcome })
            .from(BusPublicationDeliveryReceiptTable)
            .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, sourceID))
            .all(),
        )
        console.log(JSON.stringify({ mode, receipt, title: (await Session.get(source.sessionID)).title }))
      } finally {
        hook?.[Symbol.dispose]()
        stop()
      }
    },
  })
}
if (eventServer) {
  const { Server } = await import("../../src/server/server")
  const settled = await Server.settleCurrentProcessExecution("Actual Event acceptance restart complete", {
    disposeInstances: () => Instance.disposeAll(),
    runtimeInactivityTimeoutMilliseconds: 30000,
  })
  await settled.releaseHandoff()
  await eventServer.stop(true)
} else {
  await Instance.disposeAll()
  await Bus.TestHooks.disposeOwnedState()
  await Database.awaitEffectIdle(60000)
}
Database.close()
