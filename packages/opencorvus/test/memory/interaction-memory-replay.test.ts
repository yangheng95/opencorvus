import { afterEach, expect, spyOn, test } from "bun:test"
import { Bus } from "@/bus"
import { BusPublicationDeliveryReceiptTable, BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Config } from "@/config/config"
import { findInteractionByExternal } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { ProjectMemory } from "@/memory/project-memory"
import { PermissionAuthority } from "@/permission/authority"
import { PermissionLedgerIntegrityError, readPermissionRequestFacts } from "@/permission/ledger-facts"
import { EngineInteractionRequestTable } from "@/engine/engine.sql"
import { insertEngineInteractionRequest } from "@/engine/interaction-request"
import { ensurePermissionInteractionInTransaction } from "@/permission/interaction-record"
import { Instance } from "@/project/instance"
import { Question } from "@/question"
import { PermissionRoutes } from "@/server/routes/permission"
import { QuestionRoutes } from "@/server/routes/question"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

async function waitFor(check: () => boolean, label: string) {
  const deadline = Date.now() + 15_000
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(label)
    await Bun.sleep(20)
  }
}

async function prepareTask(title: string) {
  const root = Session.prepareRootNext({
    kind: "root", directory: Instance.directory, title, metadata: { configOverlay: { model: null } },
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const packageRevision = {
    scope: "built_in" as const, projectID: null, namespace: "builtin", id: "interaction-memory-test",
    version: "2026.10.24.1", packageDigest: "b".repeat(64),
  }
  persistEstablishedTask({
    taskID, rootSession: root, now, title, request: "Preserve the original human decision.",
    productPillar: "work", source: "test", priority: "normal", metadata: { actor: "mission" },
    projectID: Instance.project.id, packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native", taskID, projectID: Instance.project.id, rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now,
    }),
  })
  return { root, taskID }
}

function executePermission(sessionID: string, suffix: string) {
  return PermissionAuthority.authorizeAndExecute({
    projectID: Instance.project.id, sessionID,
    messageID: `msg_memory_${suffix}`, toolCallID: `call_memory_${suffix}`,
    providerKind: "builtin", providerID: "builtin", toolName: "webfetch",
    args: { url: `https://example.test/${suffix}` },
  }, async () => "authorized original effect").catch(error => error)
}

async function pendingPermission(sessionID: string, suffix: string) {
  let receive!: (request: PermissionAuthority.Request) => void
  const asked = new Promise<PermissionAuthority.Request>(resolve => { receive = resolve })
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => receive(properties))
  const execution = executePermission(sessionID, suffix)
  const request = await asked
  stop()
  return { request, execution }
}

function permissionReply(requestID: string, decision: "allow_once" | "deny", message: string) {
  return PermissionRoutes().request(`/${requestID}/reply`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision, actorID: "operator", message }),
  })
}

function consume(projectID: string, occurrenceID: string, markdown: string, leaseID: string) {
  const snapshot = ProjectMemory.read(projectID)
  Database.immediateTransaction(db => {
    ProjectMemory.beginOrganizerAttemptInTransaction(db, {
      projectID, leaseID, expectedRevision: snapshot.revision, timeUpdated: Date.now(),
    })
    ProjectMemory.commitOrganizationInTransaction(db, {
      projectID, leaseID, baseRevision: snapshot.revision,
      coveredOccurrenceIDs: [occurrenceID], markdown, timeUpdated: Date.now() + 1,
    })
  })
}

