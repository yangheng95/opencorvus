import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import {
  assertSessionDeletionAdmissionInTransaction,
  assertSessionDeletionAuthorityInTransaction,
  claimSessionDeletionCleanup,
  closeSessionDeletionAuthority,
  createSessionDeletionCleanupPlan,
  recoverSessionDeletionCleanup,
  releaseSessionDeletionAuthorityInTransaction,
  rollbackSessionDeletionCleanup,
  SessionDeletionFenceError,
  SessionDeletionRuntimeNotSettledError,
  SessionDeletionCleanupTestHooks,
  stageSessionDeletionCleanup,
} from "@/session/deletion-cleanup"
import { SessionTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"
import { observeRuntimeProcessOccurrence, replaceRuntimeOccurrenceIDForTest } from "@/runtime/process-occurrence"
import { createRightSidebarConversationSession } from "@/chat/session"
import { createPanelUIRequestToolContext, PanelTool } from "@/tool/panel"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionPrompt } from "@/session/prompt"
import { materializeUserMessage, persistMaterializedUserMessage } from "@/session/prompt/parts"
import { PermissionAuthority } from "@/permission/authority"
import { Identifier } from "@/id/id"
import { Config } from "@/config/config"
import { Bus } from "@/bus"
import { SessionPromptState } from "@/session/prompt/state"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function pathStatus(target: string): Promise<"present" | "missing"> {
  return fs.stat(target).then(
    () => "present" as const,
    (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
  )
}

async function cleanupManifestRoots(): Promise<void> {
  await fs.rm(path.dirname(SessionDeletionCleanupTestHooks.activeRoot()), { recursive: true, force: true })
}

afterEach(async () => {
  await Instance.disposeAll()
  await cleanupManifestRoots()
  await resetMemoryDatabase()
})

describe("standalone Session deletion cleanup", () => {
  test("retained tombstone is the serializable Prompt, Message, and Permission admission boundary", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({
          kind: "mission",
          title: "Retained deletion admission boundary",
          metadata: {
            mission: {
              id: "retained-deletion-admission",
              channelKey: "mission:retained-deletion-admission",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        const promptInput = {
          sessionID: session.id,
          author: "user" as const,
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
          noReply: true,
          parts: [{ type: "text" as const, text: "Prepared before the retained deletion boundary." }],
        }
        const persistedMaterialized = await materializeUserMessage(promptInput)
        const persistedMessage = structuredClone(persistedMaterialized.info)
        const persistedPart = structuredClone(persistedMaterialized.parts[0]!)
        await persistMaterializedUserMessage(persistedMaterialized)
        const progressAssistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: persistedMessage.id,
          sessionID: session.id,
          role: "assistant",
          author: "mission",
          agent: "mission",
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: persistedMessage.time.created + 1 },
        })
        const progressPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: progressAssistant.id,
          type: "tool",
          tool: "webfetch",
          callID: "retained-deletion-progress",
          state: {
            status: "running",
            input: { url: "https://example.test/retained-deletion-progress" },
            time: { start: persistedMessage.time.created + 2 },
          },
        })
        const preparedMessage = await materializeUserMessage({
          ...promptInput,
          parts: [{ type: "text" as const, text: "Prepared for admission after the retained boundary." }],
        })
        const preparedChild = await Session.prepareNext({
          directory: session.directory,
          parentID: session.id,
          kind: "assistant",
          title: "Prepared before retained deletion",
        })
        const deletion = await EngineService.deleteSession(session.id, { projectID: session.projectID })
        const promptAdmission = (() => {
          try {
            return SessionPromptOwner.acquire({
              sessionID: session.id,
              projectID: session.projectID,
              directory: session.directory,
            })
          } catch (error) {
            return error
          }
        })()
        const messageAdmission = await persistMaterializedUserMessage(preparedMessage).catch((error) => error)
        const childAdmission = (() => {
          try {
            return Session.persistPreparedNext(preparedChild)
          } catch (error) {
            return error
          }
        })()
        const snapshotAdmission = await Session.importSnapshot({ info: session, messages: [] }).catch((error) => error)
        const childSnapshotAdmission = await Session.importSnapshot({
          info: preparedChild,
          messages: [],
        }).catch((error) => error)
        const permissionAdmission = await PermissionAuthority.authorizeAndExecute(
          {
            projectID: session.projectID,
            sessionID: session.id,
            messageID: Identifier.ascending("message"),
            toolCallID: "retained-deletion-permission",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.test/retained-deletion" },
          },
          async () => "must-not-run",
        ).catch((error) => error)
        const rootRecreation = (() => {
          try {
            return Session.persistPreparedNext(session)
          } catch (error) {
            return error
          }
        })()
        const messageUpdate = await Session.updateMessage(persistedMessage).catch((error) => error)
        const partUpdate = await Session.updatePart(persistedPart).catch((error) => error)
        const { id: _partID, messageID: _messageID, sessionID: _sessionID, orderKey: _orderKey, ...partData } =
          persistedPart
        const partDataUpdate = await Session.updatePartData({ partID: persistedPart.id, data: partData }).catch(
          (error) => error,
        )
        const progressUpdate = await Session.appendToolProgress({
          sessionID: session.id,
          messageID: progressAssistant.id,
          partID: progressPart.id,
          metadata: { phase: "after-retained-deletion" },
        }).catch((error) => error)
        const sessionUpdate = await Session.setTitle({
          sessionID: session.id,
          title: "Must not mutate after retained deletion",
        }).catch((error) => error)
        const directAdmission = (() => {
          try {
            Database.immediateTransaction((db) => assertSessionDeletionAdmissionInTransaction(db, session.id))
            return "admitted"
          } catch (error) {
            return error
          }
        })()
        expect({
          deletion,
          promptFenced: promptAdmission instanceof SessionDeletionFenceError,
          messageFenced: messageAdmission instanceof SessionDeletionFenceError,
          childFenced: childAdmission instanceof SessionDeletionFenceError,
          snapshotFenced: snapshotAdmission instanceof SessionDeletionFenceError,
          childSnapshotFenced: childSnapshotAdmission instanceof SessionDeletionFenceError,
          permissionFenced: permissionAdmission instanceof SessionDeletionFenceError,
          rootRecreationFenced: rootRecreation instanceof SessionDeletionFenceError,
          messageUpdateFenced: messageUpdate instanceof SessionDeletionFenceError,
          partUpdateFenced: partUpdate instanceof SessionDeletionFenceError,
          partDataUpdateFenced: partDataUpdate instanceof SessionDeletionFenceError,
          progressUpdateFenced: progressUpdate instanceof SessionDeletionFenceError,
          sessionUpdateFenced: sessionUpdate instanceof SessionDeletionFenceError,
          transactionFenced: directAdmission instanceof SessionDeletionFenceError,
        }).toEqual({
          deletion: {
            ok: true,
            status: "tombstoned",
            sessionID: session.id,
            sessionHistoryRetained: true,
            authorizationAuditRetained: true,
            residue: [],
          },
          promptFenced: true,
          messageFenced: true,
          childFenced: true,
          snapshotFenced: true,
          childSnapshotFenced: true,
          permissionFenced: true,
          rootRecreationFenced: true,
          messageUpdateFenced: true,
          partUpdateFenced: true,
          partDataUpdateFenced: true,
          progressUpdateFenced: true,
          sessionUpdateFenced: true,
          transactionFenced: true,
        })
      },
    })
  })

  test("retained deletion settles Prompt and Permission admitted at the terminal boundary", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({
          kind: "mission",
          title: "Retained deletion terminal admission race",
          metadata: {
            mission: {
              id: "retained-deletion-terminal-race",
              channelKey: "mission:retained-deletion-terminal-race",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        let hookRuns = 0
        let executed = false
        let permissionDisposition: Promise<unknown> | undefined
        let boundaryChildID: string | undefined
        await using hook = SessionDeletionCleanupTestHooks.installBeforeRetainedBoundaryCommit(
          async (rootSessionID) => {
            if (rootSessionID !== session.id || hookRuns++ > 0) return
            const owner = SessionPromptState.start(session.id, session.directory)
            if (!owner) throw new Error("Expected the real retained-deletion Prompt owner")
            const boundaryChild = await Session.createNext({
              directory: session.directory,
              parentID: session.id,
              kind: "assistant",
              title: "Child admitted at retained deletion boundary",
            })
            boundaryChildID = boundaryChild.id
            let resolveRequest!: () => void
            const asked = new Promise<void>((resolve) => (resolveRequest = resolve))
            const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
              if (properties.sessionID === session.id) resolveRequest()
            })
            permissionDisposition = PermissionAuthority.authorizeAndExecute(
              {
                projectID: session.projectID,
                sessionID: session.id,
                messageID: Identifier.ascending("message"),
                toolCallID: "retained-deletion-terminal-race",
                providerKind: "builtin",
                providerID: "builtin",
                toolName: "webfetch",
                args: { url: "https://example.test/retained-deletion-terminal-race" },
              },
              async () => {
                executed = true
                return "must-not-run"
              },
            )
              .catch((error) => error)
              .finally(() => SessionPromptState.finish(session.id, owner, session.directory))
            try {
              await asked
            } finally {
              stop()
            }
          },
        )

        const deletion = await EngineService.deleteSession(session.id, { projectID: session.projectID })
        const settled = await permissionDisposition
        expect({
          deletion,
          permissionRejected: settled instanceof PermissionAuthority.RejectedError,
          history: (await PermissionAuthority.history()).map((row) => row.event_type),
          executed,
          hookRuns,
          childTombstoned: boundaryChildID
            ? Database.use((db) => Session.deletedInTransaction(db, boundaryChildID!))
            : false,
        }).toEqual({
          deletion: {
            ok: true,
            status: "tombstoned",
            sessionID: session.id,
            sessionHistoryRetained: true,
            authorizationAuditRetained: true,
            residue: [],
          },
          permissionRejected: true,
          history: ["cancelled", "requested"],
          executed: false,
          hookRuns: 2,
          childTombstoned: true,
        })
      },
    })
  })

  test("retained Permission settlement observes its absolute deadline after a batch is selected", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({
          kind: "mission",
          title: "Retained Permission settlement deadline",
          metadata: {
            mission: {
              id: "retained-permission-deadline",
              channelKey: "mission:retained-permission-deadline",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        let resolveRequest!: () => void
        const asked = new Promise<void>((resolve) => (resolveRequest = resolve))
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
          if (properties.sessionID === session.id) resolveRequest()
        })
        const execution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: session.projectID,
            sessionID: session.id,
            messageID: Identifier.ascending("message"),
            toolCallID: "retained-permission-deadline",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.test/retained-permission-deadline" },
          },
          async () => "must-not-run",
        ).catch((error) => error)
        try {
          await asked
        } finally {
          stop()
        }
        const deadlineStarted = Date.now()
        const deadlineResult = await (async () => {
          await using hook = PermissionAuthority.TestHooks.installAfterSessionDeletionBatchSelected(async (input) => {
            if (input.sessionIDs.includes(session.id)) await Bun.sleep(100)
          })
          return await PermissionAuthority.cancelPendingForSessions(
            [session.id],
            "deadline probe",
            "system",
            { maxBatchesPerPage: 1, deadline: Date.now() + 20 },
          ).catch((error) => error)
        })()
        const cancelled = await PermissionAuthority.cancelPendingForSessions(
          [session.id],
          "deadline probe completed",
          "system",
          { maxBatchesPerPage: 1, deadline: Date.now() + 5_000 },
        )
        expect({
          deadlineTyped: deadlineResult instanceof SessionDeletionRuntimeNotSettledError,
          deadlineElapsed: Date.now() - deadlineStarted < 250,
          cancelled,
          executionRejected: (await execution) instanceof PermissionAuthority.RejectedError,
        }).toEqual({
          deadlineTyped: true,
          deadlineElapsed: true,
          cancelled: 1,
          executionRejected: true,
        })
      },
    })
  })

  test("retained deletion observes an allowed Permission effect until its durable outcome commits", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({
          kind: "mission",
          title: "Retained Permission effect fence",
          metadata: {
            mission: {
              id: "retained-permission-effect-fence",
              channelKey: "mission:retained-permission-effect-fence",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        let resolveRequest!: (request: PermissionAuthority.Request) => void
        let resolveAuthorized!: () => void
        let releaseAuthorization!: () => void
        let resolveExecutionStart!: () => void
        let releaseExecution!: () => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveRequest = resolve))
        const authorized = new Promise<void>((resolve) => (resolveAuthorized = resolve))
        const authorizationRelease = new Promise<void>((resolve) => (releaseAuthorization = resolve))
        const executionStarted = new Promise<void>((resolve) => (resolveExecutionStart = resolve))
        const executionRelease = new Promise<void>((resolve) => (releaseExecution = resolve))
        await using authorizationHook = PermissionAuthority.TestHooks.installAfterAuthorizationBeforeExecutionStart(
          async (request) => {
            if (request.sessionID !== session.id) return
            resolveAuthorized()
            await authorizationRelease
          },
        )
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
          if (properties.sessionID === session.id) resolveRequest(properties)
        })
        const execution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: session.projectID,
            sessionID: session.id,
            messageID: Identifier.ascending("message"),
            toolCallID: "retained-permission-effect-fence",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://example.test/retained-permission-effect-fence" },
          },
          async () => {
            resolveExecutionStart()
            await executionRelease
            return "effect-settled"
          },
        )
        const request = await asked
        stop()
        await PermissionAuthority.reply({
          requestID: request.id,
          decision: "allow_once",
          actorID: "retained-deletion-race",
          autoReply: false,
        })
        await authorized
        let terminalRounds = 0
        let nextTerminalRound = Promise.withResolvers<void>()
        await using terminalHook = SessionDeletionCleanupTestHooks.installBeforeRetainedBoundaryCommit(
          (rootSessionID) => {
            if (rootSessionID !== session.id) return
            terminalRounds += 1
            nextTerminalRound.resolve()
          },
        )
        let authorizedDisposition: unknown
        let authorizedTerminalRounds = 0
        {
          using _deadline = SessionDeletionCleanupTestHooks.installRetainedSettlementTimeout((rootSessionID) =>
            rootSessionID === session.id ? 40 : 60_000,
          )
          authorizedDisposition = await EngineService.deleteSession(session.id, {
            projectID: session.projectID,
          }).catch((error) => error)
          authorizedTerminalRounds = terminalRounds
        }
        releaseAuthorization()
        await executionStarted
        nextTerminalRound = Promise.withResolvers<void>()
        const deletionPromise = EngineService.deleteSession(session.id, { projectID: session.projectID })
        await nextTerminalRound.promise
        const liveTerminalRounds = terminalRounds
        releaseExecution()
        const result = await execution
        const deletion = await deletionPromise
        expect({
          authorizedContinuationFenced: authorizedDisposition instanceof SessionDeletionRuntimeNotSettledError,
          authorizedTerminalRounds,
          liveEffectObservedByDeletion: liveTerminalRounds > authorizedTerminalRounds,
          totalTerminalRounds: terminalRounds,
          result,
          deletion,
        }).toEqual({
          authorizedContinuationFenced: true,
          authorizedTerminalRounds: 1,
          liveEffectObservedByDeletion: true,
          totalTerminalRounds: 3,
          result: "effect-settled",
          deletion: {
            ok: true,
            status: "tombstoned",
            sessionID: session.id,
            sessionHistoryRetained: true,
            authorizationAuditRetained: true,
            residue: [],
          },
        })
      },
    })
  })

  test("returns the physical cleanup disposition from the public Session route", async () => {
    await using project = await memoryProject()
    const session = await Instance.provide({
      directory: project.path,
      fn: () => Session.create({ kind: "root", title: "Public deletion disposition" }),
    })
    const response = await Server.App().request(`/session/${session.id}`, {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 200,
      body: {
        ok: true,
        status: "physically_deleted",
        sessionID: session.id,
        sessionHistoryRetained: false,
        authorizationAuditRetained: true,
        cleanupOperationID: expect.any(String),
        residue: [],
      },
    })
    const recreation = await Instance.provide({
      directory: project.path,
      fn: async () => {
        try {
          return Session.persistPreparedNext(session)
        } catch (error) {
          return error
        }
      },
    })
    expect(recreation).toBeInstanceOf(SessionDeletionFenceError)
    const replay = await Server.App().request(`/session/${session.id}`, {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: replay.status, body: await replay.json() }).toEqual({
      status: 200,
      body: {
        ok: true,
        status: "physically_deleted",
        sessionID: session.id,
        sessionHistoryRetained: false,
        authorizationAuditRetained: true,
        cleanupOperationID: expect.any(String),
        residue: [],
      },
    })
  }, 60_000)

  test("replays a committed right-sidebar deletion through its exact public authority", async () => {
    await using project = await memoryProject()
    const session = await Instance.provide({
      directory: project.path,
      fn: () => createRightSidebarConversationSession("chat"),
    })
    const request = () =>
      Server.App().request(`/coding/chat/session/${session.id}`, {
        method: "DELETE",
        headers: { "x-opencorvus-directory": project.path },
      })
    const first = await request()
    const firstBody = await first.json()
    const completedName = (await fs.readdir(SessionDeletionCleanupTestHooks.completedRoot()))[0]!
    const completedManifest = JSON.parse(
      await fs.readFile(path.join(SessionDeletionCleanupTestHooks.completedRoot(), completedName), "utf8"),
    )
    expect(completedManifest.rootIdentity).toEqual({ kind: "assistant", conversationExperience: "chat" })
    const replay = await request()
    expect({
      first: { status: first.status, body: firstBody },
      replay: { status: replay.status, body: await replay.json() },
    }).toEqual({
      first: { status: 200, body: expect.objectContaining({ status: "physically_deleted", sessionID: session.id }) },
      replay: { status: 200, body: firstBody },
    })
    const wrongAuthority = await Server.App().request(`/coding/work/session/${session.id}`, {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })
    expect(wrongAuthority.status).toBe(404)
  }, 60_000)

  test("replays an audit-retained tombstone through the public Session route", async () => {
    await using project = await memoryProject()
    const session = await Instance.provide({
      directory: project.path,
      fn: () =>
        Session.create({
          kind: "assistant",
          title: "Retained public replay",
          metadata: { globalChatStart: { request_id: "retained-public-replay" } },
        }),
    })
    const request = () =>
      Server.App().request(`/session/${session.id}`, {
        method: "DELETE",
        headers: { "x-opencorvus-directory": project.path },
      })
    const first = await request()
    const body = await first.json()
    const replay = await request()
    expect({
      first: { status: first.status, body },
      replay: { status: replay.status, body: await replay.json() },
    }).toEqual({
      first: {
        status: 200,
        body: {
          ok: true,
          status: "tombstoned",
          sessionID: session.id,
          sessionHistoryRetained: true,
          authorizationAuditRetained: true,
          residue: [],
        },
      },
      replay: { status: 200, body },
    })
    const panel = await PanelTool.init({ agentID: "panel_ui" })
    const panelReplay = await Instance.provide({
      directory: project.path,
      fn: () =>
        panel.execute(
          { action: "delete_session", sessionID: session.id },
          createPanelUIRequestToolContext({ surface: "panel", requestID: randomUUID() }),
        ),
    })
    expect({ title: panelReplay.title, deletion: JSON.parse(panelReplay.output).deletion }).toEqual({
      title: "Session retired",
      deletion: body,
    })
  }, 60_000)

  test("reports committed Panel deletion residue as pending runtime cleanup", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Panel residue disposition" })
        const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
        await fs.mkdir(source, { recursive: true })
        await fs.writeFile(path.join(source, "pending.txt"), "pending")
        let failed = false
        using cleanupFailure = SessionDeletionCleanupTestHooks.installBeforeCommittedTargetCleanup(() => {
          if (failed) return
          failed = true
          throw new Error("simulated committed runtime residue")
        })
        const panel = await PanelTool.init({ agentID: "panel_ui" })
        const output = await panel.execute(
          { action: "delete_session", sessionID: session.id },
          createPanelUIRequestToolContext({ surface: "panel", requestID: randomUUID() }),
        )
        expect({ title: output.title, body: JSON.parse(output.output) }).toEqual({
          title: "Session cleanup pending",
          body: {
            kind: "panel_response",
            session_id: session.id,
            deletion: {
              ok: true,
              status: "physically_deleted_with_residue",
              sessionID: session.id,
              sessionHistoryRetained: false,
              authorizationAuditRetained: true,
              cleanupOperationID: expect.any(String),
              residue: [{ path: expect.any(String), message: "simulated committed runtime residue" }],
            },
            message: `Session causal history deleted; authorization audit retained; conversation runtime cleanup remains pending for ${session.id}`,
            local_action: { type: "invalidate_session", sessionID: session.id },
          },
        })
        cleanupFailure[Symbol.dispose]()
        const completedReplay = await panel.execute(
          { action: "delete_session", sessionID: session.id },
          createPanelUIRequestToolContext({ surface: "panel", requestID: randomUUID() }),
        )
        const repeatedReplay = await panel.execute(
          { action: "delete_session", sessionID: session.id },
          createPanelUIRequestToolContext({ surface: "panel", requestID: randomUUID() }),
        )
        expect({
          completed: JSON.parse(completedReplay.output),
          repeated: JSON.parse(repeatedReplay.output),
        }).toMatchObject({
          completed: { deletion: { status: "physically_deleted", residue: [] } },
          repeated: { deletion: { status: "physically_deleted", residue: [] } },
        })
      },
    })
  }, 60_000)

  test("fences Prompt admission until the exact deletion owner rolls back", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Deletion Prompt fence" })
        const plan = await createSessionDeletionCleanupPlan({
          projectID: session.projectID,
          rootSessionID: session.id,
          rootIdentity: { kind: session.kind, conversationExperience: null },
          sessions: [{ id: session.id, directory: session.directory }],
        })
        const claim = claimSessionDeletionCleanup(plan)
        if (!claim.acquired) throw new Error("Expected the deletion cleanup owner")
        try {
          expect(() =>
            SessionPromptOwner.acquire({
              sessionID: session.id,
              projectID: session.projectID,
              directory: session.directory,
            }),
          ).toThrow(SessionDeletionFenceError)
          await expect(
            SessionPrompt.persistNoReplySequence([
              {
                input: {
                  sessionID: session.id,
                  author: "user",
                  agent: "coding",
                  model: { providerID: "test", modelID: "test" },
                  noReply: true,
                  parts: [{ type: "text", text: "This Message must wait for deletion rollback." }],
                },
              },
            ]),
          ).rejects.toBeInstanceOf(SessionDeletionFenceError)
          await rollbackSessionDeletionCleanup(plan, claim.authority)
        } finally {
          closeSessionDeletionAuthority(claim.authority)
        }
        const admitted = SessionPromptOwner.acquire({
          sessionID: session.id,
          projectID: session.projectID,
          directory: session.directory,
        })
        expect(admitted.acquired).toBe(true)
        if (admitted.acquired) expect(SessionPromptOwner.release(admitted.authority)).toBe(true)
        const [persisted] = await SessionPrompt.persistNoReplySequence([
          {
            input: {
              sessionID: session.id,
              author: "user",
              agent: "coding",
              model: { providerID: "test", modelID: "test" },
              noReply: true,
              parts: [{ type: "text", text: "Deletion rolled back; admission is restored." }],
            },
          },
        ])
        expect(persisted?.info.sessionID).toBe(session.id)
      },
    })
  }, 60_000)

  test("releases the physical deletion owner when durable manifest reassertion fails", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Deletion manifest reassert rollback" })
        const runtimeRoot = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
        await fs.mkdir(runtimeRoot, { recursive: true })
        await fs.writeFile(path.join(runtimeRoot, "retained.txt"), "retained")
        let manifestCreates = 0
        await using hook = SessionDeletionCleanupTestHooks.installBeforeManifestCreate(() => {
          manifestCreates += 1
          if (manifestCreates === 2) throw new Error("simulated manifest reassert failure")
        })
        const failure = await EngineService.deleteSession(session.id, { projectID: session.projectID }).catch(
          (error) => error,
        )
        const admitted = SessionPromptOwner.acquire({
          sessionID: session.id,
          projectID: session.projectID,
          directory: session.directory,
        })
        const [message] = await SessionPrompt.persistNoReplySequence([
          {
            input: {
              sessionID: session.id,
              author: "user",
              agent: "coding",
              model: { providerID: "test", modelID: "test" },
              noReply: true,
              parts: [{ type: "text", text: "Manifest rollback restored admission." }],
            },
          },
        ])
        expect({
          failure: failure instanceof Error ? failure.message : "not-an-error",
          manifestCreates,
          runtimeRoot: await pathStatus(runtimeRoot),
          promptAdmission: admitted.acquired,
          messageSessionID: message?.info.sessionID,
        }).toEqual({
          failure: "simulated manifest reassert failure",
          manifestCreates: 2,
          runtimeRoot: "present",
          promptAdmission: true,
          messageSessionID: session.id,
        })
        if (admitted.acquired) expect(SessionPromptOwner.release(admitted.authority)).toBe(true)
      },
    })
  })

  for (const failureMode of ["read", "malformed", "immutable"] as const) {
    test(`releases the physical deletion owner when manifest reassertion is ${failureMode}`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ kind: "root", title: `Deletion manifest ${failureMode} rollback` })
          const runtimeRoot = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
          await fs.mkdir(runtimeRoot, { recursive: true })
          await fs.writeFile(path.join(runtimeRoot, "retained.txt"), "retained")
          let manifestCreates = 0
          await using hook =
            failureMode === "read"
              ? SessionDeletionCleanupTestHooks.installBeforeManifestRead(() => {
                  throw new Error("simulated manifest reassert read failure")
                })
              : SessionDeletionCleanupTestHooks.installBeforeManifestCreate(async () => {
                  manifestCreates += 1
                  if (manifestCreates !== 2) return
                  const [manifestName] = await fs.readdir(SessionDeletionCleanupTestHooks.activeRoot())
                  if (!manifestName) throw new Error("expected an active Session deletion manifest")
                  const manifestPath = path.join(SessionDeletionCleanupTestHooks.activeRoot(), manifestName)
                  if (failureMode === "malformed") {
                    await fs.writeFile(manifestPath, "{")
                    return
                  }
                  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Record<string, unknown>
                  manifest.projectID = "conflicting-project"
                  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
                })
          const failure = await EngineService.deleteSession(session.id, { projectID: session.projectID }).catch(
            (error) => error,
          )
          const admitted = SessionPromptOwner.acquire({
            sessionID: session.id,
            projectID: session.projectID,
            directory: session.directory,
          })
          const [message] = await SessionPrompt.persistNoReplySequence([
            {
              input: {
                sessionID: session.id,
                author: "user",
                agent: "coding",
                model: { providerID: "test", modelID: "test" },
                noReply: true,
                parts: [{ type: "text", text: `Manifest ${failureMode} rollback restored admission.` }],
              },
            },
          ])
          expect({
            failure: failure instanceof Error,
            runtimeRoot: await pathStatus(runtimeRoot),
            promptAdmission: admitted.acquired,
            messageSessionID: message?.info.sessionID,
          }).toEqual({
            failure: true,
            runtimeRoot: "present",
            promptAdmission: true,
            messageSessionID: session.id,
          })
          if (admitted.acquired) expect(SessionPromptOwner.release(admitted.authority)).toBe(true)
        },
      })
    })
  }

  test("physically deletes the exact Session tree and its conversation runtime roots with one durable disposition", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Standalone deletion root" })
        const child = await Session.create({
          kind: "assistant",
          parentID: root.id,
          title: "Standalone deletion child",
        })
        const sessions = [root, child]
        for (const session of sessions) {
          const runtimeRoot = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
          await fs.mkdir(runtimeRoot, { recursive: true })
          await fs.writeFile(path.join(runtimeRoot, "owned.txt"), session.id)
        }

        const result = await EngineService.deleteSession(root.id, { projectID: root.projectID })
        const snapshotAdmission = await Session.importSnapshot({ info: root, messages: [] }).catch((error) => error)
        const facts = Database.use((db) =>
          db
            .select({ sessionID: ProtocolEventTable.aggregate_id })
            .from(ProtocolEventTable)
            .where(
              and(eq(ProtocolEventTable.aggregate_type, "session"), eq(ProtocolEventTable.type, "session.deleted")),
            )
            .all()
            .map((row) => row.sessionID)
            .sort(),
        )
        expect({
          result,
          persistedSessions: Database.use((db) => db.select().from(SessionTable).all()).length,
          facts,
          runtimeRoots: await Promise.all(
            sessions.map((session) =>
              pathStatus(ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)),
            ),
          ),
          activeManifests: await fs.readdir(SessionDeletionCleanupTestHooks.activeRoot()).catch(() => []),
          completedManifests: await fs.readdir(SessionDeletionCleanupTestHooks.completedRoot()),
          snapshotFenced: snapshotAdmission instanceof SessionDeletionFenceError,
        }).toEqual({
          result: {
            ok: true,
            status: "physically_deleted",
            sessionID: root.id,
            sessionHistoryRetained: false,
            authorizationAuditRetained: true,
            cleanupOperationID: expect.any(String),
            residue: [],
          },
          persistedSessions: 0,
          facts: [root.id, child.id].sort(),
          runtimeRoots: ["missing", "missing"],
          activeManifests: [],
          completedManifests: [expect.stringMatching(/^cal_.*\.json$/)],
          snapshotFenced: true,
        })
      },
    })
  }, 60_000)

  test("replays a physical deletion whose Session tree spans fixed recovery query pages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Paged deletion root" })
        const children = []
        for (let index = 0; index < 130; index += 1) {
          children.push(
            await Session.create({
              kind: "assistant",
              parentID: root.id,
              title: `Paged deletion child ${index}`,
            }),
          )
        }
        const result = await EngineService.deleteSession(root.id, { projectID: root.projectID })
        const replay = await EngineService.deleteSession(root.id, { projectID: root.projectID })
        expect({
          result,
          replay,
          deletedFacts: Database.use((db) =>
            db
              .select()
              .from(ProtocolEventTable)
              .where(
                and(eq(ProtocolEventTable.aggregate_type, "session"), eq(ProtocolEventTable.type, "session.deleted")),
              )
              .all(),
          ).length,
        }).toEqual({
          result: expect.objectContaining({ status: "physically_deleted", sessionID: root.id }),
          replay: result,
          deletedFacts: children.length + 1,
        })
      },
    })
  }, 120_000)

  test("restores quarantined runtime data when startup finds the canonical Session tree still committed", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Rollback deletion occurrence" })
        const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
        await fs.mkdir(source, { recursive: true })
        await fs.writeFile(path.join(source, "authority.txt"), "retained")
        const plan = await createSessionDeletionCleanupPlan({
          projectID: session.projectID,
          rootSessionID: session.id,
          rootIdentity: { kind: session.kind, conversationExperience: null },
          sessions: [{ id: session.id, directory: session.directory }],
        })
        const replay = await createSessionDeletionCleanupPlan({
          projectID: session.projectID,
          rootSessionID: session.id,
          rootIdentity: { kind: session.kind, conversationExperience: null },
          sessions: [{ id: session.id, directory: session.directory }],
        })
        expect(replay.manifest.operationID).toBe(plan.manifest.operationID)
        const claim = claimSessionDeletionCleanup(plan)
        if (!claim.acquired) throw new Error("Expected the deletion cleanup owner")
        await Promise.all([stageSessionDeletionCleanup(plan), stageSessionDeletionCleanup(replay)])
        closeSessionDeletionAuthority(claim.authority)
        expect(await pathStatus(plan.manifest.targets[0]!.quarantine)).toBe("present")

        const interruptedOccurrenceID = claim.authority.runtimeOccurrenceID
        const priorOccurrence = replaceRuntimeOccurrenceIDForTest(`session-deletion-recovery-${randomUUID()}`)
        try {
          expect(
            await Promise.all(
              Array.from({ length: 4 }, () =>
                recoverSessionDeletionCleanup((owner) =>
                  owner.occurrenceID === interruptedOccurrenceID
                    ? "dead_or_reused"
                    : observeRuntimeProcessOccurrence(owner),
                ),
              ),
            ),
          ).toEqual(Array.from({ length: 4 }, () => ({ unreconciled: [] })))
        } finally {
          replaceRuntimeOccurrenceIDForTest(priorOccurrence)
        }
        expect({
          content: await fs.readFile(path.join(source, "authority.txt"), "utf8"),
          session: await Session.get(session.id).then((value) => value.id),
          manifest: await pathStatus(plan.manifestPath),
        }).toEqual({ content: "retained", session: session.id, manifest: "missing" })
      },
    })
  }, 60_000)

  test("recovers a rollback manifest left after the permanent Session fences were released", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Rollback manifest after fence release" })
        const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
        await fs.mkdir(source, { recursive: true })
        await fs.writeFile(path.join(source, "authority.txt"), "retained")
        const plan = await createSessionDeletionCleanupPlan({
          projectID: session.projectID,
          rootSessionID: session.id,
          rootIdentity: { kind: session.kind, conversationExperience: null },
          sessions: [{ id: session.id, directory: session.directory }],
        })
        const claim = claimSessionDeletionCleanup(plan)
        if (!claim.acquired) throw new Error("Expected the deletion cleanup owner")
        await stageSessionDeletionCleanup(plan)
        await fs.rename(plan.manifest.targets[0]!.quarantine, source)
        Database.immediateTransaction((db) => releaseSessionDeletionAuthorityInTransaction(db, claim.authority))
        closeSessionDeletionAuthority(claim.authority)

        expect(await pathStatus(plan.manifestPath)).toBe("present")
        expect(await recoverSessionDeletionCleanup()).toEqual({ unreconciled: [] })
        expect({
          content: await fs.readFile(path.join(source, "authority.txt"), "utf8"),
          session: await Session.get(session.id).then((value) => value.id),
          manifest: await pathStatus(plan.manifestPath),
        }).toEqual({ content: "retained", session: session.id, manifest: "missing" })
      },
    })
  }, 60_000)

  test("finishes an exact committed deletion occurrence after the database crash boundary", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Committed deletion recovery" })
        const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
        await fs.mkdir(source, { recursive: true })
        await fs.writeFile(path.join(source, "residue.txt"), "pending")
        const plan = await createSessionDeletionCleanupPlan({
          projectID: session.projectID,
          rootSessionID: session.id,
          rootIdentity: { kind: session.kind, conversationExperience: null },
          sessions: [{ id: session.id, directory: session.directory }],
        })
        const claim = claimSessionDeletionCleanup(plan)
        if (!claim.acquired) throw new Error("Expected the deletion cleanup owner")
        await stageSessionDeletionCleanup(plan)
        Database.immediateTransaction((db) => {
          assertSessionDeletionAuthorityInTransaction(db, claim.authority)
          const boundary = ProtocolStore.authorizePhysicalSessionDeletionInTransaction({
            sessionID: session.id,
            cleanupOperationID: plan.manifest.operationID,
            leaseID: claim.authority.leases[0]!.leaseID,
            ownerOccurrenceID: claim.authority.ownerOccurrenceID,
            now: Date.now(),
          })
          Session.deleteExactTreeInProject(db, {
            sessionID: session.id,
            projectID: session.projectID,
            expectedSessionIDs: [session.id],
          })
          ProtocolStore.appendPhysicalSessionDeletedInTransaction(boundary)
          releaseSessionDeletionAuthorityInTransaction(db, claim.authority)
        })
        closeSessionDeletionAuthority(claim.authority)

        expect(await Promise.all(Array.from({ length: 4 }, () => recoverSessionDeletionCleanup()))).toEqual(
          Array.from({ length: 4 }, () => ({ unreconciled: [] })),
        )
        expect({
          source: await pathStatus(source),
          quarantine: await pathStatus(plan.manifest.targets[0]!.quarantine),
          active: await fs.readdir(SessionDeletionCleanupTestHooks.activeRoot()).catch(() => []),
          completed: await fs.readdir(SessionDeletionCleanupTestHooks.completedRoot()),
        }).toEqual({
          source: "missing",
          quarantine: "missing",
          active: [],
          completed: [path.basename(plan.manifestPath)],
        })
      },
    })
  }, 60_000)

  test("returns one committed disposition to concurrent callers of the same physical deletion occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Concurrent physical deletion" })
        const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
        await fs.mkdir(source, { recursive: true })
        await fs.writeFile(path.join(source, "owned.txt"), "one occurrence")

        const attempts = await Promise.allSettled(
          Array.from({ length: 4 }, () => EngineService.deleteSession(session.id, { projectID: session.projectID })),
        )
        const results = attempts
          .filter(
            (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof EngineService.deleteSession>>> =>
              attempt.status === "fulfilled",
          )
          .map((attempt) => attempt.value)
        expect(results.length).toBeGreaterThanOrEqual(1)
        expect(
          attempts.map((attempt) =>
            attempt.status === "fulfilled"
              ? attempt.value.status
              : attempt.reason instanceof Error
                ? attempt.reason.name
                : String(attempt.reason),
          ),
        ).toEqual(expect.arrayContaining(["physically_deleted"]))
        expect(
          results.map((result) => ({
            status: result.status,
            operationID: result.cleanupOperationID,
            retained: result.sessionHistoryRetained,
            residue: result.residue,
          })),
        ).toEqual(
          Array.from({ length: results.length }, () => ({
            status: "physically_deleted",
            operationID: results[0]!.cleanupOperationID,
            retained: false,
            residue: [],
          })),
        )
        expect(
          await Promise.all(
            Array.from({ length: 4 }, () => EngineService.deleteSession(session.id, { projectID: session.projectID })),
          ),
        ).toEqual(Array.from({ length: 4 }, () => results[0]))
      },
    })
  }, 60_000)
})
