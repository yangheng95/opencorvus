import { afterEach, expect, test } from "bun:test"
import { createRightSidebarConversationSession } from "@/chat/session"
import { terminateOwnedSessionPromptInScope } from "@/engine/cancellation-scope"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import { Database, eq } from "@/storage/db"
import { MessageTable } from "@/session/session.sql"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function userInput(sessionID: string, pendingDelivery = false) {
  return Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "work",
    time: { created: Date.now() },
    model: { providerID: "test", modelID: "test" },
    ...(pendingDelivery ? { pendingDelivery: true } : {}),
  })
}

async function ownedInput(status?: SessionStatus.Info) {
  const session = await createRightSidebarConversationSession("work")
  const input = await userInput(session.id)
  const owner = SessionPromptState.start(session.id, session.directory)
  if (!owner) throw new Error("Expected the actual local Prompt owner")
  SessionStatus.beginExecutionOccurrence(session.id, input.id, owner)
  if (status) {
    await publishSessionStatus(session, status, { inputMessageID: input.id, promptGenerationOwner: owner })
  }
  let finish: Promise<void> | undefined
  owner.addEventListener(
    "abort",
    () => {
      finish = SessionPromptState.finish(session.id, owner, session.directory)
    },
    { once: true },
  )
  return { session, input, owner, finish: () => finish }
}

function inputFact(sessionID: string, inputMessageID: string) {
  const event = ProtocolStore.latestSessionOccurrenceEvent(sessionID, SessionStatus.Event.Status.type, inputMessageID)
  return { sessionID: event?.sessionID, inputMessageID: event?.payload?.inputMessageID, status: event?.payload?.status }
}

test("production process shutdown preserves settled inputs and cancels exact active inputs across two Projects", async () => {
  await using first = await memoryProject("shutdown-input-first")
  await using second = await memoryProject("shutdown-input-second")
  const cases: Array<{ owned: Awaited<ReturnType<typeof ownedInput>>; expected: SessionStatus.Info }> = []
  for (const [directory, statuses] of [
    [first.path, [{ type: "idle" }, { type: "streaming" }, { type: "terminal", reason: "completed" }]],
    [
      second.path,
      [
        { type: "retry", attempt: 1, message: "Retry owned request", next: Date.now() + 100 },
        { type: "terminal", reason: "error", error: "Original provider failure" },
        undefined,
      ],
    ],
  ] as const) {
    await Instance.provide({
      directory,
      fn: async () => {
        for (const status of statuses) {
          cases.push({
            owned: await ownedInput(status),
            expected:
              status && (status.type === "idle" || status.type === "terminal")
                ? status
                : { type: "terminal", reason: "aborted", error: "shutdown exact input audit" },
          })
        }
      },
    })
  }
  const { terminateCurrentProcessOwnedExecution } = await import("@/engine/writer")
  const settlement = await terminateCurrentProcessOwnedExecution({ reason: "shutdown exact input audit" })
  try {
    await Promise.all(cases.map(({ owned }) => owned.finish()))
    expect({ settledPrompts: settlement.sessions, toolParts: settlement.toolParts }).toEqual({
      settledPrompts: 6,
      toolParts: 0,
    })
    expect(
      cases.map(({ owned }) => ({ abortedOwner: owned.owner.aborted, ...inputFact(owned.session.id, owned.input.id) })),
    ).toEqual(
      cases.map(({ owned, expected }) => ({
        abortedOwner: true,
        sessionID: owned.session.id,
        inputMessageID: owned.input.id,
        status: expected,
      })),
    )
  } finally {
    settlement.releaseHandoff()
  }
}, 60_000)

test("exact owner settlement preserves an idle input and its unconsumed durable queued successor", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owned = await ownedInput({ type: "idle" })
      const queued = await userInput(owned.session.id, true)
      const attached = SessionPromptState.attach(owned.session.id, owned.session.directory, "reply", queued.id).catch(
        (error) => error,
      )
      const settled = await terminateOwnedSessionPromptInScope({
        session: owned.session,
        owner: owned.owner,
        origin: createExecutionCancellationOrigin({
          actor: "runtime",
          source: "process.shutdown",
          surface: "runtime",
          reason: "retain the durable queue while releasing standby",
          targetSessionID: owned.session.id,
        }),
      })
      await owned.finish()
      expect({
        settled,
        ownerAborted: owned.owner.aborted,
        original: inputFact(owned.session.id, owned.input.id),
      }).toEqual({
        settled: true,
        ownerAborted: true,
        original: { sessionID: owned.session.id, inputMessageID: owned.input.id, status: { type: "idle" } },
      })
      expect(await attached).toMatchObject({
        name: "ExecutionCancellationError",
        sessionID: owned.session.id,
        origin: { source: "process.shutdown" },
      })
      expect(
        Database.use((db) =>
          db.select({ data: MessageTable.data }).from(MessageTable).where(eq(MessageTable.id, queued.id)).get(),
        )?.data,
      ).toMatchObject({ role: "user", pendingDelivery: true })
    },
  })
}, 30_000)

for (const route of ["session", "coding/work/session"]) {
  test(`${route} public abort retains settled input history and publishes an active input cancellation`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const status of [{ type: "idle" }, { type: "streaming" }] as const) {
          const owned = await ownedInput(status)
          const response = await Server.App().request(`/${route}/${owned.session.id}/abort`, {
            method: "POST",
            headers: { "x-opencorvus-directory": project.path },
          })
          const body = await response.json()
          await owned.finish()
          expect({
            http: response.status,
            body,
            ownerAborted: owned.owner.aborted,
            fact: inputFact(owned.session.id, owned.input.id),
          }).toEqual({
            http: 200,
            body: true,
            ownerAborted: true,
            fact: {
              sessionID: owned.session.id,
              inputMessageID: owned.input.id,
              status:
                status.type === "idle"
                  ? status
                  : {
                      type: "terminal",
                      reason: "aborted",
                      error: route === "session" ? "session aborted" : "Work stopped",
                    },
            },
          })
        }
      },
    })
  }, 30_000)
}
