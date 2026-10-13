import { afterEach, expect, test } from "bun:test"
import { Bus } from "../src/bus"
import { Question } from "../src/question"
import { Session } from "../src/session"
import { Instance } from "../src/project/instance"
import { ProtocolStore } from "../src/protocol/store"
import { ensureSessionProtocolBridge } from "../src/protocol/session-mirror"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { EngineInteraction } from "../src/engine/interaction"
import { findInteractionByExternal } from "../src/engine/store"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { persistEstablishedTask } from "./fixture/engine-task"
import { Identifier } from "../src/id/id"
import { Database, eq } from "../src/storage/db"
import { BusPublicationOutboxTable } from "../src/bus/bus.sql"
import { EngineInteractionOutcomeTable } from "../src/engine/engine.sql"
import { Server } from "../src/server/server"
import { SessionEventStreamTestHooks } from "../src/server/routes/session"
import { timelineOrderKey } from "../src/timeline/order"
import { ProjectMemory } from "../src/memory/project-memory"

afterEach(async () => {
  SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function streamReader(response: Response) {
  const reader = response.body!.getReader(),
    decoder = new TextDecoder()
  let buffer = ""
  const queued: any[] = []
  return {
    async next(type: string): Promise<any> {
      const until = Date.now() + 5000
      for (;;) {
        const frames = buffer.split("\n\n")
        buffer = frames.pop()!
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (data) queued.push(JSON.parse(data))
        }
        const index = queued.findIndex((event) => event.type === type)
        if (index >= 0) return queued.splice(index, 1)[0]
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const chunk = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error(`Question stream waited 5000ms for ${type}`)),
                Math.max(1, until - Date.now()),
              )
            }),
          ])
          if (chunk.done) throw new Error(`Question stream closed before ${type}`)
          buffer += decoder.decode(chunk.value, { stream: true })
        } finally {
          clearTimeout(timer)
        }
      }
    },
    close: () => reader.cancel(),
  }
}

async function accepted(input: Parameters<typeof Question.ask>[0]) {
  let stop = () => {}
  const observed = new Promise<{ request: Question.Request; occurrenceID: string }>((resolve) => {
    stop = Bus.subscribe(Question.Event.Asked, (event) => {
      if (event.properties.sessionID !== input.sessionID) return
      stop()
      resolve({ request: event.properties, occurrenceID: event.occurrenceID })
    })
  })
  const result = Question.ask(input).then(
    (answers) => ({ kind: "answer" as const, answers }),
    (error: Error) => ({ kind: "error" as const, error }),
  )
  return { ...(await observed), result }
}

async function taskOwner(title: string) {
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "interaction-recovery-test",
    version: "2026.08.09.1",
    packageDigest: "a".repeat(64),
  }
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title,
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  const taskID = Identifier.ascending("task"),
    now = Date.now()
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title,
    request: title,
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return { root, taskID }
}

test("an accepted Asked observer reads the complete canonical pending Request at publication time", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Public canonical Question admission" })
      const readPending = await Question.pendingSnapshotReader()
      let observed: { request: Question.Request; pending: Question.Request[] } | undefined
      let resolveObserved!: () => void
      const received = new Promise<void>((resolve) => {
        resolveObserved = resolve
      })
      const stop = Bus.subscribe(Question.Event.Asked, ({ properties }) => {
        if (properties.sessionID !== session.id) return
        observed = { request: properties, pending: readPending() }
        resolveObserved()
      })
      const answer = Question.ask({
        sessionID: session.id,
        expireOnDeadline: false,
        questions: [{ header: "Admission", question: "Public canonical entry", options: [], custom: true }],
      })
      try {
        await received
        await Question.reply({ requestID: observed!.request.id, answers: [["Public admission completed"]] })
        expect(await answer).toEqual([["Public admission completed"]])
        console.log("PUBLIC_ADMISSION_OBSERVATION", JSON.stringify(observed))
        expect(observed!.pending).toEqual([observed!.request])
      } finally {
        stop()
      }
    },
  })
}, 30_000)

