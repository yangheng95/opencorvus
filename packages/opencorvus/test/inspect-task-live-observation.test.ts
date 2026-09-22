import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
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
import { MessageStore } from "@/session/message-store"
import { Database } from "@/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

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
