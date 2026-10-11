import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Bus } from "@/bus"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
} from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { EngineRoutes } from "@/server/routes/orchestrator"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Database } from "@/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { captureApiAuthority } from "../../overlay/src/services/api"
import {
  createSubagentConversationLiveProjection,
  mergeSubagentConversation,
  observeSubagentConversationLiveEvent,
  parseSubagentConversation,
  projectSubagentConversationLive,
  reconcileSubagentConversationLive,
} from "../../overlay/src/services/subagent-conversation"

afterEach(resetMemoryDatabase)

async function taskWithStreamingSession() {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Inspect observation" })
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.09.1",
    packageDigest: "a".repeat(64),
  }
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Inspect observation",
    request: "Observe live Task activity",
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
  ensureTaskMessageProtocolBridge()
  const session = await Session.create({ kind: "orchestrator", parentID: root.id, title: "Task Orchestrator" })
  const parentID = Identifier.ascending("message")
  await Session.updateMessage({
    id: parentID,
    sessionID: session.id,
    role: "user",
    author: "user",
    agent: "orchestrator",
    model: { providerID: "test", modelID: "local-contract" },
    time: { created: now },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: parentID,
    type: "text",
    text: "Read the current conversation identity",
  })
  const messageID = Identifier.ascending("message")
  await Session.updateMessage({
    id: messageID,
    parentID,
    sessionID: session.id,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    providerID: "test",
    modelID: "local-contract",
    time: { created: now + 1 },
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  const partID = Identifier.ascending("part")
  await Session.updatePart({
    id: partID,
    sessionID: session.id,
    messageID,
    type: "reasoning",
    text: "",
    time: { start: now + 1 },
  })
  await Database.awaitEffectIdle(5_000)
  await awaitTaskMessageProtocolBridgeIdle()
  return { taskID, rootSessionID: root.id, sessionID: session.id, messageID, partID }
}

test("Task child hydration preserves current Part membership after a real source withdrawal", async () => {
  await using project = await memoryProject("task-source-withdrawal")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await taskWithStreamingSession()
      const body = await Session.updatePart({
        id: Identifier.ascending("part"), sessionID: owner.sessionID, messageID: owner.messageID,
        type: "text", text: "Current answer after the source is withdrawn.",
      })
      const source = await Session.updatePart({
        id: Identifier.ascending("part"), sessionID: owner.sessionID, messageID: owner.messageID,
        type: "source-url", sourceId: "withdrawn-source", url: "https://example.com/withdrawn", title: "Withdrawn source",
      })
      await Database.awaitEffectIdle(5_000)
      await awaitTaskMessageProtocolBridgeIdle()
      const route = new Hono().route("/", EngineRoutes())
      const endpoint = `/task/${owner.taskID}/conversation/session/${owner.sessionID}`
      const target = {
        source: { kind: "task" as const, id: owner.taskID }, sessionID: owner.sessionID,
        directory: project.path, authority: captureApiAuthority(),
      }
      const response = await route.request(endpoint)
      expect(response.status).toBe(200)
      const before = parseSubagentConversation(target, await response.json())
      const beforeParts = before.messages.find((message) => message.messageID === owner.messageID)!.parts
      expect(beforeParts.map((part) => part.id)).toEqual([body.id, source.id])
      const live = beforeParts.reduce((current, part) => observeSubagentConversationLiveEvent(current, {
        type: "message.part.updated", payload: { part },
      }), createSubagentConversationLiveProjection(owner.sessionID))
      expect(await Session.removePart({ sessionID: owner.sessionID, messageID: owner.messageID, partID: source.id })).toBe(source.id)
      await Database.awaitEffectIdle(5_000)
      await awaitTaskMessageProtocolBridgeIdle()
      const query = new URLSearchParams({ after_live_epoch: String(before.liveEpoch), after_live_sequence: String(before.lastLiveSequence) })
      for (const path of [`${endpoint}?${query}`, endpoint]) {
        const updatedResponse = await route.request(path)
        expect(updatedResponse.status).toBe(200)
        const next = parseSubagentConversation(target, await updatedResponse.json())
        expect(next.messages.find((message) => message.messageID === owner.messageID)!.parts).toEqual([body])
        const projected = projectSubagentConversationLive(mergeSubagentConversation(before, next), live)
        expect(projected.messages.find((message) => message.messageID === owner.messageID)!.parts).toEqual([body])
        expect(projected.removedPartIDs).toEqual({ [owner.messageID]: [source.id] })
      }
    },
  })
}, 30_000)