test("Task Question projection retains its committed answer when Asked delivery resumes after terminal", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const packageRevision = {
        scope: "built_in" as const,
        projectID: null,
        namespace: "builtin",
        id: "interaction-recovery-test",
        version: "2026.08.09.1",
        packageDigest: "a".repeat(64),
      }
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Public Task Question ordering",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      const taskID = Identifier.ascending("task"),
        now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: root.title,
        request: "Exercise public Task Question ordering",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      let releaseAsked!: () => void, resolveHeld!: () => void
      const held = new Promise<void>((resolve) => {
        releaseAsked = resolve
      })
      const entered = new Promise<void>((resolve) => {
        resolveHeld = resolve
      })
      let request!: Question.Request,
        occurrence = ""
      const stopGate = Bus.subscribe(
        Question.Event.Asked,
        async (event) => {
          if (event.properties.sessionID !== root.id) return
          request = event.properties
          occurrence = event.occurrenceID
          resolveHeld()
          await held
        },
        { durableID: "question-contract.task-question-delivery-window", effect: "idempotent_by_occurrence" },
      )
      EngineInteraction.subscribe()
      const answer = Question.ask({
        sessionID: root.id,
        expireOnDeadline: false,
        questions: [{ header: "Task ordering", question: "Keep the real Task answer", options: [], custom: true }],
      })
      try {
        await entered
        await Question.reply({ requestID: request.id, answers: [["Public Task committed answer"]],
          userInput: { surface: "test.public-task-question", text: "Public Task committed answer" } })
        expect(await answer).toEqual([["Public Task committed answer"]])
        releaseAsked()
        await Bus.publishOwnedExact(Question.Event.Asked, request, occurrence).retry()
        const projected = findInteractionByExternal(request.id)
        const pendingBeforeRecovery = await Question.list()
        const recovery = await EngineInteraction.reconcileRecoveredPendingWaiters({
          projectID: Instance.project.id,
          timeResolved: Date.now(),
        })
        const pendingAfterRecovery = await Question.list()
        console.log(
          "PUBLIC_TASK_ORDERING_OBSERVATION",
          JSON.stringify({ taskID, request, projected, pendingBeforeRecovery, recovery, pendingAfterRecovery }),
        )
        expect(projected).toMatchObject({
          task_id: taskID,
          external_id: request.id,
          status: "answered",
          response: { answers: [["Public Task committed answer"]] },
        })
        expect(ProjectMemory.pending(Instance.project.id).filter((item) => item.occurrenceID === projected!.id)).toMatchObject([
          { occurrenceKind: "interaction_reply", occurrenceID: projected!.id, taskID, projectID: Instance.project.id,
            sessionID: root.id, surface: "test.public-task-question", text: "Public Task committed answer" },
        ])
      } finally {
        releaseAsked()
        stopGate()
      }
    },
  })
}, 30_000)

test("a real terminal remains the current Session projection after an earlier Asked delivery resumes", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Public Question delivery ordering" })
      const readPending = await Question.pendingSnapshotReader()
      let releaseAsked!: () => void
      const held = new Promise<void>((resolve) => {
        releaseAsked = resolve
      })
      let resolveHeld!: () => void
      const entered = new Promise<void>((resolve) => {
        resolveHeld = resolve
      })
      let request: Question.Request | undefined
      let askedOccurrence = ""
      const stopGate = Bus.subscribeAll(
        async (event) => {
          if (event.type !== Question.Event.Asked.type || event.properties.sessionID !== session.id) return
          request = event.properties
          askedOccurrence = event.occurrenceID
          resolveHeld()
          await held
        },
        { durableID: "question-contract.public-question-delivery-window", effect: "idempotent_by_occurrence" },
      )
      ensureSessionProtocolBridge()
      const projections: Array<{ type: string; payload: unknown; pendingAtDelivery: Question.Request[] }> = []
      const stopProjection = ProtocolStore.subscribeEvents(
        (event) => {
          if (event.sessionID !== session.id) return
          projections.push({ type: event.type, payload: event.payload, pendingAtDelivery: readPending() })
        },
        { aggregate: "session", types: ["question.asked", "question.replied"] },
      )
      const answer = Question.ask({
        sessionID: session.id,
        expireOnDeadline: false,
        questions: [{ header: "Ordering", question: "Public ordering choice", options: [], custom: true }],
      })
      try {
        await entered
        await Question.reply({ requestID: request!.id, answers: [["Public terminal wins"]] })
        expect(await answer).toEqual([["Public terminal wins"]])
        await stopProjection.drain()
        releaseAsked()
        // Wait on the original durable Asked publication, not a synthetic event.
        await Bus.publishOwnedExact(Question.Event.Asked, request!, askedOccurrence).retry()
        await stopProjection.drain()
        console.log(
          "PUBLIC_ORDERING_OBSERVATION",
          JSON.stringify({ request, projections, canonicalPending: readPending() }),
        )
        expect(projections.at(-1)).toMatchObject({
          type: "question.replied",
          payload: { requestID: request!.id, answers: [["Public terminal wins"]] },
          pendingAtDelivery: [],
        })
      } finally {
        releaseAsked()
        stopGate()
        stopProjection()
      }
    },
  })
}, 30_000)