for (const kind of ["question", "question-reject", "permission", "permission-deny"] as const) {
  test(`${kind} terminal redelivery preserves consumed memory and admits the next human occurrence`, async () => {
    await using project = await memoryProject(`interaction-memory-${kind}`)
    await Instance.provide({ directory: project.path, fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const { root, taskID } = await prepareTask(`Memory ${kind} recovery`)
      const isQuestion = kind === "question" || kind === "question-reject"
      const rejected = kind === "question-reject" || kind === "permission-deny"
      const subscriberID = isQuestion
        ? `engine.interaction.question-${rejected ? "rejected" : "replied"}`
        : "engine.interaction.permission-replied"
      const occurrences: string[] = []
      const markdown = `# Project context\n\nThe original ${kind} decision was consumed.\n`
      let terminal: { id: string; status: string; timeResolved: number | null } | undefined
      const subscribe = Bus.subscribe
      const subscribeInTransaction = Bus.subscribeInTransaction
      // Inject the interruption after the real subscriber's domain transaction,
      // before its Bus delivery receipt. Retry still uses the original outbox.
      const registration = isQuestion ? spyOn(Bus, "subscribe").mockImplementation(((definition: any, callback: any, options: any) => {
        if (options?.durableID !== subscriberID) return subscribe(definition, callback, options)
        return subscribe(definition, async (event: any) => {
          await callback(event)
          occurrences.push(event.occurrenceID)
          if (occurrences.length !== 1) return
          const interaction = findInteractionByExternal(event.properties.requestID)!
          terminal = { id: interaction.id, status: interaction.status, timeResolved: interaction.time_resolved }
          expect(ProjectMemory.pending(Instance.project.id).map(entry => ({ id: entry.occurrenceID, kind: entry.occurrenceKind })))
            .toEqual([{ id: interaction.id, kind: rejected ? "interaction_reject" : "interaction_reply" }])
          const snapshot = ProjectMemory.read(Instance.project.id)
          const leaseID = `consume-before-${kind}-receipt`
          Database.immediateTransaction(db => {
            ProjectMemory.beginOrganizerAttemptInTransaction(db, {
              projectID: Instance.project.id, leaseID, expectedRevision: snapshot.revision, timeUpdated: Date.now(),
            })
            ProjectMemory.commitOrganizationInTransaction(db, {
              projectID: Instance.project.id, leaseID, baseRevision: snapshot.revision,
              coveredOccurrenceIDs: [interaction.id], markdown, timeUpdated: Date.now() + 1,
            })
          })
          expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ revision: 1, content: markdown, pendingCount: 0 })
          throw new Error(`interrupted ${kind} subscriber after consuming its committed effect`)
        }, options)
      }) as typeof Bus.subscribe) : spyOn(Bus, "subscribeInTransaction").mockImplementation(((definition: any, callback: any, options: any) => {
        if (options?.durableID !== subscriberID) return subscribeInTransaction(definition, callback, options)
        return subscribeInTransaction(definition, (event, db) => {
          callback(event, db)
          occurrences.push(event.occurrenceID)
          const interaction = findInteractionByExternal(event.properties.requestID)!
          terminal = { id: interaction.id, status: interaction.status, timeResolved: interaction.time_resolved }
          if (occurrences.length === 1) {
            expect(ProjectMemory.pending(Instance.project.id).map(entry => entry.occurrenceID)).toEqual([interaction.id])
            throw new Error("interrupt SQL effect before its success receipt")
          }
        }, options)
      }) as typeof Bus.subscribeInTransaction)
      try {
        EngineService.init()
        let requestID: string
        let permissionExecution: Promise<unknown> | undefined
        let questionOutcome: Promise<unknown> | undefined
        if (isQuestion) {
          requestID = Identifier.ascending("question")
          questionOutcome = Question.ask({
            sessionID: root.id, requestID,
            questions: [{ header: "Decision", question: "Keep the original decision?", options: [] }],
          }).catch(error => error)
        } else {
          const pending = await pendingPermission(root.id, kind)
          permissionExecution = pending.execution
          requestID = pending.request.id
        }
        await waitFor(() => findInteractionByExternal(requestID)?.status === "pending", "original interaction admission")
        await waitFor(() => Bus.TestHooks.outbox().length === 0, "Asked publication receipt")
        const reply = () => isQuestion
          ? QuestionRoutes().request(`/${requestID}/${rejected ? "reject" : "reply"}`, {
              method: "POST", headers: { "content-type": "application/json" },
              ...(rejected ? {} : { body: JSON.stringify({ answers: [["Keep the original decision."]] }) }),
            })
          : permissionReply(requestID, rejected ? "deny" : "allow_once", "Keep the original decision.")
        expect((await reply()).status).toBe(500)
        await waitFor(() => occurrences.length === 2 && Bus.TestHooks.outbox().length === 0, "original terminal publication recovery")
        expect(occurrences).toEqual([occurrences[0]!, occurrences[0]!])
        const interaction = findInteractionByExternal(requestID)!
        expect({ id: interaction.id, status: interaction.status, timeResolved: interaction.time_resolved }).toEqual(terminal!)
        expect(interaction.status).toBe(rejected ? "rejected" : "answered")
        const receipts = Database.use(db => db.select().from(BusPublicationDeliveryReceiptTable)
          .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, occurrences[0]!)).all())
          .filter(receipt => receipt.subscriber_id === subscriberID)
        expect(receipts.map(receipt => receipt.outcome).sort()).toEqual(["failed", "succeeded"])
        if (!isQuestion) {
          consume(Instance.project.id, interaction.id, markdown, `consume-committed-${kind}`)
          const original = Database.use(db => db.select().from(BusPublicationOutboxTable)
            .where(eq(BusPublicationOutboxTable.occurrence_id, occurrences[0]!)).get())!
          await Bus.publishOwnedExact(PermissionAuthority.Event.Replied, original.properties as any, original.occurrence_id).retry()
          expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ revision: 1, content: markdown, pendingCount: 0 })
          expect(Database.use(db => db.select().from(BusPublicationDeliveryReceiptTable)
            .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, original.occurrence_id)).all())
            .filter(receipt => receipt.subscriber_id === subscriberID)).toEqual(receipts)
        }
        if (permissionExecution) {
          expect((await reply()).status).toBe(200)
          if (rejected) expect(await permissionExecution).toBeInstanceOf(PermissionAuthority.RejectedError)
          else expect(await permissionExecution).toBe("authorized original effect")
        }
        if (questionOutcome) expect(await questionOutcome).toBeInstanceOf(Error)

        const messageID = Identifier.ascending("message")
        const text = "A new human input after recovery."
        await Session.persistMessage({
          info: {
            id: messageID, sessionID: root.id, role: "user", author: "user", agent: "work",
            model: { providerID: "test", modelID: "memory-replay" }, time: { created: Date.now() },
            extra: ProjectMemory.userInputExtra({ surface: "test.human", literalText: text }),
          },
          parts: [{ id: Identifier.ascending("part"), messageID, sessionID: root.id, type: "text", text, kind: "user_content", source: "user" }],
        })
        expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ revision: 1, content: markdown, pendingCount: 1 })
        expect(ProjectMemory.pending(Instance.project.id).map(entry => ({ id: entry.occurrenceID, ownerID: entry.ownerID, text: entry.text })))
          .toEqual([{ id: messageID, ownerID: taskID, text }])
      } finally {
        registration.mockRestore()
      }
    } })
  })
}

