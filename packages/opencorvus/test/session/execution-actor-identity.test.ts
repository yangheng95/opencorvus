import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { persistedExecutionIdentity } from "../../src/agent/persisted-execution-identity"
import { rightSidebarConversationMetadata } from "../../src/chat/identity"
import { Bus } from "../../src/bus"
import { Message } from "../../src/session/message"
import { projectConversationView } from "../../src/conversation/view"
import { Instance } from "../../src/project/instance"
import { ProtocolStore } from "../../src/protocol/store"
import { projectLifecycleProperties } from "../../src/protocol/lifecycle-projection"
import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
  overlayMeta,
  enrichMessageEventProperties,
  projectPersistedSessionMessage,
} from "../../src/orchestrator/protocol/message-bridge"
import { Session } from "../../src/session"
import { executionLifecycleOrderKey, SessionStatus } from "../../src/session/status"
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("right-sidebar and delegated inputs retain their owner through helper messages", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      for (const metadata of [rightSidebarConversationMetadata("work"), { delegation: { parentAgent: "work" } }]) {
        const session = await Session.create({ kind: "assistant", metadata })
        const input = await inputMessage(session.id, "work")
        const helper = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: input.id,
          role: "assistant",
          author: "memory",
          agent: "memory",
          time: { created: Date.now() },
          providerID: "test",
          modelID: "test",
          path: { cwd: Instance.directory, root: Instance.worktree },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
        const owner = persistedExecutionIdentity({ sessionID: session.id, inputMessageID: input.id })
        const meta = overlayMeta(session.id, "", helper)
        expect({ owner: owner.agentID, participant: meta.agentID, messageOwner: meta.sessionAgentID }).toEqual({
          owner: "work",
          participant: "memory",
          messageOwner: "work",
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: helper.id,
          type: "text",
          text: "Memory belongs to this work input.",
        })
        const view = projectConversationView({
          transcript: [
            projectPersistedSessionMessage({ info: input, parts: [] }),
            projectPersistedSessionMessage({ info: helper, parts: [part] }),
          ],
        })
        expect(view.sessions[0]?.agentID).toBe("work")
      }
    },
  })
})

test("removal projects the actual deleted user Message snapshot", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant" })
      const input = await inputMessage(session.id, "work")
      const removed = Promise.withResolvers<Record<string, unknown>>()
      const unsubscribe = Bus.subscribe(Message.Event.Removed, ({ properties }) => {
        if (properties.messageID === input.id) {
          try {
            removed.resolve(enrichMessageEventProperties(Message.Event.Removed.type, properties, session.id))
          } catch (error) {
            removed.reject(error)
          }
        }
      })
      try {
        await Session.removeMessage({ sessionID: session.id, messageID: input.id })
        expect(await removed.promise).toMatchObject({ messageID: input.id, agentID: "work", sessionAgentID: "work" })
      } finally {
        unsubscribe()
      }
    },
  })
})

test("exact input ownership reports mismatches and preserves independent Project actors", async () => {
  const owners: Array<{ sessionID: string; inputMessageID: string; agentID: string }> = []
  await using first = await tmpdir({ git: true })
  await using second = await tmpdir({ git: true })
  for (const [project, agent] of [
    [first, "coding"],
    [second, "work"],
  ] as const) {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant" })
        const input = await inputMessage(session.id, agent)
        owners.push({ sessionID: session.id, inputMessageID: input.id, agentID: agent })
      },
    })
  }
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      expect(owners.map((owner) => persistedExecutionIdentity(owner).agentID)).toEqual(["coding", "work"])
      const mismatched = { sessionID: owners[0]!.sessionID, inputMessageID: owners[1]!.inputMessageID }
      expect(() => persistedExecutionIdentity(mismatched)).toThrow(
        `Execution identity ${mismatched.sessionID}/${mismatched.inputMessageID} requires its durable user Message`,
      )
      const fixed = await Session.create({ kind: "assistant", metadata: rightSidebarConversationMetadata("chat") })
      const input = await inputMessage(fixed.id, "work")
      expect(persistedExecutionIdentity({ sessionID: fixed.id, inputMessageID: input.id }).agentID).toBe("work")
    },
  })
})