test.each(["withdrawn", "replaced", "restored"] as const)("first child read owns the actual %s source over earlier live observations", async (change) => {
  await using project = await memoryProject(`first-source-${change}`)
  await Instance.provide({ directory: project.path, fn: async () => {
    const owner = await taskWithStreamingSession()
    const body = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: owner.sessionID, messageID: owner.messageID, type: "text", text: "Current source evidence." })
    const source = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: owner.sessionID, messageID: owner.messageID, type: "source-url", sourceId: "changing-source", url: "https://example.com/original", title: "Original title" })
    await Database.awaitEffectIdle(5_000)
    await awaitTaskMessageProtocolBridgeIdle()
    const route = new Hono().route("/", EngineRoutes())
    const endpoint = `/task/${owner.taskID}/conversation/session/${owner.sessionID}`
    const target = { source: { kind: "task" as const, id: owner.taskID }, sessionID: owner.sessionID, directory: project.path, authority: captureApiAuthority() }
    const initialResponse = await route.request(endpoint)
    expect(initialResponse.status).toBe(200)
    const initial = parseSubagentConversation(target, await initialResponse.json())
    const observedParts = initial.messages.find((message) => message.messageID === owner.messageID)!.parts
    let live = observedParts.reduce((current, part) => observeSubagentConversationLiveEvent(current, {
      type: "message.part.updated", payload: { part },
    }), createSubagentConversationLiveProjection(owner.sessionID))
    let expectedParts = [body, source]
    {
      const unsubscribe = Bus.subscribe(Message.Event.PartRemoved, (event) => {
        if (change === "restored" && event.properties.partID === source.id) {
          live = observeSubagentConversationLiveEvent(live, { type: Message.Event.PartRemoved.type, payload: event.properties })
        }
      })
      try {
        await Session.removePart({ sessionID: owner.sessionID, messageID: owner.messageID, partID: source.id })
        await Database.awaitEffectIdle(5_000)
      } finally { unsubscribe() }
      expectedParts = [body]
    }
    if (change === "replaced" || change === "restored") {
      const current = await Session.updatePart({ id: change === "replaced" ? Identifier.ascending("part") : source.id, sessionID: owner.sessionID, messageID: owner.messageID, type: "source-url", sourceId: "current-source", title: "Current title", url: "https://example.com/current" })
      expectedParts = [body, current]
    }
    await Database.awaitEffectIdle(5_000)
    await awaitTaskMessageProtocolBridgeIdle()
    const observedLive = live
    const response = await route.request(endpoint)
    expect(response.status).toBe(200)
    const incoming = parseSubagentConversation(target, await response.json())
    expect(incoming.messages.find((message) => message.messageID === owner.messageID)!.parts).toEqual(expectedParts)
    const projected = projectSubagentConversationLive(incoming, reconcileSubagentConversationLive(incoming, observedLive, live))
    expect(projected.messages.find((message) => message.messageID === owner.messageID)!.parts).toEqual(expectedParts)
  } })
}, 30_000)