test("an early human denial binds the original Permission interaction before late Asked projection", async () => {
  await using project = await memoryProject("early-permission-memory")
  await using other = await memoryProject("foreign-permission-memory")
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const { root, taskID } = await prepareTask("Early permission reply")
    let receive!: (request: PermissionAuthority.Request) => void
    const asked = new Promise<PermissionAuthority.Request>(resolve => { receive = resolve })
    let release!: () => void
    const delayed = new Promise<void>(resolve => { release = resolve })
    const subscribe = Bus.subscribe
    const registration = spyOn(Bus, "subscribe").mockImplementation(((definition: any, callback: any, options: any) => {
      if (options?.durableID !== "engine.interaction.permission-asked") return subscribe(definition, callback, options)
      return subscribe(definition, async (event: any) => {
        receive(event.properties)
        await delayed
        return callback(event)
      }, options)
    }) as typeof Bus.subscribe)
    try {
      EngineService.init()
      const execution = executePermission(root.id, "early-denial")
      const request = await asked
      expect(() => Database.immediateTransaction(db => {
        insertEngineInteractionRequest(db, {
          taskID, sessionID: root.id, externalID: request.id, requestType: "question",
          title: "Another interaction authority", body: "An exact source collision", payload: {},
          eventSource: "test.source-conflict", eventSummary: "Original conflicting authority",
        })
        ensurePermissionInteractionInTransaction(db, { request, projectID: Instance.project.id })
      })).toThrow(PermissionLedgerIntegrityError)
      await Instance.provide({ directory: other.path, fn: async () => {
        await expect(PermissionAuthority.replyUser({
          requestID: request.id, decision: "deny", actorID: "foreign-operator", message: "Foreign decision",
          userInput: { surface: "test.foreign", text: "Foreign decision" },
        })).rejects.toMatchObject({
          name: "PermissionLedgerIntegrityError", code: "PERMISSION_LEDGER_INTEGRITY",
          reason: "request_owner_conflict", field: "project_id",
        })
      } })
      expect((await permissionReply(request.id, "deny", "The human declines.")).status).toBe(200)
      const first = findInteractionByExternal(request.id)!
      expect(first).toMatchObject({ task_id: taskID, session_id: root.id, status: "rejected" })
      expect(ProjectMemory.pending(Instance.project.id).map(entry => ({ id: entry.occurrenceID, kind: entry.occurrenceKind, text: entry.text })))
        .toEqual([{ id: first.id, kind: "interaction_reject", text: "The human declines." }])
      consume(Instance.project.id, first.id, "# Context\n\nThe original denial was consumed.\n", "consume-before-late-Asked")
      release()
      expect(await execution).toBeInstanceOf(PermissionAuthority.RejectedError)
      await waitFor(() => Bus.TestHooks.outbox().length === 0, "late Asked projection")
      const facts = Database.use(db => readPermissionRequestFacts(db, request.id))!
      const rows = Database.use(db => db.select().from(EngineInteractionRequestTable)
        .where(eq(EngineInteractionRequestTable.source_id, facts.requested.id)).all())
      expect(rows.map(row => ({ id: row.id, kind: row.source_kind })))
        .toEqual([{ id: first.id, kind: "permission_request" }])
      expect(findInteractionByExternal(request.id)).toMatchObject({ id: first.id, status: "rejected" })
      expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ revision: 1, pendingCount: 0 })
      const messageID = Identifier.ascending("message"), text = "A fresh human input after the late Asked."
      await Session.persistMessage({ info: {
        id: messageID, sessionID: root.id, role: "user", author: "user", agent: "work",
        model: { providerID: "test", modelID: "memory-replay" }, time: { created: Date.now() },
        extra: ProjectMemory.userInputExtra({ surface: "test.human", literalText: text }),
      }, parts: [{ id: Identifier.ascending("part"), messageID, sessionID: root.id, type: "text", text, kind: "user_content", source: "user" }] })
      expect(ProjectMemory.pending(Instance.project.id).map(entry => ({ id: entry.occurrenceID, ownerID: entry.ownerID, text: entry.text })))
        .toEqual([{ id: messageID, ownerID: taskID, text }])
    } finally {
      release()
      registration.mockRestore()
    }
  } })
})