async function inputMessage(sessionID: string, agent: string) {
  return Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    time: { created: Date.now() },
    agent,
    model: { providerID: "test", modelID: "test" },
  })
}

for (const agent of ["coding", "chat", "work"]) {
  test(`generic assistant lifecycle and message retain the ${agent} execution actor`, async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: `${agent} occurrence` })
        const input = await inputMessage(session.id, agent)
        const projected = projectLifecycleProperties(
          {
            inputMessageID: input.id,
            status: { type: "streaming" },
          },
          session.id,
          { orderKey: executionLifecycleOrderKey(session.id, input.id) },
        )
        expect({ actor: projected.agentID, owner: overlayMeta(session.id, "", input).sessionAgentID }).toEqual({
          actor: agent,
          owner: agent,
        })
      },
    })
  })
}

test("persisted lifecycle and messages retain exact actors through a Work surface upgrade and restart", async () => {
  await using project = await tmpdir({ git: true })
  let sessionID = ""
  const inputs: Array<{ id: string; agent: string; reason: string }> = []
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      ensureTaskMessageProtocolBridge()
      const session = await Session.create({ kind: "assistant", title: "independent actors" })
      sessionID = session.id
      for (const [agent, reason] of [["coding", "completed"], ["work", "aborted"], ["chat", "error"]] as const) {
        const input = await inputMessage(session.id, agent)
        inputs.push({ id: input.id, agent, reason })
        await Session.updateMessage({
          id: Identifier.ascending("message"), sessionID, parentID: input.id,
          role: "assistant", author: agent, agent,
          time: { created: Date.now(), completed: Date.now() },
          providerID: "test", modelID: "test",
          path: { cwd: Instance.directory, root: Instance.worktree }, cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
        SessionStatus.beginExecutionOccurrence(session.id, input.id, new AbortController().signal)
        await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: input.id })
        const retry = { type: "retry", attempt: 1, message: "Provider retry", next: Date.now() + 100 } as const
        await SessionStatus.set(session.id, retry, { inputMessageID: input.id })
        await awaitTaskMessageProtocolBridgeIdle()
        expect(ProtocolStore.latestSessionOccurrenceEvent(sessionID, "agent.execution.lifecycle", input.id)?.payload).toMatchObject({
          agentID: agent, inputMessageID: input.id, status: retry,
        })
        await SessionStatus.set(session.id, { type: "terminal", reason }, { inputMessageID: input.id })
      }
      await awaitTaskMessageProtocolBridgeIdle()
      await Session.mergeMetadata({ sessionID, patch: rightSidebarConversationMetadata("work") })
      expect(
        inputs.map(({ id }) => persistedExecutionIdentity({ sessionID, inputMessageID: id }).agentID),
      ).toEqual(["coding", "work", "chat"])
      expect(
        (await Session.messages({ sessionID })).map((message) => projectPersistedSessionMessage(message).info.agentID),
      ).toEqual(["coding", "coding", "work", "work", "chat", "chat"])
      expect(
        inputs.map(
          ({ id }) => ProtocolStore.latestSessionOccurrenceEvent(sessionID, "agent.execution.lifecycle", id)?.payload,
        ),
      ).toEqual(
        inputs.map(({ id, agent, reason }) =>
          expect.objectContaining({
            inputMessageID: id,
            agentID: agent,
            status: { type: "terminal", reason },
          }),
        ),
      )
    },
  })
  await Instance.disposeAll()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      expect(
        inputs.map(
          ({ id }) =>
            ProtocolStore.latestSessionOccurrenceEvent(sessionID, "agent.execution.lifecycle", id)?.payload?.agentID,
        ),
      ).toEqual(["coding", "work", "chat"])
      expect(
        (await Session.messages({ sessionID })).map((message) => projectPersistedSessionMessage(message).info.agentID),
      ).toEqual(["coding", "coding", "work", "work", "chat", "chat"])
      expect(
        inputs.map(({ id }) => persistedExecutionIdentity({ sessionID, inputMessageID: id }).agentID),
      ).toEqual(["coding", "work", "chat"])
    },
  })
})