test.each(["rejected", "expired", "abandoned", "automatic"] as const)(
  "Task terminal-first %s retains original occurrence, provenance and outcome through retry and recovery",
  async (kind) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root, taskID } = await taskOwner(`Terminal-first ${kind}`)
        let release!: () => void
        const held = new Promise<void>((resolve) => {
          release = resolve
        })
        const gate = Bus.subscribe(
          Question.Event.Asked,
          async (event) => {
            if (event.properties.sessionID === root.id) await held
          },
          { durableID: `question-contract.${kind}-terminal-first`, effect: "idempotent_by_occurrence" },
        )
        // Capture admission before the held subscriber; the waiter itself is installed at commit.
        let admitted!: () => void
        const admission = new Promise<void>((resolve) => {
          admitted = resolve
        })
        const requestID = Identifier.ascending("question")
        EngineInteraction.subscribe()
        const result = Question.ask({
          sessionID: root.id,
          requestID,
          expireOnDeadline: false,
          acceptanceOccurrenceID: `question-contract:${requestID}`,
          acceptanceEffects: () => Database.effect(admitted),
          questions: [
            {
              header: kind,
              question: `Preserve ${kind}`,
              options: [{ value: "yes", label: "Yes", description: "Public answer" }],
            },
          ],
          ...(kind === "automatic" ? { automatic: { timeoutMs: 1000, answers: [["yes"]] } } : {}),
          ...(kind === "expired"
            ? { expiry: { origin: "deadline" as const, timeoutMs: 1000, timeExpires: Date.now() + 1000 } }
            : {}),
        }).then(
          (answers) => ({ kind: "answer", answers }),
          (error: Error) => ({ kind: "error", error }),
        )
        try {
          await admission
          const original = Question.publicationFacts({ projectID: Instance.project.id, sessionID: root.id, requestID })
          if (kind === "rejected") await Question.reject(requestID)
          if (kind === "abandoned")
            await Question.abandon({ requestID, error: new Error("Public infrastructure stop") })
          const answer = await result
          console.log(
            "TERMINAL_TIMER_RESULT",
            kind,
            JSON.stringify(answer, (_key, value) =>
              value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value,
            ),
          )
          const terminal = Question.publicationFacts({
            projectID: Instance.project.id,
            sessionID: root.id,
            requestID,
          }).terminal!
          expect(terminal.type).toBe(kind === "automatic" ? "question.replied" : `question.${kind}`)
          if (kind === "automatic") expect(answer).toEqual({ kind: "answer", answers: [["yes"]] })
          else
            expect(answer).toMatchObject({
              kind: "error",
              error: {
                name:
                  kind === "rejected" ? "QuestionRejectedError" : kind === "expired" ? "QuestionExpiredError" : "Error",
              },
            })
          release()
          await Bus.publishOwnedExact(Question.Event.Asked, original.request, original.askedOccurrenceID).retry()
          await Question.restore(original.request)
          const recovered = await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: Instance.project.id,
            timeResolved: Date.now(),
          })
          expect(recovered).toEqual({
            abandoned: [],
            retainedRecoverableQuestions: [],
            retainedRecoverablePermissions: [],
            retainedControlPlaneGates: [],
            unreconciled: [],
          })
          const interaction = findInteractionByExternal(requestID)!
          expect(interaction).toMatchObject({
            task_id: taskID,
            session_id: root.id,
            status: kind === "automatic" ? "answered" : kind === "rejected" ? "rejected" : "expired",
            time_resolved: terminal.properties.timeResolved,
            response:
              kind === "automatic"
                ? { answers: [["yes"]], auto_reply: true }
                : kind === "expired"
                  ? { origin: "deadline", time_expires: original.request.expiry!.timeExpires }
                  : { origin: kind === "rejected" ? "operator" : "infrastructure" },
          })
          expect(
            Database.use((db) =>
              db
                .select()
                .from(EngineInteractionOutcomeTable)
                .where(eq(EngineInteractionOutcomeTable.interaction_id, interaction.id))
                .all(),
            ).map((row) => row.source_occurrence_id),
          ).toEqual([terminal.occurrenceID])
          expect(await Question.list()).toEqual([])
        } finally {
          release()
          gate()
        }
      },
    })
  },
  30_000,
)

