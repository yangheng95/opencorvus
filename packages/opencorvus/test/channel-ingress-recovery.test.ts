import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { ChannelIngress, ChannelIngressOwnerConflictError, ChannelIngressProcessingError } from "@/channel/ingress"
import { ChannelIngressAcceptedTable, ChannelIngressOutcomeTable } from "@/channel/channel.sql"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Config } from "@/config/config"
import {
  ControlLeaseFenceLostError,
  acquireControlLeaseInTransaction,
  currentControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
} from "@/engine/control-lease"
import { findInteractionByExternal } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { PermissionAuthority } from "@/permission/authority"
import { readPermissionRequestFacts } from "@/permission/ledger-facts"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { deleteProject } from "@/project/delete"
import { Question } from "@/question"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { withTimeout } from "@/util/await-with-timeout"
import { ControlMessage } from "@/control/message"
import type { Message } from "@/session/message"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"
import { insertEngineInteractionRequest } from "@/engine/interaction-request"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

const channel = { platform: "slack" as const, channel: "recovery-channel", thread: "recovery-thread" }

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function taskFixture() {
  EngineService.init()
  const revision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "channel-recovery",
    version: "2026.10.24.1",
    packageDigest: "a".repeat(64),
  }
  const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Channel recovery" })
  const taskID = Identifier.ascending("task"),
    now = Date.now()
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Channel recovery",
    request: "Original Channel request",
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    channelBinding: channel,
    projectID: Instance.project.id,
    packageRevision: revision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: revision.packageDigest,
      timeCreated: now,
    }),
  })
  return { root, taskID }
}

async function waitForPending(requestID: string) {
  const deadline = Date.now() + 10_000
  while (findInteractionByExternal(requestID)?.status !== "pending") {
    if (Date.now() > deadline) throw new Error("Original Asked projection timed out")
    await Bun.sleep(10)
  }
}