test.each(["retained", "withdrawn"] as const)("first child read projects a %s text Part using its real persisted membership", async (change) => {
  await using project = await memoryProject(`first-text-${change}`)
  await Instance.provide({ directory: project.path, fn: async () => {
    const owner = await taskWithStreamingSession()
    const text = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: owner.sessionID, messageID: owner.messageID, type: "text", text: "" })
    const source = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: owner.sessionID, messageID: owner.messageID, type: "source-url", sourceId: "current-source", url: "https://example.com/current", title: "Current source" })
    await Database.awaitEffectIdle(5_000)
    await awaitTaskMessageProtocolBridgeIdle()
    const route = new Hono().route("/", EngineRoutes())
    const endpoint = `/task/${owner.taskID}/conversation/session/${owner.sessionID}`
    const target = { source: { kind: "task" as const, id: owner.taskID }, sessionID: owner.sessionID, directory: project.path, authority: captureApiAuthority() }
    const response = await route.request(endpoint)
    expect(response.status).toBe(200)
    const before = parseSubagentConversation(target, await response.json())
    const parts = before.messages.find((message) => message.messageID === owner.messageID)!.parts
    expect(parts).toEqual([text, source])
    let live = parts.reduce((current, part) => observeSubagentConversationLiveEvent(current, { type: "message.part.updated", payload: { part } }), createSubagentConversationLiveProjection(owner.sessionID))
    const accepted = "Accepted unpersisted text"
    const stop = Bus.subscribe(Message.Event.PartDelta, (event) => {
      if (event.properties.partID === text.id) live = observeSubagentConversationLiveEvent(live, { type: Message.Event.PartDelta.type, payload: event.properties })
    })
    try {
      await Session.updatePartDelta({ sessionID: owner.sessionID, messageID: owner.messageID, partID: text.id, partType: "text", field: "text", delta: accepted, value: accepted })
    } finally { stop() }
    if (change === "withdrawn") await Session.removePart({ sessionID: owner.sessionID, messageID: owner.messageID, partID: text.id })
    await Database.awaitEffectIdle(5_000)
    await awaitTaskMessageProtocolBridgeIdle()
    const observed = live
    const currentResponse = await route.request(endpoint)
    expect(currentResponse.status).toBe(200)
    const incoming = parseSubagentConversation(target, await currentResponse.json())
    expect(incoming.messages.find((message) => message.messageID === owner.messageID)!.parts).toEqual(change === "retained" ? [text, source] : [source])
    const projected = projectSubagentConversationLive(incoming, reconcileSubagentConversationLive(incoming, observed, live))
    expect(projected.messages.find((message) => message.messageID === owner.messageID)!.parts).toEqual(change === "retained" ? [{ ...text, text: accepted }, source] : [source])
  } })
}, 30_000)

test("Task child snapshot and changed-message delta retain a real control-only assistant identity", async () => {
  await using project = await memoryProject("task-control-only-identity")
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = await taskWithStreamingSession()
      const stored = await Session.messages({ sessionID: owner.sessionID })
      const input = stored.find((message) => message.info.role === "user")!
      const control = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: owner.sessionID,
        messageID: owner.messageID,
        type: "step-start",
      })
      await Database.awaitEffectIdle(5_000)
      await awaitTaskMessageProtocolBridgeIdle()
      const route = new Hono().route("/", EngineRoutes())
      const response = await route.request(`/task/${owner.taskID}/conversation/session/${owner.sessionID}`)
      expect(response.status).toBe(200)
      const snapshot = await response.json()
      expect(snapshot.transcript.map((message: { info: { id: string } }) => message.info.id)).toEqual([
        input.info.id,
        owner.messageID,
      ])
      expect(snapshot.transcript[1]).toMatchObject({
        info: { id: owner.messageID, sessionID: owner.sessionID, author: "orchestrator", parentID: input.info.id },
        parts: [{ id: control.id, type: "step-start", messageID: owner.messageID, sessionID: owner.sessionID }],
      })
      expect(snapshot.view.messages.map((message: { messageID: string }) => message.messageID)).toEqual([input.info.id])
      expect(
        snapshot.view.sessions.find((session: { sessionID: string }) => session.sessionID === owner.sessionID)
          .messageIDs,
      ).toEqual([input.info.id, owner.messageID])
      const target = {
        source: { kind: "task" as const, id: owner.taskID },
        sessionID: owner.sessionID,
        directory: project.path,
        authority: captureApiAuthority(),
      }
      const parsedSnapshot = parseSubagentConversation(target, snapshot)
      expect(parsedSnapshot.messages.map((message) => message.messageID)).toEqual([input.info.id, owner.messageID])

      const assistant = stored.find((message) => message.info.id === owner.messageID)!
      if (assistant.info.role !== "assistant") throw new Error("Current identity fixture requires its real assistant")
      await Session.updateMessage({ ...assistant.info, cost: 1 })
      await Database.awaitEffectIdle(5_000)
      await awaitTaskMessageProtocolBridgeIdle()
      const query = new URLSearchParams({
        after_live_epoch: String(snapshot.liveEpoch),
        after_live_sequence: String(snapshot.lastLiveSequence),
      })
      const deltaResponse = await route.request(
        `/task/${owner.taskID}/conversation/session/${owner.sessionID}?${query}`,
      )
      expect(deltaResponse.status).toBe(200)
      const delta = await deltaResponse.json()
      expect(delta).toMatchObject({ transcriptMode: "delta", liveEpoch: snapshot.liveEpoch })
      expect(
        delta.transcript.map((message: { info: { id: string; cost: number } }) => ({
          id: message.info.id,
          cost: message.info.cost,
        })),
      ).toEqual([{ id: owner.messageID, cost: 1 }])
      expect(
        delta.view.sessions.find((session: { sessionID: string }) => session.sessionID === owner.sessionID).messageIDs,
      ).toEqual([owner.messageID])
      const merged = mergeSubagentConversation(parsedSnapshot, parseSubagentConversation(target, delta))
      expect(merged.messages.map((message) => ({ id: message.messageID, role: message.info.role }))).toEqual([
        { id: input.info.id, role: "user" },
        { id: owner.messageID, role: "assistant" },
      ])
      expect(merged.messages[1].info.cost).toBe(1)
    },
  })
}, 30_000)