test("acceptance failure retains the other canonical waiter and reports its original transaction error", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Atomic Question admission" })
      const first = await accepted({
        sessionID: session.id,
        expireOnDeadline: false,
        questions: [{ header: "Existing", question: "Keep accepted work", options: [] }],
      })
      const error = new Error("Public admission owner rejected this occurrence")
      const failed = await Question.ask({
        sessionID: session.id,
        expireOnDeadline: false,
        questions: [{ header: "Rollback", question: "Fail owner admission", options: [] }],
        acceptanceOccurrenceID: `question-contract:${Identifier.ascending("question")}`,
        acceptanceEffects: () => {
          throw error
        },
      }).catch((caught) => caught)
      expect(failed).toBe(error)
      expect(await Question.list()).toEqual([first.request])
      await Question.reply({ requestID: first.request.id, answers: [["Retained original waiter"]] })
      expect(await first.result).toEqual({ kind: "answer", answers: [["Retained original waiter"]] })
    },
  })
}, 30_000)

test("dispose settles the original committed user reply after its postcommit interruption", async () => {
  await using project = await memoryProject()
  const original = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Committed reply disposal" })
      const pending = await accepted({
        sessionID: session.id,
        expireOnDeadline: false,
        questions: [{ header: "Commit", question: "Keep the original answer", options: [] }],
      })
      const error = new Error("Public interruption after durable reply")
      using hook = Question.TestHooks.failAfterNextUserOutboxCommit(error)
      expect(
        await Question.reply({
          requestID: pending.request.id,
          answers: [["Committed Cedar"]],
          userInput: { surface: "test.public-question", text: "Committed Cedar" },
        }).catch((caught) => caught),
      ).toBe(error)
      const facts = Question.publicationFacts({
        projectID: Instance.project.id,
        sessionID: session.id,
        requestID: pending.request.id,
      })
      expect(facts.terminal).toMatchObject({
        type: "question.replied",
        properties: { answers: [["Committed Cedar"]], userInput: { text: "Committed Cedar" } },
      })
      expect(await Question.list()).toEqual([])
      return { ...pending, facts, projectID: Instance.project.id }
    },
  })
  await Instance.disposeAll()
  expect(await original.result).toEqual({ kind: "answer", answers: [["Committed Cedar"]] })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      expect(
        Question.publicationFacts({
          projectID: original.projectID,
          sessionID: original.request.sessionID,
          requestID: original.request.id,
        }),
      ).toEqual(original.facts)
      await Question.restore(original.request)
      expect(await Question.list()).toEqual([])
    },
  })
}, 30_000)

test("ordinary dispose persists infrastructure provenance in the single terminal slot", async () => {
  await using project = await memoryProject()
  const deliveries: unknown[] = []
  const original = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Disposed pending Question" })
      const pending = await accepted({
        sessionID: session.id,
        expireOnDeadline: false,
        questions: [{ header: "Dispose", question: "Close this infrastructure owner", options: [] }],
      })
      Bus.subscribe(Question.Event.Abandoned, (event) => {
        deliveries.push(event.properties)
      })
      return { request: pending.request, projectID: Instance.project.id }
    },
  })
  await Instance.disposeAll()
  expect(deliveries).toEqual([
    expect.objectContaining({
      requestID: original.request.id,
      sessionID: original.request.sessionID,
      origin: "infrastructure",
    }),
  ])
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const facts = Question.publicationFacts({
        projectID: original.projectID,
        sessionID: original.request.sessionID,
        requestID: original.request.id,
      })
      expect(facts).toMatchObject({
        request: original.request,
        terminal: {
          occurrenceID: `bus-occurrence:question-terminal:${original.request.id}`,
          type: "question.abandoned",
          properties: {
            requestID: original.request.id,
            sessionID: original.request.sessionID,
            origin: "infrastructure",
            timeResolved: expect.any(Number),
          },
        },
      })
      await Question.restore(original.request)
      expect(await Question.list()).toEqual([])
    },
  })
}, 30_000)