test("a failed human memory capture rolls back its delivery and retries the original winning decision", async () => {
  await using project = await memoryProject("permission-memory-rollback")
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    EngineService.init()
    const { root } = await prepareTask("Atomic permission memory")
    const pending = await pendingPermission(root.id, "rollback")
    await waitFor(() => Bus.TestHooks.outbox().length === 0, "original Asked projection")
    const capture = ProjectMemory.captureOccurrenceInTransaction
    const interruption = spyOn(ProjectMemory, "captureOccurrenceInTransaction").mockImplementation((db, input) => {
      capture(db, input)
      throw new Error("interrupt original Permission capture transaction")
    })
    try {
      expect((await permissionReply(pending.request.id, "allow_once", "First transaction.")).status).toBe(500)
    } finally {
      interruption.mockRestore()
    }
    expect(findInteractionByExternal(pending.request.id)).toMatchObject({ status: "answered" })
    expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ revision: 0, pendingCount: 0 })
    expect((await permissionReply(pending.request.id, "allow_once", "Successful retry.")).status).toBe(200)
    expect(await pending.execution).toBe("authorized original effect")
    await waitFor(() => Bus.TestHooks.outbox().length === 0, "original human delivery retry")
    const facts = Database.use(db => readPermissionRequestFacts(db, pending.request.id))!
    expect(facts.authority).toMatchObject({ event_type: "allowed_once", reason: "First transaction." })
    expect(ProjectMemory.pending(Instance.project.id).map(entry => ({ id: entry.occurrenceID, text: entry.text })))
      .toEqual([{ id: findInteractionByExternal(pending.request.id)!.id, text: "First transaction." }])
  } })
})

