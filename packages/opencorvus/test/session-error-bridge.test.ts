import fs from "node:fs/promises"
import { afterEach, expect, test } from "bun:test"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
} from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionEvents } from "@/session/events"
import { Message } from "@/session/message"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { sessionLifecycleOrderKey } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import { Worktree } from "@/worktree"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "b".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("persists a session-scoped provider error without execution input-message authority", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({
        kind: "root",
        title: "Session error bridge",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      const now = Date.now()
      persistQueuedTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Session error bridge",
        request: "Persist the exact provider retry incident",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
        queue: true,
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

      await Bus.publish(SessionEvents.Error, {
        sessionID: root.id,
        orderKey: sessionLifecycleOrderKey(root.id),
        error: Message.fromError(new Error("provider retry incident"), { providerID: "test" }),
      })
      await awaitTaskMessageProtocolBridgeIdle()

      const events = ProtocolStore.listTaskEvents(taskID)
      expect(events.filter((event) => event.type === "session.error")).toMatchObject([
        {
          sessionID: root.id,
          payload: {
            channel: "main",
            agentID: "root",
            summary: "Error: provider retry incident",
          },
        },
      ])
    },
  })
})

test("persists terminal lifecycle after the publishing caller lease is released", async () => {
  await using project = await memoryProject()
  let releasePublication!: () => void
  const publicationReleased = new Promise<void>((resolve) => (releasePublication = resolve))
  let publication!: Promise<void>
  let taskID = ""
  let rootSessionID = ""

  await Instance.provide({
    directory: project.path,
    fn: async () => {
      taskID = Identifier.ascending("task")
      const root = await Session.create({
        kind: "root",
        title: "Released lifecycle publisher",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      rootSessionID = root.id
      const now = Date.now()
      persistQueuedTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Released lifecycle publisher",
        request: "Persist terminal lifecycle from detached ownership",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
        queue: true,
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
      const inputMessageID = Identifier.ascending("message")
      await Session.persistMessage({
        info: {
          id: inputMessageID,
          sessionID: root.id,
          role: "user",
          author: "operator",
          time: { created: now + 1 },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "released-lifecycle" },
        },
        parts: [
          {
            id: Identifier.ascending("part"),
            sessionID: root.id,
            messageID: inputMessageID,
            type: "text",
            text: "complete the detached turn",
          },
        ],
      })
      publication = (async () => {
        await publicationReleased
        await publishSessionStatus(root, { type: "terminal", reason: "completed" }, { taskID, inputMessageID })
      })()
    },
  })

  releasePublication()
  await publication
  await Instance.provide({
    directory: project.path,
    fn: () => {
      expect(
        ProtocolStore.listTaskEvents(taskID).filter((event) => event.type === "agent.execution.lifecycle"),
      ).toMatchObject([
        {
          sessionID: rootSessionID,
          payload: { status: { type: "terminal", reason: "completed" } },
        },
      ])
    },
  })
})

test("persists one projected worker error from its managed worktree with exact routing identity", async () => {
  await using project = await memoryProject()
  let taskID = ""
  let projectID = ""
  let rootSessionID = ""
  let workerSessionID = ""
  let worktreeDirectory = ""
  let agentID = ""
  let workerChannel = ""

  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "base" },
        })
        const resolvedPackageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: Instance.project.worktree,
          config,
        })
        const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: Instance.project.worktree,
          config,
          agentID: "base-planner",
          packageRevision: resolvedPackageRevision,
        })
        projectID = Instance.project.id
        taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Managed worker error root" })
        rootSessionID = root.id
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Managed worker error",
          request: "Persist one exact worktree provider error",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID,
          queue: true,
          packageRevision: resolvedPackageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: resolvedPackageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        ensureTaskMessageProtocolBridge()

        workerSessionID = Identifier.descending("session")
        const worktree = await Worktree.create({
          name: `error-bridge-${taskID.slice(-8)}`,
          taskID,
          sessionID: workerSessionID,
        })
        worktreeDirectory = await fs.realpath(worktree.directory)
        const worker = await Session.prepareNext({
          id: workerSessionID,
          kind: projection.workerCapability.identity.sessionKind,
          parentID: root.id,
          directory: worktreeDirectory,
          title: "Managed worker error source",
        })
        Session.persistPreparedNext(worker)
        agentID = projection.workerCapability.identity.agentID
        workerChannel = projection.workerCapability.identity.sessionKind
        const inputMessageID = Identifier.ascending("message")
        const inputPartID = Identifier.ascending("part")
        const controlText = "emit one managed-worktree provider error"
        await Session.persistMessage({
          info: {
            id: inputMessageID,
            sessionID: worker.id,
            role: "user",
            author: "orchestrator",
            time: { created: now + 1 },
            agent: agentID,
            model: { providerID: "test", modelID: "managed-error" },
          },
          parts: [
            {
              id: inputPartID,
              sessionID: worker.id,
              messageID: inputMessageID,
              type: "text",
              text: controlText,
            },
          ],
        })
        WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            identity: projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision: projection.workerCapability.packageRevision,
            model: { selection: "explicit", providerID: "test", modelID: "managed-error" },
            prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
            tools: { enabled: [] },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" } },
            messageAuthority: {
              user_message_id: inputMessageID,
              control_text_parts: [{ part_id: inputPartID, text_sha256: controlTextSHA256(controlText) }],
            },
          },
        })
      },
    })

    await Instance.provide({
      directory: worktreeDirectory,
      fn: async () => {
        await Bus.publish(SessionEvents.Error, {
          sessionID: workerSessionID,
          orderKey: sessionLifecycleOrderKey(workerSessionID),
          error: Message.fromError(new Error("managed worktree provider incident"), { providerID: "test" }),
        })
      },
    })
    await awaitTaskMessageProtocolBridgeIdle()

    await Instance.provide({
      directory: project.path,
      fn: () => {
        expect(ProtocolStore.listTaskEvents(taskID).filter((event) => event.type === "session.error")).toMatchObject([
          {
            sessionID: workerSessionID,
            payload: {
              channel: workerChannel,
              agentID,
              resolvedRole: agentID,
              parentSessionID: rootSessionID,
              summary: "Error: managed worktree provider incident",
            },
          },
        ])
      },
    })
  } finally {
    if (worktreeDirectory) {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Worktree.releaseManagedWorktreeSessionOwner({
            projectID,
            primaryWorktreeDir: Instance.project.worktree,
            directory: worktreeDirectory,
            sessionID: workerSessionID,
          })
          await Worktree.remove({ directory: worktreeDirectory })
        },
      })
    }
  }
}, 60_000)