test("the publication reader preserves a historical accepted terminal occurrence and detects two conflicting identities", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Original outbox identities" })
      const pending = await accepted({
        sessionID: session.id,
        requestID: Identifier.ascending("question"),
        expireOnDeadline: false,
        questions: [{ header: "Identity", question: "Read the accepted fact", options: [] }],
      })
      const original = Bus.publishOwned(Question.Event.Replied, {
        sessionID: session.id,
        requestID: pending.request.id,
        answers: [["Original occurrence"]],
        timeResolved: Date.now(),
      })
      await original.retry()
      const query = { projectID: Instance.project.id, sessionID: session.id, requestID: pending.request.id }
      expect(Question.publicationFacts(query).terminal).toMatchObject({
        occurrenceID: original.occurrenceID,
        type: "question.replied",
        properties: { answers: [["Original occurrence"]] },
      })
      await Question.restore(pending.request)
      expect(await pending.result).toEqual({ kind: "answer", answers: [["Original occurrence"]] })
      const other = Bus.publishOwned(Question.Event.Rejected, {
        sessionID: session.id,
        requestID: pending.request.id,
        origin: "operator",
        timeResolved: Date.now(),
      })
      await other.retry()
      expect(() => Question.publicationFacts(query)).toThrow(
        `Question ${pending.request.id} has conflicting terminal publication identities`,
      )
      expect(
        Database.use((db) =>
          db
            .select()
            .from(BusPublicationOutboxTable)
            .where(eq(BusPublicationOutboxTable.occurrence_id, original.occurrenceID))
            .get(),
        )?.properties,
      ).toMatchObject({ answers: [["Original occurrence"]] })
    },
  })
}, 30_000)