test("a human Permission reply preserves a standalone Session's original owner", async () => {
  await using project = await memoryProject("standalone-permission-memory")
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    EngineService.init()
    const session = await Session.create({ kind: "assistant", title: "Standalone permission" })
    const pending = await pendingPermission(session.id, "standalone")
    expect((await permissionReply(pending.request.id, "allow_once", "Approve this Session effect.")).status).toBe(200)
    expect(await pending.execution).toBe("authorized original effect")
    const facts = Database.use(db => readPermissionRequestFacts(db, pending.request.id))!
    expect(facts.request).toMatchObject({ sessionID: session.id, projectID: Instance.project.id })
    expect(facts.authority).toMatchObject({ event_type: "allowed_once", reason: "Approve this Session effect." })
    expect(ProjectMemory.read(Instance.project.id)).toMatchObject({ revision: 0, pendingCount: 0 })
  } })
})

for (const owner of ["missing", "wrong-task"] as const) {
  test(`an existing Permission source maps its ${owner} immutable owner to the canonical error`, async () => {
    await using project = await memoryProject(`permission-source-${owner}`)
    await Instance.provide({ directory: project.path, fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const original = await prepareTask("Original permission owner")
      const other = await prepareTask("Another actual Task")
      const pending = await pendingPermission(original.root.id, `source-${owner}`)
      const facts = Database.use(db => readPermissionRequestFacts(db, pending.request.id))!
      const malformedID = Identifier.ascending("interaction")
      const writeMalformed = () => Database.immediateTransaction(db => {
        if (owner === "missing") {
          db.insert(EngineInteractionRequestTable).values({
            id: malformedID, source_kind: "permission_request", source_id: facts.requested.id,
          }).run()
        } else {
          insertEngineInteractionRequest(db, {
            taskID: other.taskID, sessionID: other.root.id, externalID: pending.request.id,
            requestType: "permission", title: "Wrong Task source", body: "A conflicting original owner", payload: {},
            eventSource: "test.source-owner", eventSummary: "Conflicting original owner",
            source: { kind: "permission_request", id: facts.requested.id },
          })
        }
        ensurePermissionInteractionInTransaction(db, { request: pending.request, projectID: Instance.project.id })
        throw new Error("malformed source reached the transaction return")
      })
      if (owner === "missing") expect(writeMalformed).toThrow(`Interaction ${malformedID} has no exact immutable Task owner event`)
      else expect(writeMalformed).toThrow(PermissionLedgerIntegrityError)
      EngineService.init()
      expect((await permissionReply(pending.request.id, "allow_once", "The original owner approves.")).status).toBe(200)
      expect(await pending.execution).toBe("authorized original effect")
      expect(findInteractionByExternal(pending.request.id)).toMatchObject({
        task_id: original.taskID, session_id: original.root.id, status: "answered",
      })
    } })
  })
}
