import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { ProjectMemory } from "../../src/memory/project-memory"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import type { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { Database } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

const model = { providerID: "test", modelID: "memory-provenance" }

function userInput(sessionID: string, text: string, time: number) {
  const info: Message.User = {
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "work",
    model,
    time: { created: time },
    extra: ProjectMemory.userInputExtra({ surface: "test.human", literalText: text }),
  }
  const part: Message.TextPart = {
    id: Identifier.ascending("part"),
    sessionID,
    messageID: info.id,
    type: "text",
    text,
    kind: "user_content",
    source: "user",
  }
  return { info, parts: [part] }
}

async function completeReply(sessionID: string, parentID: string, time: number) {
  const info: Message.Assistant = {
    id: Identifier.ascending("message"),
    sessionID,
    parentID,
    role: "assistant",
    author: "work",
    agent: "work",
    modelID: model.modelID,
    providerID: model.providerID,
    path: { cwd: Instance.directory, root: Instance.worktree },
    time: { created: time, completed: time + 1 },
    finish: "stop",
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
  const part: Message.TextPart = {
    id: Identifier.ascending("part"),
    sessionID,
    messageID: info.id,
    type: "text",
    text: "A settled owner reply.",
  }
  return Session.persistMessage({ info, parts: [part] })
}

test("copied history retains its source while fresh human inputs own the project inbox", async () => {
  await using project = await memoryProject("memory-origin-A")
  await using other = await memoryProject("memory-origin-B")
  let firstProjectID = ""
  let expected: Array<{ occurrenceID: string; sessionID: string }> = []
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      firstProjectID = Instance.project.id
      const source = await Session.create({
        kind: "assistant",
        title: "Original brief",
        metadata: { configOverlay: { model: null } },
      })
      const initial = userInput(source.id, "Keep the original requirement.", 1_000)
      await Session.persistMessage(initial)
      await completeReply(source.id, initial.info.id, 2_000)
      const fork = await Session.fork({ sessionID: source.id })
      const side = await Session.fork({ sessionID: source.id, purpose: "side-chat" })
      for (const owner of [fork, side]) {
        const copied = (await Session.messages({ sessionID: owner.id })).find(
          (message) => message.info.role === "user",
        )!
        expect(copied.info.role).toBe("user")
        expect((copied.info as Message.User).extra).toEqual(initial.info.extra)
        expect(copied.parts.map((part) => (part.type === "text" ? part.text : part.type))).toEqual([
          initial.parts[0]!.text,
        ])
        expect(copied.info.copySources).toEqual([
          expect.objectContaining({
            sources: [expect.objectContaining({ sessionID: source.id, messageID: initial.info.id })],
          }),
        ])
        expect(Database.transaction((db) => ProjectMemory.captureMessageInTransaction(db, copied))).toEqual({
          classification: "copied_context",
          messageID: copied.info.id,
        })
      }
      const freshSide = userInput(side.id, "A new side question.", 3_000)
      const freshFork = userInput(fork.id, "A new fork requirement.", 4_000)
      await Session.persistMessage(freshSide)
      await Session.persistMessage(freshFork)
      expected = [initial, freshSide, freshFork].map((input) => ({
        occurrenceID: input.info.id,
        sessionID: input.info.sessionID,
      }))
      expect(
        ProjectMemory.pending(firstProjectID).map(({ occurrenceID, sessionID }) => ({ occurrenceID, sessionID })),
      ).toEqual(expected)
      expect(
        ProjectMemory.pending(firstProjectID).find((entry) => entry.occurrenceID === freshSide.info.id),
      ).toMatchObject({
        projectID: firstProjectID,
        ownerKind: "conversation",
        ownerID: side.id,
        text: "A new side question.",
      })
    },
  })
  await Instance.provide({
    directory: other.path,
    fn: async () => {
      const owner = await Session.create({ kind: "assistant", title: "Other project" })
      const fresh = userInput(owner.id, "This project's independent requirement.", 5_000)
      await Session.persistMessage(fresh)
      expect(
        ProjectMemory.pending(Instance.project.id).map((entry) => ({
          projectID: entry.projectID,
          occurrenceID: entry.occurrenceID,
          sessionID: entry.sessionID,
        })),
      ).toEqual([{ projectID: Instance.project.id, occurrenceID: fresh.info.id, sessionID: owner.id }])
    },
  })
  expect(
    ProjectMemory.pending(firstProjectID).map(({ occurrenceID, sessionID }) => ({ occurrenceID, sessionID })),
  ).toEqual(expected)
})

test("consumed message replay retains the document and admits the next human input", async () => {
  await using project = await memoryProject("memory-origin-replay")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await Session.create({ kind: "assistant", title: "Original owner" })
      const first = userInput(owner.id, "The first requirement.", 1_000)
      await Session.persistMessage(first)
      const projectID = Instance.project.id,
        leaseID = "memory-origin-replay",
        now = Date.now()
      const lease = Database.transaction((db) =>
        ProjectMemory.beginOrganizerAttemptInTransaction(db, {
          projectID,
          leaseID,
          expectedRevision: 0,
          timeUpdated: now,
        }),
      )
      expect(lease).toMatchObject({ id: leaseID, revision: 0 })
      Database.transaction((db) =>
        ProjectMemory.commitOrganizationInTransaction(db, {
          projectID,
          leaseID,
          baseRevision: 0,
          coveredOccurrenceIDs: [first.info.id],
          markdown: "# Project context\n\nThe first requirement.\n",
          timeUpdated: now + 1,
        }),
      )
      await Session.setTitle({ sessionID: owner.id, title: "Renamed owner" })
      await Session.persistMessage(first)
      const next = userInput(owner.id, "The next requirement.", 2_000)
      await Session.persistMessage(next)
      expect(ProjectMemory.read(projectID)).toMatchObject({
        revision: 1,
        content: "# Project context\n\nThe first requirement.\n",
        pendingCount: 1,
      })
      expect(
        ProjectMemory.pending(projectID).map((entry) => ({
          occurrenceID: entry.occurrenceID,
          ownerNameAtCapture: entry.ownerNameAtCapture,
          text: entry.text,
        })),
      ).toEqual([{ occurrenceID: next.info.id, ownerNameAtCapture: "Renamed owner", text: "The next requirement." }])
      expect((await MessageStore.get({ sessionID: owner.id, messageID: first.info.id })).info).toMatchObject({
        id: first.info.id,
        role: "user",
        extra: first.info.extra,
      })
    },
  })
})

test("a rolled back bundle accepts its exact input once on successful retry", async () => {
  await using project = await memoryProject("memory-origin-rollback")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await Session.create({ kind: "assistant", title: "Retried request" })
      const input = userInput(owner.id, "Commit this request atomically.", 1_000)
      await expect(
        Session.persistMessageWithCommit(input, () => {
          throw new Error("rollback memory input")
        }),
      ).rejects.toThrow("rollback memory input")
      await Session.persistMessage(input)
      await Session.persistMessage(input)
      expect(
        ProjectMemory.pending(Instance.project.id).map((entry) => ({
          occurrenceID: entry.occurrenceID,
          text: entry.text,
          ownerID: entry.ownerID,
        })),
      ).toEqual([{ occurrenceID: input.info.id, text: "Commit this request atomically.", ownerID: owner.id }])
      expect((await MessageStore.get({ sessionID: owner.id, messageID: input.info.id })).parts).toEqual([
        expect.objectContaining({ id: input.parts[0]!.id, text: input.parts[0]!.text }),
      ])
    },
  })
})