test("real TCP cold, cutover and reconnect preserve exact non-Task child Questions and separate both Projects and Task Board", async () => {
  await using projectA = await memoryProject("question-http-project-A")
  await using projectB = await memoryProject("question-http-project-B")
  const owners = []
  const streams: ReturnType<typeof streamReader>[] = []
  const aborts: AbortController[] = []
  let server: ReturnType<typeof Server.listen> | undefined
  const question = (sessionID: string, label: string, extra: Partial<Parameters<typeof Question.ask>[0]> = {}) =>
    accepted({
      sessionID,
      expireOnDeadline: false,
      questions: [{ header: label, question: `Public ${label}`, options: [], custom: true }],
      ...extra,
    })
  const view = (request: Question.Request) =>
    JSON.parse(
      JSON.stringify({
        ...request,
        orderKey: timelineOrderKey({ domain: "interaction", time: request.timeCreated, id: request.id }),
      }),
    )
  try {
    for (const project of [projectA, projectB]) {
      owners.push(
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            ensureSessionProtocolBridge()
            EngineInteraction.subscribe()
            const root = await Session.create({ kind: "assistant", title: "Public parent" })
            const child = await Session.create({
              kind: "orchestrator",
              parentID: root.id,
              title: "Public non-Task child",
            })
            const side = await Session.create({ kind: "assistant", title: "Separate side conversation" })
            const task = await taskOwner("Separate Task Question owner")
            const rootPending = await question(root.id, "root")
            const childPending = await question(child.id, "child")
            const sidePending = await question(side.id, "side")
            const taskPending = await question(task.root.id, "Task")
            await Bus.publishOwnedExact(Question.Event.Asked, taskPending.request, taskPending.occurrenceID).retry()
            return {
              directory: project.path,
              projectID: Instance.project.id,
              root,
              child,
              side,
              task,
              pending: [rootPending, childPending, sidePending, taskPending],
              visible: [rootPending.request, childPending.request],
            }
          },
        }),
      )
    }
    server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    async function open(owner: (typeof owners)[number]) {
      const abort = new AbortController()
      aborts.push(abort)
      const response = await fetch(new URL(`/session/${owner.root.id}/events`, server!.url), {
        headers: { "x-opencorvus-directory": owner.directory },
        signal: abort.signal,
      })
      expect(response.status).toBe(200)
      const stream = streamReader(response)
      streams.push(stream)
      return { stream, abort, snapshot: (await stream.next("session.connected")).payload.conversationSnapshot }
    }
    const connections = await Promise.all(
      owners.map(async (owner) => {
        const headers = { "x-opencorvus-directory": owner.directory }
        const cold = await fetch(new URL(`/session/${owner.root.id}/conversation`, server!.url), { headers })
        expect({ status: cold.status, pending: ((await cold.json()) as any).pendingQuestions }).toEqual({
          status: 200,
          pending: owner.visible.map(view),
        })
        const taskCold = await fetch(new URL(`/session/${owner.task.root.id}/conversation`, server!.url), { headers })
        expect({ status: taskCold.status, pending: ((await taskCold.json()) as any).pendingQuestions }).toEqual({
          status: 200,
          pending: [],
        })
        expect(findInteractionByExternal(owner.pending[3]!.request.id)).toMatchObject({
          task_id: owner.task.taskID,
          status: "pending",
        })
        const connection = await open(owner)
        expect(connection.snapshot.pendingQuestions).toEqual(owner.visible.map(view))
        return connection
      }),
    )
    await Promise.all(
      owners.map(async (owner, index) => {
        const next = await Instance.provide({
          directory: owner.directory,
          fn: async () => {
            const child = await Session.create({
              kind: "orchestrator",
              parentID: owner.root.id,
              title: "Live non-Task child",
            })
            return question(child.id, "live child")
          },
        })
        owner.pending.push(next)
        owner.visible.push(next.request)
        expect((await connections[index]!.stream.next("question.asked")).payload).toMatchObject(view(next.request))
      }),
    )
    for (const connection of connections) {
      await connection.stream.close()
        connection.abort.abort()
    }
    // Resolve actual requests while both physical SSE connections are closed.
    await Promise.all(
      owners.map((owner) =>
        Instance.provide({
          directory: owner.directory,
          fn: async () => {
            await Question.reply({ requestID: owner.pending[0]!.request.id, answers: [["Offline answer"]] })
            await Question.reject(owner.pending[1]!.request.id)
            await Question.abandon({
              requestID: owner.pending[4]!.request.id,
              error: new Error("Offline infrastructure stop"),
            })
            const expiry = await question(owner.root.id, "offline expiry", {
              expiry: { origin: "deadline", timeoutMs: 1000, timeExpires: Date.now() + 1000 },
            })
            owner.pending.push(expiry)
            expect(await expiry.result).toMatchObject({
              kind: "error",
              error: { name: "QuestionExpiredError", origin: "deadline" },
            })
            owner.visible.length = 0
          },
        }),
      ),
    )
    // A naturally accepted child during the snapshot cutover is already part
    // of the connection's canonical tree, before its buffered live event.
    SessionEventStreamTestHooks.afterConversationSnapshotRead = async ({ sessionID }) => {
      const owner = owners.find((item) => item.root.id === sessionID)
      if (!owner) return
      await Instance.provide({
        directory: owner.directory,
        fn: async () => {
          const child = await Session.create({ kind: "orchestrator", parentID: owner.root.id, title: "Cutover child" })
          const pending = await question(child.id, "cutover")
          owner.pending.push(pending)
          owner.visible.push(pending.request)
        },
      })
    }
    const reconnected = await Promise.all(owners.map(open))
    SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
    reconnected.forEach((connection, index) =>
      expect(connection.snapshot.pendingQuestions).toEqual(owners[index]!.visible.map(view)),
    )
    for (const connection of reconnected) {
      await connection.stream.close()
        connection.abort.abort()
    }
  } finally {
    SessionEventStreamTestHooks.afterConversationSnapshotRead = undefined
    for (const abort of aborts) abort.abort()
    for (const stream of streams) await stream.close().catch(() => undefined)
    for (const owner of owners)
      await Instance.provide({
        directory: owner.directory,
        fn: async () => {
          const remaining = await Question.list()
          for (const request of remaining)
            await Question.reply({ requestID: request.id, answers: [["Public cleanup answer"]] })
          await Promise.all(owner.pending.map((pending) => pending.result))
        },
      })
    await server?.stop(true)
  }
}, 60_000)