test("Inspect observes real unpersisted descendant reasoning through the Task HTTP live cursor", async () => {
  await using project = await memoryProject("inspect-live-owner")
  await using otherProject = await memoryProject("inspect-live-other")
  const owner = await Instance.provide({ directory: project.path, fn: taskWithStreamingSession })
  const other = await Instance.provide({ directory: otherProject.path, fn: taskWithStreamingSession })
  const route = new Hono().route("/", EngineRoutes())
  const read = () =>
    Instance.provide({
      directory: project.path,
      fn: async () => {
        const response = await route.request(`/task/${owner.taskID}/conversation/session/${owner.rootSessionID}`)
        expect(response.status).toBe(200)
        return (await response.json()) as { liveEpoch: number; lastLiveSequence: number }
      },
    })
  const before = await read()
  const delta = (target: typeof owner) =>
    Session.updatePartDelta({
      sessionID: target.sessionID,
      messageID: target.messageID,
      partID: target.partID,
      partType: "reasoning",
      field: "text",
      delta: "local streaming activity",
      value: "local streaming activity",
    })
  await Instance.provide({ directory: project.path, fn: () => delta(owner) })
  await awaitTaskMessageProtocolBridgeIdle()
  const after = await read()
  expect({ epoch: after.liveEpoch, sequence: after.lastLiveSequence }).toEqual({
    epoch: before.liveEpoch,
    sequence: before.lastLiveSequence + 1,
  })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const persisted = await MessageStore.part({
        sessionID: owner.sessionID,
        messageID: owner.messageID,
        partID: owner.partID,
      })
      expect(persisted).toMatchObject({ type: "reasoning", text: "" })
      const query = new URLSearchParams({
        after_live_epoch: String(before.liveEpoch),
        after_live_sequence: String(before.lastLiveSequence),
      })
      const response = await route.request(`/task/${owner.taskID}/conversation/session/${owner.rootSessionID}?${query}`)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        transcriptMode: "delta",
        liveEpoch: after.liveEpoch,
        lastLiveSequence: after.lastLiveSequence,
      })
    },
  })
  const otherBefore = ProtocolStore.currentTaskLiveSequence(other.taskID)
  await Instance.provide({ directory: otherProject.path, fn: () => delta(other) })
  await awaitTaskMessageProtocolBridgeIdle()
  expect(ProtocolStore.currentTaskLiveSequence(other.taskID)).toBe(otherBefore + 1)
  const isolated = await read()
  expect({ epoch: isolated.liveEpoch, sequence: isolated.lastLiveSequence }).toEqual({
    epoch: after.liveEpoch,
    sequence: after.lastLiveSequence,
  })
}, 30_000)