describe("Channel original effect recovery", () => {
  test("a direct Task activity acknowledgement recovers its actual immutable Interaction outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root, taskID } = await taskFixture()
        // Only the durable gate is prepared here. This verifies the production
        // acknowledgement and receipt, not an actual unknown Provider activity.
        const interactionID = Database.immediateTransaction((db) =>
          insertEngineInteractionRequest(db, {
            taskID,
            sessionID: root.id,
            externalID: "direct-activity-reconciliation",
            requestType: "question",
            title: "Actual activity acknowledgement",
            body: "Confirm unknown result",
            payload: {
              activity_reconciliation: {
                ingress_id: "fixture-ingress",
                request_id: "fixture-request",
                assistant_message_id: "fixture-message",
              },
            },
            eventSource: "task-control.activity-reconciliation",
            eventSummary: "Prepare direct acknowledgement gate",
          }),
        )
        const input = {
          ...channel,
          text: "acknowledge_unknown",
          request_id: "direct-activity-gap",
          allow_create: false,
        }
        using hook = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
          throw new Error("actual direct acknowledgement receipt gap")
        })
        const interrupted = await ChannelIngress.message(input).catch((error) => error)
        expect(interrupted).toBeInstanceOf(Error)
        expect((interrupted as Error).message).toBe("actual direct acknowledgement receipt gap")
        hook[Symbol.dispose]()
        const original = Database.allFinalized("SELECT rowid AS __rowid,* FROM engine_interaction_outcome")
        expect(findInteractionByExternal("direct-activity-reconciliation")).toMatchObject({
          id: interactionID,
          status: "answered",
          response: {
            answers: [["acknowledge_unknown"]],
            user_input: { surface: "channel.question", text: input.text, structured: { message: input.text } },
          },
        })
        const result = await ChannelIngress.message(input)
        expect(result).toEqual({
          kind: "interaction",
          message: "Answer recorded.",
          task_id: taskID,
          interaction_id: interactionID,
        })
        expect(Database.allFinalized("SELECT rowid AS __rowid,* FROM engine_interaction_outcome")).toEqual(original)
        expect(Database.use((db) => db.select().from(ChannelIngressOutcomeTable).get())!.result).toEqual(result)
      },
    })
  })

  test("a real older process context returns explicit ownership errors after formal Project recreation", async () => {
    await using project = await memoryProject("channel-real-stale-context")
    const root = await createManagedTemporaryDirectory(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "channel-generation-")
    const child = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "fixture/channel-generation-child.ts"), project.path, root],
      {
        cwd: path.join(import.meta.dir, ".."),
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const stdout = new Response(child.stdout).text(),
      stderr = new Response(child.stderr).text()
    try {
      const deadline = Date.now() + 30_000
      while (
        !(await fs.stat(path.join(root, "ready.json")).then(
          () => true,
          () => false,
        ))
      ) {
        if (Date.now() > deadline || child.exitCode !== null)
          throw new Error("Older process did not reach the original context barrier")
        await Bun.sleep(10)
      }
      const original = JSON.parse(await fs.readFile(path.join(root, "ready.json"), "utf8"))
      const deletion = await deleteProject(Project.get(original.projectID)!, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "delete-channel-original-context",
        reason: "Isolated cross-process occurrence contract",
      })
      expect(deletion.status).toBe("committed")
      let current!: string
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          current = Instance.projectGeneration
          const result = await ChannelIngress.message({
            platform: "slack",
            channel: "stale-context",
            thread: "stale-context",
            text: "status",
            request_id: "new-context-source",
            allow_create: false,
          })
          expect(result.kind).toBe("panel_response")
        },
      })
      await fs.writeFile(path.join(root, "release"), "formal recreation and current source committed")
      const [exit, output, errors] = await Promise.all([child.exited, stdout, stderr])
      expect(exit, errors).toBe(0)
      const observed = JSON.parse(output.trim().split(/\r?\n/).at(-1)!)
      expect(observed.replay).toMatchObject({
        status: "error",
        error: { name: "ChannelIngressOwnerConflictError", data: { code: "CHANNEL_INGRESS_OWNER_CONFLICT" } },
      })
      expect(observed.fresh).toMatchObject({
        status: "error",
        error: {
          name: "ChannelIngressProjectContextConflictError",
          data: {
            code: "CHANNEL_INGRESS_PROJECT_CONTEXT_CONFLICT",
            projectID: original.projectID,
            contextGeneration: original.generation,
            currentGeneration: current,
          },
        },
      })
      expect(observed.accepted).toEqual([
        { request_id: "new-context-source", project_generation: current },
        { request_id: "old-context-source", project_generation: original.generation },
      ])
      expect(new Set([current, original.generation]).size).toBe(2)
    } finally {
      if (child.exitCode === null) child.kill()
      await child.exited
      await removeManagedDirectoryTree(root)
    }
  }, 60_000)

  test("a real Question reply recovers its receipt from its exact source after interruption", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root, taskID } = await taskFixture()
        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: root.id,
          requestID,
          questions: [{ header: "Recovery", question: "Choose", options: [] }],
        })
        await waitForPending(requestID)
        const interaction = findInteractionByExternal(requestID)!
        const input = {
          ...channel,
          text: "literal original answer",
          request_id: "question-effect-gap",
          allow_create: false,
        }
        using hook = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
          throw new Error("actual Channel post-effect interruption")
        })
        const interrupted = await ChannelIngress.message(input).catch((error) => error)
        expect(interrupted).toBeInstanceOf(Error)
        expect((interrupted as Error).message).toBe("actual Channel post-effect interruption")
        hook[Symbol.dispose]()
        await expect(waiting).resolves.toEqual([[input.text]])
        const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!
        const terminal = Database.use((db) =>
          db
            .select()
            .from(BusPublicationOutboxTable)
            .where(eq(BusPublicationOutboxTable.event_type, "question.replied"))
            .get(),
        )!
        expect({ effect: accepted.effect, causation: terminal.causation }).toEqual({
          effect: {
            kind: "interaction",
            interactionID: interaction.id,
            taskID,
            sessionID: root.id,
            requestID,
            type: "question",
          },
          causation: { source: "channel.ingress", occurrenceID: accepted.id },
        })
        const result = {
          kind: "interaction",
          message: "Answer recorded.",
          task_id: taskID,
          interaction_id: interaction.id,
        }
        await expect(ChannelIngress.message(input)).resolves.toEqual(result)
        await expect(ChannelIngress.recover({ platform: "slack", requestID: input.request_id })).resolves.toEqual(
          result,
        )
        const outcome = Database.use((db) => db.select().from(ChannelIngressOutcomeTable).get())!
        expect({
          id: outcome.request_id,
          result: outcome.result,
          original: Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get()),
        }).toEqual({ id: accepted.id, result, original: accepted })
        expect(
          Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id))!.expires_at,
        ).toBeLessThanOrEqual(Date.now())
      },
    })
  })

  test("Permission original execution remains once while the Channel receipt recovers", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const { root, taskID } = await taskFixture()
        const asked = Promise.withResolvers<PermissionAuthority.Request>()
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, (event) => {
          asked.resolve(event.properties)
        })
        let executions = 0
        const execution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: root.id,
            messageID: Identifier.ascending("message"),
            toolCallID: Identifier.ascending("part"),
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.invalid/channel-recovery" },
          },
          async () => {
            executions++
            return "actual local callback"
          },
        )
        void execution.catch(() => undefined)
        try {
          const request = await withTimeout(asked.promise, 10_000, "Permission Asked")
          const input = { ...channel, text: "allow", request_id: "permission-effect-gap", allow_create: false }
          using hook = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
            throw new Error("actual Permission Channel gap")
          })
          const interrupted = await ChannelIngress.message(input).catch((error) => error)
          expect(interrupted).toBeInstanceOf(Error)
          expect((interrupted as Error).message).toBe("actual Permission Channel gap")
          hook[Symbol.dispose]()
          await expect(execution).resolves.toBe("actual local callback")
          const originalFacts = Database.use((db) => readPermissionRequestFacts(db, request.id))!
          const interaction = findInteractionByExternal(request.id)!
          await expect(ChannelIngress.message(input)).resolves.toEqual({
            kind: "interaction",
            message: "Permission granted (once).",
            task_id: taskID,
            interaction_id: interaction.id,
          })
          expect({ executions, facts: Database.use((db) => readPermissionRequestFacts(db, request.id))!.rows }).toEqual(
            { executions: 1, facts: originalFacts.rows },
          )
        } finally {
          stop()
          await PermissionAuthority.cancelPendingForSession(root.id, "Probe cleanup")
          await Promise.allSettled([execution])
        }
      },
    })
  })

  test("a completed effect obtains a current settlement lease after its unchanged original lease expires", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root } = await taskFixture()
        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: root.id,
          requestID,
          questions: [{ header: "Lease", question: "Choose", options: [] }],
        })
        await waitForPending(requestID)
        let originalLeaseID!: string
        let restoreClock: (() => void) | undefined
        using hook = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
          Database.use((db) => {
            const accepted = db.select().from(ChannelIngressAcceptedTable).get()!
            const lease = currentControlLeaseInTransaction(db, "effect", accepted.id)!
            originalLeaseID = lease.id
            const clock = spyOn(Date, "now").mockReturnValue(lease.expires_at + 1)
            restoreClock = () => clock.mockRestore()
          })
        })
        let result: Awaited<ReturnType<typeof ChannelIngress.message>>
        try {
          result = await ChannelIngress.message({
            ...channel,
            text: "actual completed answer",
            request_id: "ended-original-lease",
            allow_create: false,
          })
        } finally {
          restoreClock?.()
        }
        await expect(waiting).resolves.toEqual([["actual completed answer"]])
        const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!
        const current = Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id))!
        expect({
          result: Database.use((db) => db.select().from(ChannelIngressOutcomeTable).get())!.result,
          admitted: current.time_activated >= accepted.time_created,
          prior: originalLeaseID,
        }).toEqual({ result, admitted: true, prior: expect.any(String) })
        const history = Database.allFinalized<any>(
          "SELECT id,target_id FROM engine_control_activation_lease ORDER BY rowid",
        )
          .filter((row) => row.target_id === accepted.id)
          .map((row) => row.id)
        expect({ history, releasedAt: current.expires_at }).toEqual({
          history: [originalLeaseID, current.id],
          releasedAt: Database.use((db) => db.select().from(ChannelIngressOutcomeTable).get())!.time_created,
        })
      },
    })
  })

  test("a live original process owns its in-flight receipt until its actual callback settles", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root } = await taskFixture()
        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: root.id,
          requestID,
          questions: [{ header: "Concurrent", question: "Choose", options: [] }],
        })
        await waitForPending(requestID)
        const input = { ...channel, text: "one answer", request_id: "live-effect-owner", allow_create: false }
        const first = ChannelIngress.message(input)
        const second = await ChannelIngress.message(input).catch((error) => error)
        expect(second).toBeInstanceOf(ChannelIngressProcessingError)
        expect(second.toObject()).toMatchObject({
          data: { code: "CHANNEL_INGRESS_PROCESSING", diagnostic: { owner: "current", requestID: input.request_id } },
        })
        const result = await first
        await expect(waiting).resolves.toEqual([[input.text]])
        await expect(ChannelIngress.message(input)).resolves.toEqual(result)
      },
    })
  })

  test("ordinary replay observes a live process even when its original grant deadline has passed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root } = await taskFixture()
        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: root.id,
          requestID,
          questions: [{ header: "Physical owner", question: "Choose", options: [] }],
        })
        await waitForPending(requestID)
        const input = {
          ...channel,
          text: "the only actual answer",
          request_id: "live-expired-grant",
          allow_create: false,
        }
        using before = ChannelIngress.TestHooks.replaceBeforeEffect(async () => {
          const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!
          const lease = Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id))!
          using clock = spyOn(Date, "now").mockReturnValue(lease.expires_at + 1)
          const result = await ChannelIngress.message(input).catch((error) => error)
          expect(result).toBeInstanceOf(ChannelIngressProcessingError)
          expect(result.toObject()).toMatchObject({
            data: {
              code: "CHANNEL_INGRESS_PROCESSING",
              diagnostic: { lease: { id: lease.id, owner_occurrence_id: lease.owner_occurrence_id } },
            },
          })
        })
        const result = await ChannelIngress.message(input)
        await expect(waiting).resolves.toEqual([[input.text]])
        expect(Database.use((db) => db.select().from(ChannelIngressOutcomeTable).get())!.result).toEqual(result)
      },
    })
  })

  test("a superseded original writer receives the typed fence contract and the current owner recovers the true result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root, taskID } = await taskFixture()
        const requestID = Identifier.ascending("question")
        const waiting = Question.ask({
          sessionID: root.id,
          requestID,
          questions: [{ header: "Fence", question: "Choose", options: [] }],
        })
        await waitForPending(requestID)
        let replacement!: { id: string; owner_occurrence_id: string }
        using after = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
          Database.immediateTransaction((db) => {
            const accepted = db.select().from(ChannelIngressAcceptedTable).get()!
            const original = currentControlLeaseInTransaction(db, "effect", accepted.id)!
            const now = Date.now()
            releaseControlLeaseInTransaction(db, {
              target: "effect",
              targetID: accepted.id,
              leaseID: original.id,
              ownerOccurrenceID: original.owner_occurrence_id,
              now,
            })
            const claim = acquireControlLeaseInTransaction(db, {
              target: "effect",
              targetID: accepted.id,
              ownerOccurrenceID: original.owner_occurrence_id,
              now,
              leaseMilliseconds: 120_000,
            })
            if (!claim.acquired) throw new Error("Actual replacement lease was not acquired")
            replacement = claim.lease
          })
        })
        const input = {
          ...channel,
          text: "original settled answer",
          request_id: "superseded-channel-writer",
          allow_create: false,
        }
        // Await the actual operation before entering the synchronous matcher.
        // This Bun version's native rejects.toBeInstanceOf spins after the
        // preceding clock-spy case and starves the delivery commit timers.
        const fenced = await ChannelIngress.message(input).catch((error) => error)
        expect(fenced).toBeInstanceOf(ControlLeaseFenceLostError)
        after[Symbol.dispose]()
        await expect(waiting).resolves.toEqual([[input.text]])
        const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).get())!
        expect(Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id))!.id).toBe(
          replacement.id,
        )
        Database.immediateTransaction((db) =>
          releaseControlLeaseInTransaction(db, {
            target: "effect",
            targetID: accepted.id,
            leaseID: replacement.id,
            ownerOccurrenceID: replacement.owner_occurrence_id,
            now: Date.now(),
          }),
        )
        await expect(ChannelIngress.message(input)).resolves.toEqual({
          kind: "interaction",
          message: "Answer recorded.",
          task_id: taskID,
          interaction_id: findInteractionByExternal(requestID)!.id,
        })
      },
    })
  })

  test("Permission recovery returns the real competing operator's winning decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const { root, taskID } = await taskFixture()
        const asked = Promise.withResolvers<PermissionAuthority.Request>()
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, (event) => {
          asked.resolve(event.properties)
        })
        const execution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: root.id,
            messageID: Identifier.ascending("message"),
            toolCallID: Identifier.ascending("part"),
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.invalid/competing-channel-decision" },
          },
          async () => "authorized local callback",
        )
        void execution.catch(() => undefined)
        try {
          const request = await withTimeout(asked.promise, 10_000, "Competing Permission Asked")
          using before = ChannelIngress.TestHooks.replaceBeforeEffect(async () => {
            await PermissionAuthority.reply({
              requestID: request.id,
              decision: "deny",
              actorID: "actual-other-operator",
              autoReply: false,
            })
          })
          using after = ChannelIngress.TestHooks.replaceAfterEffectBeforeOutcome(() => {
            throw new Error("competing winner after-effect gap")
          })
          const input = { ...channel, text: "always", request_id: "channel-competing-winner", allow_create: false }
          const interrupted = await ChannelIngress.message(input).catch((error) => error)
          expect(interrupted).toBeInstanceOf(Error)
          expect((interrupted as Error).message).toBe("competing winner after-effect gap")
          before[Symbol.dispose]()
          after[Symbol.dispose]()
          const rejection = await execution.catch((error) => error)
          expect(rejection).toBeInstanceOf(PermissionAuthority.RejectedError)
          const interaction = findInteractionByExternal(request.id)!
          const facts = Database.use((db) => readPermissionRequestFacts(db, request.id))!
          expect({ status: interaction.status, winner: facts.authority!.actor_id, decision: facts.decision }).toEqual({
            status: "rejected",
            winner: "actual-other-operator",
            decision: "deny",
          })
          await expect(ChannelIngress.message(input)).resolves.toEqual({
            kind: "interaction",
            message: "Permission rejected.",
            task_id: taskID,
            interaction_id: interaction.id,
          })
        } finally {
          stop()
          await PermissionAuthority.cancelPendingForSession(root.id, "Competing probe cleanup")
          await Promise.allSettled([execution])
        }
      },
    })
  })

  test("Control recovery reads the exact persisted completed turn through the shared result projection", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        // This is a focused persistent-fact projection contract. These authored
        // fixture messages are not claimed as a real model execution.
        const causation = { source: "channel.ingress", occurrenceID: Identifier.ascending("call") }
        let session!: Session.Info, userID!: string, replyID!: string
        await Bus.withCausation(causation, async () => {
          session = await Session.create({ kind: "assistant", title: "Original Control request" })
          userID = Identifier.ascending("message")
          replyID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: userID,
              sessionID: session.id,
              role: "user",
              author: "user",
              agent: "control",
              model: { providerID: "test", modelID: "control-projection" },
              time: { created: Date.now() },
            },
            parts: [],
          })
          const reply: Message.Assistant = {
            id: replyID,
            sessionID: session.id,
            role: "assistant",
            author: "control",
            agent: "control",
            parentID: userID,
            modelID: "control-projection",
            providerID: "test",
            cost: 0,
            path: { cwd: project.path, root: project.path },
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            finish: "stop",
            time: { created: Date.now(), completed: Date.now() },
          }
          await Session.persistMessage({ info: reply, parts: [] })
        })
        const later = Identifier.ascending("message")
        await Session.persistMessage({
          info: {
            id: later,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "control",
            model: { providerID: "test", modelID: "control-projection" },
            time: { created: Date.now() },
          },
          parts: [],
        })
        await Session.persistMessage({
          info: {
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "assistant",
            author: "control",
            agent: "control",
            parentID: later,
            modelID: "control-projection",
            providerID: "test",
            cost: 0,
            path: { cwd: project.path, root: project.path },
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            finish: "stop",
            time: { created: Date.now(), completed: Date.now() },
          },
          parts: [],
        })
        await expect(ControlMessage.recover({ projectID: Instance.project.id, causation })).resolves.toEqual({
          kind: "panel_response",
          message_id: replyID,
          control_session_id: session.id,
          tool_result_refs: [],
        })
      },
    })
  })

  test("Project deletion retains Channel facts and a recreated generation owns fresh requests", async () => {
    await using project = await memoryProject()
    const input = { ...channel, text: "status", request_id: "old-project-request", allow_create: false }
    let owner!: NonNullable<ReturnType<typeof Project.occurrence>>
    let original: unknown, outcome: unknown
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        owner = Project.occurrence(Instance.project.id)!
        await ChannelIngress.message(input)
        original = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).all())
        outcome = Database.use((db) => db.select().from(ChannelIngressOutcomeTable).all())
      },
    })
    const deletion = await deleteProject(owner.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "delete-channel-history",
      reason: "Delete isolated Channel Project",
    })
    expect({
      status: deletion.status,
      accepted: Database.use((db) => db.select().from(ChannelIngressAcceptedTable).all()),
      outcome: Database.use((db) => db.select().from(ChannelIngressOutcomeTable).all()),
    }).toEqual({ status: "committed", accepted: original, outcome })
    expect(
      ChannelIngress.inspect({ projectID: owner.project.id, platform: "slack", requestID: input.request_id }),
    ).toMatchObject({
      owner: "retired",
      projectGeneration: owner.generation,
      currentProjectGeneration: null,
      outcomeRecorded: true,
    })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const current = Project.occurrence(Instance.project.id)!
        const error = await ChannelIngress.message(input).catch((error) => error)
        expect(error).toBeInstanceOf(ChannelIngressOwnerConflictError)
        expect(error.toObject()).toMatchObject({
          data: {
            code: "CHANNEL_INGRESS_OWNER_CONFLICT",
            diagnostic: {
              projectGeneration: owner.generation,
              currentProjectGeneration: current.generation,
              owner: "retired",
            },
          },
        })
        const fresh = await ChannelIngress.message({ ...input, request_id: "new-project-request" })
        const accepted = Database.use((db) =>
          db
            .select()
            .from(ChannelIngressAcceptedTable)
            .where(eq(ChannelIngressAcceptedTable.request_id, "new-project-request"))
            .get(),
        )!
        expect({ id: current.project.id, generation: accepted.project_generation, result: fresh.kind }).toEqual({
          id: owner.project.id,
          generation: current.generation,
          result: "panel_response",
        })
      },
    })
  })
})
