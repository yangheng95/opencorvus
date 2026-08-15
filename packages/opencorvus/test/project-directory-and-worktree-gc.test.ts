import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance, InstanceTestHooks } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Server } from "@/server/server"
import { namedErrorStatus, serverErrorResponse } from "@/server/error-handler"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionPrompt } from "@/session/prompt"
import { isExecutionCancellationError } from "@/session/prompt/cancellation"
import { SessionProcessor } from "@/session/processor"
import { SessionStatus } from "@/session/status"
import { Database, eq } from "@/storage/db"
import { EngineTaskTable, EngineWorkflowNodeOccurrenceTable } from "@/engine/engine.sql"
import { PermissionLedgerTable, PermissionPolicyTable } from "@/permission/permission.sql"
import { DecisionLogTable } from "@/decision-log/schema"
import { EngineService } from "@/task-api"
import { Identifier } from "@/id/id"
import { ProjectTable } from "@/project/project.sql"
import { deleteProject } from "@/project/delete"
import { closeProjectDeletionRegistryAdmission } from "@/project/deletion-registry"
import {
  createProjectDeletionCleanupPlan,
  ProjectDeletionCleanupTestHooks,
  recoverProjectDeletionCleanup,
} from "@/project/deletion-cleanup"
import { ImplicitProject } from "@/project/implicit-project"
import { Worktree } from "@/worktree"
import { WorktreeGC } from "@/worktree/gc"
import { Ownership } from "@/engine/ownership"
import { Filesystem } from "@/util/filesystem"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { insertEngineTask } from "@/engine/task"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { insertTaskProcessBinding, prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { DatabaseAuthorityTable } from "@/storage/database.sql"
import { GlobalBus } from "@/bus/global"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { ProtocolStore } from "@/protocol/store"

let rejectDeletionProbeDisposal = false
let holdDeletionProbeDisposal: Promise<void> | undefined
let releaseDeletionProbeDisposal: (() => void) | undefined
const deletionProbeState = Instance.state(
  () => ({ initialized: true as const }),
  async () => {
    if (holdDeletionProbeDisposal) await holdDeletionProbeDisposal
    if (rejectDeletionProbeDisposal) throw new Error("deterministic Project disposal failure")
  },
  "project-deletion-bounded-disposal-probe",
)

const sessionLoopDeletionModel = {
  providerID: "test",
  modelID: "project-deletion-session-loop",
}

function appendFixtureTaskLifecycle(input: {
  taskID: string
  sessionID: string
  now: number
  terminal: boolean
}) {
  Database.transaction((db) => {
    appendTaskOpenedInTransaction({
      db,
      taskID: input.taskID,
      sessionID: input.sessionID,
      now: input.now,
      source: "test",
    })
    if (!input.terminal) return
    ProtocolStore.appendEventInTransaction({
      kind: "event",
      type: "task.completed",
      aggregate: "task",
      aggregate_id: input.taskID,
      task_id: null,
      session_id: input.sessionID,
      source: "test",
      emitted_at: input.now,
      payload: { execution_epoch: 1 },
    })
  })
}

function sessionLoopDeletionProviderModel(): ProviderType.Model {
  return {
    id: sessionLoopDeletionModel.modelID,
    providerID: sessionLoopDeletionModel.providerID,
    name: "Project deletion SessionLoop",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: {
      id: sessionLoopDeletionModel.modelID,
      url: "https://project-deletion-session-loop.test.invalid",
      npm: "@ai-sdk/anthropic",
    },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-14",
  } as ProviderType.Model
}

afterEach(async () => {
  rejectDeletionProbeDisposal = false
  holdDeletionProbeDisposal = undefined
  releaseDeletionProbeDisposal?.()
  releaseDeletionProbeDisposal = undefined
  await deletionProbeState.resetAll()
  await resetMemoryDatabase()
})

describe("Project directory integrity", () => {
  test("binds an existing directory and returns typed missing and file-path errors through the HTTP boundary", async () => {
    await using project = await memoryProject()
    const bound = await Project.fromDirectory(project.path)
    expect(bound).toMatchObject({
      project: { id: expect.any(String), worktree: project.path },
      sandbox: project.path,
    })

    const missing = path.join(project.path, "missing-project")
    const missingResponse = await Server.App().request("/project/current", {
      headers: { "x-opencorvus-directory": missing },
    })
    expect(missingResponse.status).toBe(400)
    expect(await missingResponse.json()).toEqual({
      name: "ProjectDirectoryIntegrityError",
      data: {
        directory: missing,
        reason: "missing",
        message: `Project directory does not exist: ${missing}`,
      },
    })

    const file = path.join(project.path, "not-a-directory.txt")
    await fs.writeFile(file, "positive typed error fixture")
    const fileResponse = await Server.App().request("/project/current", {
      headers: { "x-opencorvus-directory": file },
    })
    expect(fileResponse.status).toBe(400)
    expect(await fileResponse.json()).toEqual({
      name: "ProjectDirectoryIntegrityError",
      data: {
        directory: file,
        reason: "not-directory",
        message: `Project directory is not a directory: ${file}`,
      },
    })

    await fs.mkdir(missing)
    await Project.initGit(missing)
    const recoveredResponse = await Server.App().request("/project/current", {
      headers: { "x-opencorvus-directory": missing },
    })
    expect(recoveredResponse.status).toBe(200)
    expect(await recoveredResponse.json()).toMatchObject({ worktree: missing })
  }, 90_000)

  test("creates a missing Task project only through the explicit init-git request", async () => {
    await using parent = await memoryProject()
    const directory = path.join(parent.path, "explicit-task-project")
    const createTask = spyOn(EngineService, "createTask").mockResolvedValue("tsk_directory_integrity_positive")
    try {
      const response = await Server.App().request("/task?init-git=true", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-opencorvus-directory": directory,
        },
        body: JSON.stringify({
          productPillar: "work",
          request: "Persist one queued positive directory-integrity contract Task.",
          model: "openai/gpt-5.6-luna",
        }),
      })

      const body = await response.json()
      expect({ status: response.status, body }).toEqual({
        status: 202,
        body: {
          task_id: "tsk_directory_integrity_positive",
          project_id: expect.any(String),
          directory,
        },
      })
      expect(Project.isGitRepo(directory)).toBe(true)
      expect(createTask).toHaveBeenCalledTimes(1)
      await Database.awaitEffectIdle(5_000)
    } finally {
      createTask.mockRestore()
    }
  }, 90_000)

  test("deletes a persisted Project after its registered directory is already absent", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.disposeAll()
    await fs.rm(project.path, { recursive: true, force: true })

    const response = await Server.App().request("/project/current", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-opencorvus-directory": project.path,
      },
      body: JSON.stringify({
        surface: "overlay.work_ledger",
        reason: "Remove persisted missing-directory Project",
      }),
    })

    expect({ status: response.status, body: await response.json(), projects: Project.list() }).toEqual({
      status: 200,
      body: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 0,
        residue: [],
      },
      projects: [],
    })
  }, 90_000)

  test("deletes a terminal Task and its managed root through one Project authority", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const taskID = Identifier.ascending("task")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Project-owned terminal Task" })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: registered.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "work",
              title: "Project-owned terminal Task",
              request: "Delete through the Project authority without recreating managed state.",
              time_created: now,
            })
            .run(),
        )
        appendFixtureTaskLifecycle({ taskID, sessionID: session.id, now, terminal: true })
      },
    })
    const result = await deleteProject(registered.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_delete_project_terminal_task",
      reason: "Delete Project with terminal Task",
    })
    const managedState = await fs.stat(ProjectRuntimePaths.projectConfigRoot(project.path)).then(
      () => "present" as const,
      (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
    )

    expect({
      result,
      managedState,
      projects: Project.list().length,
      tasks: Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).all().length),
    }).toEqual({
      result: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 1,
        residue: [],
      },
      managedState: "missing",
      projects: 0,
      tasks: 0,
    })
  }, 90_000)

  test("commits Project deletion through immutable permission evidence and an admitted workflow node", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const projectID = registered.project.id
    const taskID = Identifier.ascending("task")
    let policySessionID!: string
    let childSessionID!: string
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Permission evidence host" })
        const child = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "Workflow node child Session",
        })
        policySessionID = root.id
        childSessionID = child.id
        const now = Date.now()
        Database.transaction((db) => {
          insertEngineTask(db, {
            taskID,
            projectID,
            sessionID: root.id,
            source: "test",
            productPillar: "work",
            title: "Workflow node owner",
            request: "Retire immutable permission evidence together with its Project.",
            priority: 0,
            metadata: {},
            timeCreated: now,
          })
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test" })
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: null,
            session_id: root.id,
            source: "test",
            emitted_at: now,
            payload: { execution_epoch: 1 },
          })
          db.insert(PermissionPolicyTable)
            .values({
              session_id: root.id,
              project_id: projectID,
              mode: "ask",
              revision: "revision-1",
              time_created: now,
            })
            .run()
          const permissionRequestID = Identifier.ascending("permission")
          db.insert(PermissionLedgerTable)
            .values({
              id: Identifier.ascending("permission"),
              request_id: permissionRequestID,
              project_id: projectID,
              session_id: root.id,
              message_id: Identifier.ascending("message"),
              tool_call_id: "tool-call-1",
              event_type: "requested",
              mode: "ask",
              policy_revision: "revision-1",
              provider_kind: "builtin",
              provider_id: "test",
              provider_digest: "digest",
              tool_name: "bash",
              effect_class: "write",
              scope_version: "1",
              scope: {},
              fingerprint: "fingerprint-1",
              summary: "Permission evidence that outlives its Session",
              time_created: now,
            })
            .run()
          // Settled evidence: an undecided request would leave the Project with
          // a live permission waiter, which is a different deletion path.
          db.insert(PermissionLedgerTable)
            .values({
              id: Identifier.ascending("permission"),
              request_id: permissionRequestID,
              decision_slot: permissionRequestID,
              event_type: "denied",
              decision_scope: "invocation",
              actor_id: "system",
              reason: "Settled before Project deletion",
              time_created: now,
            })
            .run()
          db.insert(EngineWorkflowNodeOccurrenceTable)
            .values({
              task_id: taskID,
              workflow_id: "workflow-1",
              workflow_node_id: "node-1",
              initial_dispatch_id: Identifier.ascending("call"),
              child_session_id: child.id,
              time_created: now,
            })
            .run()
        })
      },
    })

    const evidenceHeldWhileProjectLives = (() => {
      try {
        Database.transaction((db) =>
          db.delete(PermissionPolicyTable).where(eq(PermissionPolicyTable.session_id, policySessionID)).run(),
        )
        return "deleted" as const
      } catch (error) {
        return error instanceof Error && error.message.includes("immutable policy fact")
          ? ("rejected" as const)
          : Promise.reject(error)
      }
    })()

    const result = await deleteProject(registered.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_delete_project_permission_evidence",
      reason: "Delete Project carrying immutable permission evidence",
    })

    expect({
      evidenceHeldWhileProjectLives,
      result,
      projects: Project.list().length,
      remaining: Database.use((db) => ({
        tasks: db.select().from(EngineTaskTable).where(eq(EngineTaskTable.project_id, projectID)).all().length,
        sessions: db.select().from(SessionTable).where(eq(SessionTable.project_id, projectID)).all().length,
        policies: db
          .select()
          .from(PermissionPolicyTable)
          .where(eq(PermissionPolicyTable.project_id, projectID))
          .all().length,
        ledger: db
          .select()
          .from(PermissionLedgerTable)
          .where(eq(PermissionLedgerTable.project_id, projectID))
          .all().length,
        occurrences: db
          .select()
          .from(EngineWorkflowNodeOccurrenceTable)
          .where(eq(EngineWorkflowNodeOccurrenceTable.child_session_id, childSessionID))
          .all().length,
      })),
    }).toEqual({
      evidenceHeldWhileProjectLives: "rejected",
      result: {
        ok: true,
        status: "committed",
        projectID,
        directory: project.path,
        deletedTaskCount: 1,
        residue: [],
      },
      projects: 0,
      remaining: { tasks: 0, sessions: 0, policies: 0, ledger: 0, occurrences: 0 },
    })
  }, 90_000)

  test("commits Project deletion after its real SessionLoop and attached prompt settle", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const taskID = Identifier.ascending("task")
    let processorStarted!: () => void
    const processorRunning = new Promise<void>((resolve) => (processorStarted = resolve))
    let processorCancelled!: (reason: unknown) => void
    const processorCancellation = new Promise<unknown>((resolve) => (processorCancelled = resolve))
    const provider = spyOn(Provider, "getModel").mockResolvedValue(sessionLoopDeletionProviderModel())
    const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
      const assistant = input.assistantMessage
      return {
        message: assistant,
        partFromToolCall() {
          return undefined
        },
        async process() {
          processorStarted()
          await new Promise<never>((_resolve, reject) => {
            const cancel = () => {
              processorCancelled(input.abort.reason)
              reject(input.abort.reason)
            }
            if (input.abort.aborted) cancel()
            else input.abort.addEventListener("abort", cancel, { once: true })
          })
        },
      } as any
    })
    holdDeletionProbeDisposal = new Promise<void>((resolve) => (releaseDeletionProbeDisposal = resolve))
    let deletion: Promise<Awaited<ReturnType<typeof deleteProject>>> | undefined
    let setup: Promise<void> | undefined
    try {
      let publishSession!: (value: {
        created: Session.Info
        firstInputMessageID: string
        firstPrompt: ReturnType<typeof SessionPrompt.prompt>
      }) => void
      let rejectSession!: (error: unknown) => void
      const sessionReady = new Promise<{
        created: Session.Info
        firstInputMessageID: string
        firstPrompt: ReturnType<typeof SessionPrompt.prompt>
      }>((resolve, reject) => {
        publishSession = resolve
        rejectSession = reject
      })
      setup = Instance.provide({
        directory: project.path,
        init: InstanceBootstrap,
        fn: async () => {
          deletionProbeState()
          const created = await Session.create({ kind: "root", title: "Project deletion cancellation" })
          const firstPrompt = SessionPrompt.prompt({
            sessionID: created.id,
            author: "user",
            agent: "chat",
            model: sessionLoopDeletionModel,
            parts: [{ type: "text", text: "Run until Project deletion cancels this physical loop." }],
          })
          await Promise.race([
            processorRunning,
            Bun.sleep(5_000).then(() => {
              throw new Error("Project deletion SessionLoop processor did not start")
            }),
          ])
          const firstInputMessageID = SessionStatus.executionOccurrence(created.id)?.inputMessageID
          if (!firstInputMessageID) throw new Error("Project deletion SessionLoop has no durable input occurrence")
          const now = Date.now()
          Database.use((db) =>
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: registered.project.id,
                session_id: created.id,
                source: "test",
                product_pillar: "work",
                title: "Project deletion cancellation",
                request: "Cancel the active SessionLoop through Project deletion authority.",
                metadata: { actor: "user" },
                time_created: now,
              })
              .run(),
          )
          appendFixtureTaskLifecycle({ taskID, sessionID: created.id, now, terminal: false })
          publishSession({ created, firstInputMessageID, firstPrompt })
        },
      }).catch((error) => {
        rejectSession(error)
        throw error
      })
      const session = await sessionReady

      deletion = deleteProject(registered.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_delete_project_active_session_loop",
        reason: "Delete Project after its active physical SessionLoop settles",
      })
      const cancellationReason = await Promise.race([
        processorCancellation,
        Bun.sleep(10_000).then(() => {
          throw new Error("Project deletion did not cancel the physical SessionLoop processor")
        }),
      ])
      const promptFailure = await Promise.race([
        session.firstPrompt.then(
          () => undefined,
          (cause) => cause,
        ),
        Bun.sleep(10_000).then(() => {
          throw new Error("Project deletion SessionLoop prompt did not expose its cancellation settlement")
        }),
      ])
      const lifecycleDeadline = Date.now() + 5_000
      let terminalLifecycle = ProtocolStore.listTaskEvents(taskID).find(
        (event) => event.type === "agent.execution.lifecycle" && event.payload.status?.type === "terminal",
      )
      while (!terminalLifecycle && Date.now() < lifecycleDeadline) {
        await Bun.sleep(10)
        terminalLifecycle = ProtocolStore.listTaskEvents(taskID).find(
          (event) => event.type === "agent.execution.lifecycle" && event.payload.status?.type === "terminal",
        )
      }
      expect({
        cancellation: isExecutionCancellationError(cancellationReason)
          ? {
              name: cancellationReason.name,
              source: cancellationReason.source,
              origin: cancellationReason.origin.source,
              sessionID: cancellationReason.sessionID,
            }
          : cancellationReason,
        promptCancellation: isExecutionCancellationError(promptFailure)
          ? { name: promptFailure.name, origin: promptFailure.origin.source, sessionID: promptFailure.sessionID }
          : promptFailure,
        lifecycle: terminalLifecycle,
      }).toMatchObject({
        cancellation: {
          name: "ExecutionCancellationError",
          source: "session_prompt",
          origin: "project.delete",
          sessionID: session.created.id,
        },
        promptCancellation: {
          name: "ExecutionCancellationError",
          origin: "project.delete",
          sessionID: session.created.id,
        },
        lifecycle: {
          type: "agent.execution.lifecycle",
          taskID,
          sessionID: session.created.id,
          payload: {
            inputMessageID: session.firstInputMessageID,
            status: { type: "terminal", reason: "aborted" },
          },
        },
      })
      releaseDeletionProbeDisposal?.()
      const result = await Promise.race([
        deletion,
        Bun.sleep(10_000).then(() => {
          throw new Error("Project deletion did not settle after its held State disposer was released")
        }),
      ])
      await setup

      expect({
        result,
        projects: Project.list().length,
        sessions: Database.use(
          (db) => db.select().from(SessionTable).where(eq(SessionTable.project_id, registered.project.id)).all().length,
        ),
        promptResources: SessionPromptState.TestHooks.promptResourceSnapshot(session.created.id),
      }).toEqual({
        result: {
          ok: true,
          status: "committed",
          projectID: registered.project.id,
          directory: project.path,
          deletedTaskCount: 1,
          residue: [],
        },
        projects: 0,
        sessions: 0,
        promptResources: {
          promptOwners: 0,
          messageOwnerRegistries: 0,
          startReservations: 0,
          cancellationReceipts: 0,
        },
      })
    } finally {
      releaseDeletionProbeDisposal?.()
      if (deletion) {
        await Promise.race([deletion.catch(() => undefined), Bun.sleep(2_000)])
      }
      if (setup) await Promise.race([setup.catch(() => undefined), Bun.sleep(2_000)])
      processor.mockRestore()
      provider.mockRestore()
    }
  }, 90_000)

  test("commits Project deletion for a persisted nonterminal Task after its Instance cache entry converges", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const taskID = Identifier.ascending("task")
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Restarted Project deletion cancellation" })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: registered.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "work",
              title: "Restarted Project deletion cancellation",
              request: "Cancel the persisted nonterminal Task without a retained Instance cache entry.",
              metadata: { actor: "user" },
              time_created: now,
            })
            .run(),
        )
        appendFixtureTaskLifecycle({ taskID, sessionID: session.id, now, terminal: false })
      },
    })
    const cacheSandbox = path.join(project.path, "deletion-cache-sandbox")
    await fs.mkdir(cacheSandbox)
    await Project.addSandbox(registered.project.id, cacheSandbox)
    await Instance.provide({ directory: cacheSandbox, init: InstanceBootstrap, fn: () => undefined })
    const convergence = await Instance.converge({ maximumRetained: 1 })
    expect(convergence.disposed).toContain(project.path)

    const result = await deleteProject(registered.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_delete_project_restarted_nonterminal_task",
      reason: "Delete Project after its Task Instance cache entry converged",
    })

    expect({ result, projects: Project.list().length }).toEqual({
      result: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 1,
        residue: [],
      },
      projects: 0,
    })
  }, 90_000)

  test("commits Project deletion for a converged Task Session in an exact repository subdirectory", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const sessionDirectory = path.join(project.path, "nested-task-directory")
    await fs.mkdir(sessionDirectory)
    const taskID = Identifier.ascending("task")
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Nested restarted Project deletion" })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: registered.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "work",
              title: "Nested restarted Project deletion",
              request: "Cancel a persisted Task whose exact Session directory cache entry has converged.",
              metadata: { actor: "user" },
              time_created: now,
            })
            .run(),
        )
        appendFixtureTaskLifecycle({ taskID, sessionID: session.id, now, terminal: false })
        Database.use((db) =>
          db.update(SessionTable).set({ directory: sessionDirectory }).where(eq(SessionTable.id, session.id)).run(),
        )
      },
    })
    const cacheSandbox = path.join(project.path, "nested-session-cache-sandbox")
    await fs.mkdir(cacheSandbox)
    await Project.addSandbox(registered.project.id, cacheSandbox)
    await Instance.provide({ directory: cacheSandbox, init: InstanceBootstrap, fn: () => undefined })
    const convergence = await Instance.converge({ maximumRetained: 1 })
    expect(convergence.disposed).toContain(project.path)

    const result = await deleteProject(registered.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_delete_project_nested_restarted_task",
      reason: "Delete Project after its nested Task Session Instance converged",
    })

    expect(result).toEqual({
      ok: true,
      status: "committed",
      projectID: registered.project.id,
      directory: project.path,
      deletedTaskCount: 1,
      residue: [],
    })
  }, 90_000)

  test("commits Project deletion when cache convergence selected its identity before admission closed", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provide({ directory: project.path, init: InstanceBootstrap, fn: () => undefined })
    const cacheSandbox = path.join(project.path, "concurrent-convergence-sandbox")
    await fs.mkdir(cacheSandbox)
    await Project.addSandbox(registered.project.id, cacheSandbox)
    await Instance.provide({ directory: cacheSandbox, init: InstanceBootstrap, fn: () => undefined })

    let selected!: () => void
    const selectedPromise = new Promise<void>((resolve) => (selected = resolve))
    let release!: () => void
    const releasePromise = new Promise<void>((resolve) => (release = resolve))
    await using _hook = InstanceTestHooks.installBeforeConvergenceDisposal(async (input) => {
      if (!Project.samePath(input.directory, project.path)) return
      selected()
      await releasePromise
    })
    const convergence = Instance.converge({ maximumRetained: 1 })
    await selectedPromise
    const deletion = deleteProject(registered.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_delete_project_during_convergence",
      reason: "Delete Project while its cache identity is selected for convergence",
    })
    const admissionDeadline = Date.now() + 5_000
    while (!InstanceTestHooks.isProjectAdmissionClosed(registered.project.id)) {
      if (Date.now() >= admissionDeadline) throw new Error("Project deletion admission did not close")
      await Bun.sleep(5)
    }
    release()
    await convergence
    const result = await deletion

    expect(result).toEqual({
      ok: true,
      status: "committed",
      projectID: registered.project.id,
      directory: project.path,
      deletedTaskCount: 0,
      residue: [],
    })
  }, 90_000)

  test("reopens Project admission after an in-flight convergence settlement times out", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provide({ directory: project.path, init: InstanceBootstrap, fn: () => undefined })
    const cacheSandbox = path.join(project.path, "convergence-timeout-sandbox")
    await fs.mkdir(cacheSandbox)
    await Project.addSandbox(registered.project.id, cacheSandbox)
    await Instance.provide({ directory: cacheSandbox, init: InstanceBootstrap, fn: () => undefined })

    let selected!: () => void
    const selectedPromise = new Promise<void>((resolve) => (selected = resolve))
    let release!: () => void
    const releasePromise = new Promise<void>((resolve) => (release = resolve))
    const timeoutName = "OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS"
    const originalTimeout = process.env[timeoutName]
    process.env[timeoutName] = "25"
    try {
      await using _hook = InstanceTestHooks.installBeforeConvergenceDisposal(async (input) => {
        if (!Project.samePath(input.directory, project.path)) return
        selected()
        await releasePromise
      })
      const convergence = Instance.converge({ maximumRetained: 1 })
      await selectedPromise
      const error = await Instance.closeProjectAdmission({
        projectID: registered.project.id,
        directories: [project.path, cacheSandbox],
      }).catch((cause) => cause)

      expect({
        name: error.name,
        labels: error.labels,
        admissionClosed: InstanceTestHooks.isProjectAdmissionClosed(registered.project.id),
      }).toEqual({
        name: "InstanceSettlementInactivityError",
        labels: [`project-convergence:${registered.project.id}`],
        admissionClosed: false,
      })

      release()
      await convergence
      const entered = await Instance.provideProjectIdentity({
        directory: project.path,
        fn: () => Instance.project.id,
      })
      expect(entered).toBe(registered.project.id)
    } finally {
      release()
      if (originalTimeout === undefined) delete process.env[timeoutName]
      else process.env[timeoutName] = originalTimeout
    }
  }, 90_000)

  test("commits Project deletion after a sandbox Session relays its terminal lifecycle", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const taskID = Identifier.ascending("task")
    const root = await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const created = await Session.create({ kind: "root", title: "Sandbox deletion lifecycle host" })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: registered.project.id,
              session_id: created.id,
              source: "test",
              product_pillar: "work",
              title: "Sandbox deletion lifecycle host",
              request: "Relay the sandbox terminal lifecycle through Project deletion authority.",
              time_created: now,
            })
            .run(),
        )
        appendFixtureTaskLifecycle({ taskID, sessionID: created.id, now, terminal: true })
        return created
      },
    })
    const sandbox = path.join(project.path, "deletion-lifecycle-sandbox")
    await fs.mkdir(sandbox)
    await Project.addSandbox(registered.project.id, sandbox)
    const child = await Instance.provide({
      directory: sandbox,
      init: InstanceBootstrap,
      fn: async () => {
        const created = await Session.create({
          kind: "assistant",
          parentID: root.id,
          title: "Sandbox deletion lifecycle",
        })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: created.id,
          author: "user",
          time: { created: Date.now() },
          agent: "assistant",
          model: { providerID: "test", modelID: "test" },
        })
        const owner = SessionPromptState.start(created.id, created.directory)
        if (!owner) throw new Error("Expected a fresh sandbox prompt owner")
        SessionStatus.beginExecutionOccurrence(created.id, input.id, owner)
        await SessionStatus.set(
          created.id,
          { type: "streaming" },
          { publish: false, inputMessageID: input.id, promptGenerationOwner: owner },
        )
        return { created, owner }
      },
    })
    await Instance.provideProjectIdentity({ directory: sandbox, fn: () => undefined })
    const convergence = await Instance.converge({ maximumRetained: 1 })
    expect(convergence.disposed).toContain(project.path)
    const promptSettled = new Promise<void>((resolve, reject) => {
      child.owner.addEventListener(
        "abort",
        () => {
          void SessionPromptState.release(child.created.id).then(resolve, reject)
        },
        { once: true },
      )
    })
    const disposedDirectories: string[] = []
    const observeDisposal = (event: { directory?: string; payload: { type?: string } }) => {
      if (event.payload.type === "server.instance.disposed" && event.directory) {
        disposedDirectories.push(event.directory)
      }
    }
    GlobalBus.on("event", observeDisposal)

    let result: Awaited<ReturnType<typeof deleteProject>>
    try {
      result = await deleteProject(registered.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_delete_project_sandbox_session",
        reason: "Delete Project after sandbox Session lifecycle settlement",
      })
      await promptSettled
    } finally {
      GlobalBus.off("event", observeDisposal)
    }

    expect({
      result,
      disposedDirectories: disposedDirectories.sort(),
      projects: Project.list().length,
      promptResources: SessionPromptState.TestHooks.promptResourceSnapshot(child.created.id),
    }).toEqual({
      result: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 1,
        residue: [],
      },
      disposedDirectories: [project.path, sandbox].sort(),
      projects: 0,
      promptResources: {
        promptOwners: 0,
        messageOwnerRegistries: 0,
        startReservations: 0,
        cancellationReceipts: 0,
      },
    })
  }, 90_000)

  test("deletes a persisted Session after its registered Project directory is already absent", async () => {
    await using project = await memoryProject()
    const session = await Instance.provide({
      directory: project.path,
      fn: () => Session.create({ kind: "assistant", title: "Persisted missing-directory deletion contract" }),
    })
    await Instance.disposeAll()
    await fs.rm(project.path, { recursive: true, force: true })

    const response = await Server.App().request(`/session/${session.id}?deleteTasks=false`, {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })

    expect({ status: response.status, body: await response.json() }).toEqual({ status: 200, body: true })
  }, 90_000)

  test("deletes a persisted Task after its registered Project repository is already absent", async () => {
    await using project = await memoryProject()
    const taskID = Identifier.ascending("task")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Persisted missing-repository Task deletion" })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "work",
              title: "Persisted missing-repository Task deletion",
              request: "Delete the terminal Task from persisted database authority.",
              time_created: now,
            })
            .run(),
        )
        appendFixtureTaskLifecycle({ taskID, sessionID: session.id, now, terminal: true })
      },
    })
    await Instance.disposeAll()
    await fs.rm(project.path, { recursive: true, force: true })

    const response = await Server.App().request(`/task/${taskID}`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-opencorvus-directory": project.path,
      },
      body: JSON.stringify({ surface: "api", reason: "Delete persisted Task after repository removal" }),
    })

    const directoryState = await fs.stat(project.path).then(
      () => "present" as const,
      (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
    )
    expect({ status: response.status, body: await response.json(), directoryState }).toEqual({
      status: 200,
      body: true,
      directoryState: "missing",
    })
  }, 90_000)

  test("deletes a persisted Session and its terminal Task without recreating an absent repository", async () => {
    await using project = await memoryProject()
    const taskID = Identifier.ascending("task")
    const session = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Persisted Session Task cascade" })
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "work",
              title: "Persisted Session Task cascade",
              request: "Delete the terminal Task through Session deletion.",
              time_created: now,
            })
            .run(),
        )
        appendFixtureTaskLifecycle({ taskID, sessionID: root.id, now, terminal: true })
        return root
      },
    })
    await Instance.disposeAll()
    await fs.rm(project.path, { recursive: true, force: true })

    const response = await Server.App().request(`/session/${session.id}?deleteTasks=true`, {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })
    const directoryState = await fs.stat(project.path).then(
      () => "present" as const,
      (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
    )

    expect({ status: response.status, body: await response.json(), directoryState }).toEqual({
      status: 200,
      body: true,
      directoryState: "missing",
    })
  }, 90_000)

  test("rejects an ambiguous worktree-to-sandbox registration before destructive routing", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const conflictingProjectID = "project_conflicting_registered_sandbox"
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(ProjectTable)
        .values({
          id: conflictingProjectID,
          generation: crypto.randomUUID(),
          worktree: path.join(project.path, "other-primary"),
          sandboxes: [],
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    const registrationError = await Project.addSandbox(conflictingProjectID, project.path).catch((cause) => cause)
    expect(registrationError).toBeInstanceOf(Project.RegisteredDirectoryConflictError)
    expect(Project.get(conflictingProjectID)?.sandboxes).toEqual([])
    Database.use((db) =>
      db
        .update(ProjectTable)
        .set({ sandboxes: [project.path], time_updated: Date.now() })
        .where(eq(ProjectTable.id, conflictingProjectID))
        .run(),
    )

    const response = await Server.App().request("/project/current", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-opencorvus-directory": project.path,
      },
      body: JSON.stringify({ surface: "api", reason: "Ambiguous directory must fail closed" }),
    })

    expect({
      status: response.status,
      body: await response.json(),
      projectIDs: Project.list().map((item) => item.id),
    }).toEqual({
      status: 409,
      body: {
        name: "ProjectRegisteredDirectoryConflictError",
        data: {
          directory: project.path,
          projectIDs: [registered.project.id, conflictingProjectID].sort(),
          message: `Registered directory ${project.path} belongs to multiple Projects: ${[registered.project.id, conflictingProjectID].sort().join(", ")}`,
        },
      },
      projectIDs: expect.arrayContaining([registered.project.id, conflictingProjectID]),
    })
  }, 90_000)

  test("closes Project admission and evicts initialized and identity-only Instance entries", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const sandbox = path.join(project.path, "registered-sandbox")
    await fs.mkdir(sandbox)
    await Project.addSandbox(registered.project.id, sandbox)
    await Instance.provide({ directory: project.path, fn: () => Instance.project.id })
    await Instance.provideProjectIdentity({ directory: sandbox, fn: () => Instance.project.id })
    await fs.rm(project.path, { recursive: true, force: true })

    const response = await Server.App().request("/project/current", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-opencorvus-directory": sandbox,
      },
      body: JSON.stringify({ surface: "api", reason: "Converge every active Project Instance" }),
    })
    const reentry = await Promise.all(
      [project.path, sandbox].map(async (directory) =>
        Instance.provideProjectIdentity({ directory, fn: () => "stale" as const }).then(
          () => ({ directory, state: "stale" as const }),
          (error) => ({ directory, state: "database-miss" as const, name: error.name }),
        ),
      ),
    )

    expect({ status: response.status, body: await response.json(), reentry }).toEqual({
      status: 200,
      body: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 0,
        residue: [],
      },
      reentry: [
        { directory: project.path, state: "database-miss", name: "ProjectDirectoryIntegrityError" },
        { directory: sandbox, state: "database-miss", name: "ProjectDirectoryIntegrityError" },
      ],
    })
  }, 90_000)

  test("keeps the Project row when its state directory cannot be inspected", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const nestedSessionDirectory = path.join(project.path, "delete-retry-session")
    await fs.mkdir(nestedSessionDirectory)
    const taskID = Identifier.ascending("task")
    const session = await Instance.provide({
      directory: project.path,
      fn: () => Session.create({ kind: "root", title: "Project delete atomicity" }),
    })
    const now = Date.now()
    Database.use((db) => {
      db.update(SessionTable).set({ directory: nestedSessionDirectory }).where(eq(SessionTable.id, session.id)).run()
      db.insert(EngineTaskTable)
        .values({
          id: taskID,
          project_id: registered.project.id,
          session_id: session.id,
          source: "test",
          product_pillar: "work",
          title: "Project delete atomicity",
          request: "Retain all database authority when filesystem staging fails.",
          time_created: now,
        })
        .run()
      db.insert(DecisionLogTable)
        .values({
          id: Identifier.ascending("decision_log"),
          task_id: taskID,
          phase: "delete",
          key: "preexisting_authority",
          value: "retained",
          reason: "Prove Project deletion has not partially committed.",
          time_created: now,
        })
        .run()
    })
    appendFixtureTaskLifecycle({ taskID, sessionID: session.id, now, terminal: true })
    await Instance.disposeAll()
    const stateRoot = ProjectRuntimePaths.projectConfigRoot(project.path)
    const actualLstat = fs.lstat.bind(fs)
    const lstat = spyOn(fs, "lstat").mockImplementation(async (target, options) => {
      if (String(target) === stateRoot) {
        throw Object.assign(new Error(`access denied: ${stateRoot}`), { code: "EACCES" })
      }
      return actualLstat(target, options as never)
    })
    try {
      const error = await deleteProject(registered.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_project_delete_eacces",
        reason: "Verify inaccessible state fails closed",
      }).then(
        () => undefined,
        (cause) => cause as NodeJS.ErrnoException,
      )
      const rows = Database.use((db) => ({
        tasks: db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).all().length,
        sessions: db.select().from(SessionTable).where(eq(SessionTable.id, session.id)).all().length,
        decisions: db.select().from(DecisionLogTable).where(eq(DecisionLogTable.task_id, taskID)).all().length,
      }))
      expect({
        name: error?.name,
        stage: error?.data?.stage,
        cause: error?.cause?.message,
        projectIDs: Project.list().map((item) => item.id),
        rows,
      }).toEqual({
        name: "ProjectDeletePendingError",
        stage: "filesystem-preflight",
        cause: `access denied: ${stateRoot}`,
        projectIDs: [registered.project.id],
        rows: { tasks: 1, sessions: 1, decisions: 1 },
      })
    } finally {
      lstat.mockRestore()
    }
    const ordinaryEntry = await Instance.provide({
      directory: nestedSessionDirectory,
      init: InstanceBootstrap,
      fn: () => ({
        projectID: Instance.project.id,
        directory: Instance.directory,
        worktree: Instance.worktree,
        registeredSandboxes: Project.get(registered.project.id)?.sandboxes,
      }),
    })
    await Instance.disposeAll()
    const retry = await deleteProject(registered.project, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_project_delete_eacces_retry",
      reason: "Retry the same Project deletion after restoring filesystem inspection",
    })
    expect({ ordinaryEntry, retry }).toEqual({
      ordinaryEntry: {
        projectID: registered.project.id,
        directory: nestedSessionDirectory,
        worktree: nestedSessionDirectory,
        registeredSandboxes: [],
      },
      retry: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 1,
        residue: [],
      },
    })
  }, 90_000)

  test("deletes the current registered Project root when the caller supplies a stale Project snapshot", async () => {
    await using original = await memoryProject()
    await using relocated = await memoryProject()
    const registered = await Project.fromDirectory(original.path)
    const stale = registered.project
    await fs.mkdir(ProjectRuntimePaths.projectConfigRoot(original.path), { recursive: true })
    await fs.mkdir(ProjectRuntimePaths.projectConfigRoot(relocated.path), { recursive: true })
    Database.use((db) =>
      db
        .update(ProjectTable)
        .set({ worktree: relocated.path, time_updated: Date.now() })
        .where(eq(ProjectTable.id, registered.project.id))
        .run(),
    )
    const result = await deleteProject(stale, {
      actor: "user",
      source: "project.delete",
      surface: "api",
      requestID: "request_stale_project_snapshot",
      reason: "Deletion must freeze current registry authority",
    })

    expect({
      result,
      oldRoot: await fs.stat(ProjectRuntimePaths.projectConfigRoot(original.path)).then(() => "present"),
      currentRoot: await fs.stat(ProjectRuntimePaths.projectConfigRoot(relocated.path)).then(
        () => "present" as const,
        (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
      ),
    }).toEqual({
      result: {
        ok: true,
        status: "committed",
        projectID: registered.project.id,
        directory: relocated.path,
        deletedTaskCount: 0,
        residue: [],
      },
      oldRoot: "present",
      currentRoot: "missing",
    })
  }, 90_000)

  test("keeps an anonymous Project row when its managed root cannot be inspected", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.disposeAll()
    const anonymous = spyOn(ImplicitProject, "isAnonymousDirectory").mockReturnValue(true)
    const actualLstat = fs.lstat.bind(fs)
    const lstat = spyOn(fs, "lstat").mockImplementation(async (target, options) => {
      if (String(target) === project.path) {
        throw Object.assign(new Error(`access denied: ${project.path}`), { code: "EACCES" })
      }
      return actualLstat(target, options as never)
    })
    try {
      const error = await deleteProject(registered.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_anonymous_delete_eacces",
        reason: "Verify inaccessible anonymous root fails before database deletion",
      }).catch((cause) => cause as NodeJS.ErrnoException)
      expect({ name: error.name, stage: error.data?.stage, projectIDs: Project.list().map((item) => item.id) }).toEqual(
        {
          name: "ProjectDeletePendingError",
          stage: "filesystem-preflight",
          projectIDs: [registered.project.id],
        },
      )
    } finally {
      lstat.mockRestore()
      anonymous.mockRestore()
    }
  }, 90_000)

  test("blocks concurrent Project entry while deletion admission is closed", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provideProjectIdentity({ directory: project.path, fn: () => Instance.project.id })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [project.path],
    })
    const error = await Instance.provideProjectIdentity({ directory: project.path, fn: () => "entered" }).catch(
      (cause) => cause as Error,
    )
    await Instance.disposeProjectEntries(registered.project.id)
    expect({ name: error.name, message: error.message }).toEqual({
      name: "Error",
      message: `Project ${registered.project.id} instance admission is closed during deletion`,
    })
  }, 90_000)

  test("does not wait on an unrelated active Project while evicting target entries", async () => {
    await using target = await memoryProject()
    await using unrelated = await memoryProject()
    const registered = await Project.fromDirectory(target.path)
    await Instance.provideProjectIdentity({ directory: target.path, fn: () => Instance.project.id })
    let release!: () => void
    let entered!: () => void
    const enteredSignal = new Promise<void>((resolve) => (entered = resolve))
    const held = new Promise<void>((resolve) => (release = resolve))
    const unrelatedLease = Instance.provide({
      directory: unrelated.path,
      fn: async () => {
        entered()
        await held
      },
    })
    await enteredSignal
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [target.path],
    })
    const disposed = await Promise.race([
      Instance.disposeProjectEntries(registered.project.id).then(() => "disposed" as const),
      Bun.sleep(2_000).then(() => "blocked" as const),
    ])
    release()
    await unrelatedLease

    expect(disposed).toBe("disposed")
  }, 90_000)

  test("returns a typed inactivity error while a target Project lease remains active", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    let release!: () => void
    let entered!: () => void
    const enteredSignal = new Promise<void>((resolve) => (entered = resolve))
    const held = new Promise<void>((resolve) => (release = resolve))
    const active = Instance.provide({
      directory: project.path,
      fn: async () => {
        entered()
        await held
      },
    })
    await enteredSignal
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [project.path],
    })
    const error = await Instance.disposeProjectEntries(registered.project.id, 25).catch((cause) => cause)
    release()
    await active

    expect({ name: error.name, timeout: error.inactivityTimeoutMilliseconds, projects: Project.list().length }).toEqual(
      {
        name: "InstanceSettlementInactivityError",
        timeout: 25,
        projects: 1,
      },
    )
  }, 90_000)

  test("bounds Project disposal while another lifecycle owns its cache write lock", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provideProjectIdentity({ directory: project.path, fn: () => Instance.project.id })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [project.path],
    })
    await using _lock = await InstanceTestHooks.acquireCacheWriteLock(project.path)
    const error = await Instance.disposeProjectEntries(registered.project.id, 25).catch((cause) => cause)

    expect({ name: error.name, labels: error.labels, project: Project.get(registered.project.id)?.id }).toEqual({
      name: "InstanceSettlementInactivityError",
      labels: [expect.stringContaining("project-instance-lock:")],
      project: registered.project.id,
    })
  }, 90_000)

  test("keeps process settlement authoritative over Project deletion admission", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provide({ directory: project.path, fn: () => Instance.project.id })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using deletionAdmission = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [project.path],
    })
    using _processSettlement = Instance.acquireProcessSettlementGate()
    const error = await Instance.tryProvideActive({
      directory: project.path,
      projectDeletionAdmission: deletionAdmission,
      fn: () => "entered" as const,
    }).catch((cause) => cause)

    expect({ name: error.name, message: error.message }).toEqual({
      name: "InstanceProcessAdmissionClosedError",
      message: "Instance process admission is closed during runtime settlement",
    })
  }, 90_000)

  test("allows an unrelated uncached Project discovery after target disposal reaches a fixed point", async () => {
    await using target = await memoryProject()
    await using unrelated = await memoryProject()
    const registered = await Project.fromDirectory(target.path)
    await Instance.provideProjectIdentity({ directory: target.path, fn: () => Instance.project.id })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [target.path],
    })
    await Instance.disposeProjectEntries(registered.project.id, 1_000)
    const unrelatedID = await Instance.provideProjectIdentity({
      directory: unrelated.path,
      fn: () => Instance.project.id,
    })

    expect({ unrelatedID, targetID: registered.project.id }).toEqual({
      unrelatedID: expect.any(String),
      targetID: registered.project.id,
    })
    expect(unrelatedID).not.toBe(registered.project.id)
  }, 90_000)

  test("rejects durable Task and Session creation after Project deletion admission closes", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const existing = await Instance.provide({
      directory: project.path,
      fn: () => Session.create({ kind: "root", title: "Deletion admission fixture" }),
    })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    const sessionError = await Instance.provide({
      directory: project.path,
      fn: () => Session.create({ kind: "assistant", title: "Rejected during deletion" }),
    }).catch((cause) => cause)
    const taskID = Identifier.ascending("task")
    const now = Date.now()
    const taskError = await Promise.resolve()
      .then(() =>
        Database.transaction((db) =>
          insertEngineTask(db, {
            taskID,
            projectID: registered.project.id,
            sessionID: existing.id,
            source: "test",
            productPillar: "work",
            title: "Rejected during deletion",
            request: "Durable admission is authoritative.",
            priority: 0,
            metadata: {},
            timeStarted: now,
            timeCreated: now,
            timeUpdated: now,
          }),
        ),
      )
      .catch((cause) => cause)
    const rows = Database.use((db) => ({
      sessions: db.select().from(SessionTable).where(eq(SessionTable.project_id, registered.project.id)).all().length,
      tasks: db.select().from(EngineTaskTable).where(eq(EngineTaskTable.project_id, registered.project.id)).all()
        .length,
    }))

    expect({ session: sessionError.name, task: taskError.name, rows }).toEqual({
      session: "ProjectDurableAdmissionClosedError",
      task: "ProjectDurableAdmissionClosedError",
      rows: { sessions: 1, tasks: 0 },
    })
    expect(namedErrorStatus(sessionError)).toBe(409)
    const response = await Server.App().request("/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
      body: JSON.stringify({ kind: "assistant", title: "Rejected HTTP admission" }),
    })
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 409,
      body: {
        name: "ProjectDurableAdmissionClosedError",
        data: {
          projectID: registered.project.id,
          message: `Project ${registered.project.id} durable admission is closed during deletion`,
        },
      },
    })
  }, 90_000)

  test("recovers a retained Project root from the durable deletion cleanup manifest", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    await fs.writeFile(path.join(source, "authority.txt"), "retained")
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    await fs.rename(source, plan.manifest.targets[0]!.quarantine)
    await Promise.all(Array.from({ length: 8 }, () => recoverProjectDeletionCleanup()))

    expect({
      source: await fs.readFile(path.join(source, "authority.txt"), "utf8"),
      manifest: await fs.stat(plan.manifestPath).then(
        () => "present" as const,
        (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
      ),
    }).toEqual({ source: "retained", manifest: "missing" })
  }, 90_000)

  test("preserves a live backend's in-flight Project deletion during startup recovery", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    await fs.writeFile(path.join(source, "authority.txt"), "live-deletion")
    const admission = closeProjectDeletionRegistryAdmission(registered.project.id)
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
      operationID: admission.operationID,
    })
    const quarantine = plan.manifest.targets[0]!.quarantine
    await fs.rename(source, quarantine)
    try {
      await recoverProjectDeletionCleanup(() => "exact_live")
      expect({
        manifest: await fs.readFile(plan.manifestPath, "utf8").then(() => "retained" as const),
        quarantine: await fs.readFile(path.join(quarantine, "authority.txt"), "utf8"),
      }).toEqual({ manifest: "retained", quarantine: "live-deletion" })
    } finally {
      admission[Symbol.dispose]()
    }

    await recoverProjectDeletionCleanup()
    expect(await fs.readFile(path.join(source, "authority.txt"), "utf8")).toBe("live-deletion")
  }, 90_000)

  test("cleans a committed Project quarantine from the durable deletion cleanup manifest", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    const quarantine = plan.manifest.targets[0]!.quarantine
    await fs.rename(source, quarantine)
    Database.use((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, registered.project.id)).run())
    await Promise.all(Array.from({ length: 8 }, () => recoverProjectDeletionCleanup()))

    const cleanupRoot = ProjectDeletionCleanupTestHooks.root()
    const completedRoot = ProjectDeletionCleanupTestHooks.completedRoot()
    expect({
      quarantine: await fs.stat(quarantine).then(
        () => "present" as const,
        (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
      ),
      manifests: await fs
        .readdir(cleanupRoot)
        .catch((error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? [] : Promise.reject(error))),
      completed: await fs.readdir(completedRoot),
    }).toEqual({
      quarantine: "missing",
      manifests: [],
      completed: [path.basename(plan.manifestPath)],
    })
  }, 90_000)

  test("commits cleanup after the quarantined root parent is already absent", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    await fs.rename(source, plan.manifest.targets[0]!.quarantine)
    await fs.rm(project.path, { recursive: true, force: true })
    Database.use((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, registered.project.id)).run())

    const actualSyncDirectoryMetadata = Filesystem.syncDirectoryMetadata.bind(Filesystem)
    const syncDirectoryMetadata = spyOn(Filesystem, "syncDirectoryMetadata").mockImplementation(async (directory) => {
      if (path.resolve(directory) === path.resolve(project.path)) {
        throw Object.assign(new Error(`missing cleanup parent: ${directory}`), { code: "ENOENT" })
      }
      return actualSyncDirectoryMetadata(directory)
    })
    try {
      await recoverProjectDeletionCleanup()
    } finally {
      syncDirectoryMetadata.mockRestore()
    }

    expect({
      active: await fs
        .readdir(ProjectDeletionCleanupTestHooks.root())
        .catch((error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? [] : Promise.reject(error))),
      completed: await fs.readdir(ProjectDeletionCleanupTestHooks.completedRoot()),
    }).toEqual({ active: [], completed: [path.basename(plan.manifestPath)] })
  }, 90_000)

  test("recovers a completed cleanup ledger after the canonical database identity changes", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    const quarantine = plan.manifest.targets[0]!.quarantine
    await fs.rename(source, quarantine)
    Database.use((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, registered.project.id)).run())
    await recoverProjectDeletionCleanup()
    await fs.mkdir(quarantine, { recursive: true })
    await fs.writeFile(path.join(quarantine, "power-loss-residue.txt"), "reappeared namespace entry")
    const replacementDatabaseInstanceID = crypto.randomUUID()
    Database.use((db) =>
      db
        .update(DatabaseAuthorityTable)
        .set({ instance_id: replacementDatabaseInstanceID })
        .where(eq(DatabaseAuthorityTable.key, "primary"))
        .run(),
    )

    await recoverProjectDeletionCleanup()

    expect({
      databaseInstanceID: Database.Identity(),
      oldCompletedLedger: await fs.readdir(
        ProjectDeletionCleanupTestHooks.completedRoot(plan.manifest.databaseInstanceID),
      ),
      quarantine: await fs.stat(quarantine).then(
        () => "present" as const,
        (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
      ),
    }).toEqual({
      databaseInstanceID: replacementDatabaseInstanceID,
      oldCompletedLedger: [path.basename(plan.manifestPath)],
      quarantine: "missing",
    })
  }, 90_000)

  test("does not restore an old quarantine into a recreated Project with the same deterministic ID", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    await fs.writeFile(path.join(source, "authority.txt"), "old-generation")
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    const quarantine = plan.manifest.targets[0]!.quarantine
    await fs.rename(source, quarantine)
    Database.use((db) => {
      db.delete(ProjectTable).where(eq(ProjectTable.id, registered.project.id)).run()
      db.insert(ProjectTable)
        .values({
          id: registered.project.id,
          worktree: project.path,
          sandboxes: [],
          generation: crypto.randomUUID(),
          time_created: registered.project.time.created,
          time_updated: registered.project.time.created,
        })
        .run()
    })
    await fs.mkdir(source, { recursive: true })
    await fs.writeFile(path.join(source, "authority.txt"), "new-generation")
    await recoverProjectDeletionCleanup()

    expect({
      source: await fs.readFile(path.join(source, "authority.txt"), "utf8"),
      quarantine: await fs.stat(quarantine).then(
        () => "present" as const,
        (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? ("missing" as const) : Promise.reject(error)),
      ),
      projectGeneration: Database.use((db) =>
        db
          .select({ generation: ProjectTable.generation })
          .from(ProjectTable)
          .where(eq(ProjectTable.id, registered.project.id))
          .get(),
      )?.generation,
    }).toEqual({
      source: "new-generation",
      quarantine: "missing",
      projectGeneration: expect.not.stringMatching(new RegExp(`^${plan.manifest.projectGeneration}$`)),
    })
  }, 90_000)

  test("fails closed when a cleanup manifest belongs to another database instance", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    await fs.rename(source, plan.manifest.targets[0]!.quarantine)
    const mismatched = { ...plan.manifest, databaseInstanceID: crypto.randomUUID() }
    await fs.writeFile(plan.manifestPath, `${JSON.stringify(mismatched, null, 2)}\n`)
    const error = await recoverProjectDeletionCleanup().catch((cause) => cause)

    expect({
      outer: error.name,
      inner: error.errors?.[0]?.name,
      manifest: await fs.stat(plan.manifestPath).then(() => "present"),
      quarantine: await fs.stat(plan.manifest.targets[0]!.quarantine).then(() => "present"),
    }).toEqual({
      outer: "AggregateError",
      inner: "ProjectDeletionCleanupDatabaseMismatchError",
      manifest: "present",
      quarantine: "present",
    })
    await fs.writeFile(plan.manifestPath, `${JSON.stringify(plan.manifest, null, 2)}\n`)
    await recoverProjectDeletionCleanup()
  }, 90_000)

  test("rejects a cleanup manifest whose target escapes the exact Project-owned root", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    const plan = await createProjectDeletionCleanupPlan({
      projectID: registered.project.id,
      directory: project.path,
      sources: [source],
    })
    const escapedSource = path.join(path.dirname(project.path), "unowned-root")
    const escaped = {
      ...plan.manifest,
      targets: [{ source: escapedSource, quarantine: `${escapedSource}.deleting-${plan.manifest.operationID}-0` }],
    }
    await fs.writeFile(plan.manifestPath, `${JSON.stringify(escaped, null, 2)}\n`)
    const error = await recoverProjectDeletionCleanup().catch((cause) => cause)

    expect({
      outer: error.name,
      message: error.errors?.[0]?.message,
      source: await fs.stat(source).then(() => "present"),
      manifest: await fs.stat(plan.manifestPath).then(() => "present"),
    }).toEqual({
      outer: "AggregateError",
      message: expect.stringContaining("outside the exact Project-owned root"),
      source: "present",
      manifest: "present",
    })
    await fs.writeFile(plan.manifestPath, `${JSON.stringify(plan.manifest, null, 2)}\n`)
    await recoverProjectDeletionCleanup()
  }, 90_000)

  test("returns a committed cleanup receipt and converges its durable residue on recovery", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    await fs.writeFile(path.join(source, "authority.txt"), "committed")
    const actualRm = fs.rm.bind(fs)
    const rm = spyOn(fs, "rm").mockImplementation(async (target, options) => {
      if (String(target).includes(".deleting-")) {
        throw Object.assign(new Error(`cleanup denied: ${String(target)}`), { code: "EACCES" })
      }
      return actualRm(target, options as never)
    })
    let result
    try {
      result = await deleteProject(registered.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_committed_cleanup_pending",
        reason: "Prove committed cleanup has durable recovery authority",
      })
    } finally {
      rm.mockRestore()
    }
    const pending = await fs.readdir(ProjectDeletionCleanupTestHooks.root())
    await recoverProjectDeletionCleanup()
    const recovered = await fs
      .readdir(ProjectDeletionCleanupTestHooks.root())
      .catch((error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? [] : Promise.reject(error)))
    const completed = await fs.readdir(ProjectDeletionCleanupTestHooks.completedRoot())

    expect({ result, pending, recovered, completed, project: Project.get(registered.project.id) }).toEqual({
      result: {
        ok: true,
        status: "committed_with_residue",
        projectID: registered.project.id,
        directory: project.path,
        deletedTaskCount: 0,
        residue: [{ path: expect.stringContaining(".deleting-"), message: expect.stringContaining("cleanup denied") }],
      },
      pending: [expect.stringMatching(/\.json$/)],
      recovered: [],
      completed: [expect.stringMatching(/\.json$/)],
      project: undefined,
    })
  }, 90_000)

  test("rolls back staged Project state when the database commit fails", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const source = ProjectRuntimePaths.projectConfigRoot(project.path)
    await fs.mkdir(source, { recursive: true })
    await fs.writeFile(path.join(source, "authority.txt"), "retained")
    const actualRename = Filesystem.renameDurableNoReplace
    const commit = spyOn(Filesystem, "renameDurableNoReplace").mockImplementation(async (from, to) => {
      await actualRename(from, to)
      if (from === source) {
        Database.use((db) =>
          db
            .update(ProjectTable)
            .set({ sandboxes: [path.join(project.path, "concurrent-sandbox")] })
            .where(eq(ProjectTable.id, registered.project.id))
            .run(),
        )
      }
    })
    try {
      const error = await deleteProject(registered.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: "request_database_commit_rollback",
        reason: "Prove staged filesystem authority is recoverable before commit",
      }).catch((cause) => cause)
      const manifests = await fs
        .readdir(ProjectDeletionCleanupTestHooks.root())
        .catch((cause: NodeJS.ErrnoException) => (cause.code === "ENOENT" ? [] : Promise.reject(cause)))
      expect({
        error: { name: error.name, stage: error.data?.stage, cause: error.cause?.message },
        authority: await fs.readFile(path.join(source, "authority.txt"), "utf8"),
        project: Project.get(registered.project.id)?.id,
        manifests,
      }).toEqual({
        error: {
          name: "ProjectDeletePendingError",
          stage: "database-commit",
          cause: `Project ${registered.project.id} registry identity changed during deletion`,
        },
        authority: "retained",
        project: registered.project.id,
        manifests: [],
      })
    } finally {
      commit.mockRestore()
    }
  }, 90_000)

  test("returns from a permanent target State disposal failure and preserves Project authority", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provide({ directory: project.path, fn: () => deletionProbeState() })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [project.path],
    })
    rejectDeletionProbeDisposal = true
    const outcome = await Promise.race([
      Instance.disposeProjectEntries(registered.project.id, 1_000).then(
        () => ({ state: "unexpected-success" as const }),
        (error) => ({ state: "bounded-error" as const, message: error.message }),
      ),
      Bun.sleep(2_000).then(() => ({ state: "unbounded" as const })),
    ])
    rejectDeletionProbeDisposal = false
    await Instance.disposeProjectEntries(registered.project.id, 1_000)

    expect({ outcome, project: Project.get(registered.project.id)?.id }).toEqual({
      outcome: { state: "bounded-error", message: expect.stringContaining("deterministic Project disposal failure") },
      project: registered.project.id,
    })
  }, 90_000)

  test("bounds a Project State disposer that never settles", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    await Instance.provide({ directory: project.path, fn: () => deletionProbeState() })
    using _registry = closeProjectDeletionRegistryAdmission(registered.project.id)
    using _instances = await Instance.closeProjectAdmission({
      projectID: registered.project.id,
      directories: [project.path],
    })
    holdDeletionProbeDisposal = new Promise<void>((resolve) => (releaseDeletionProbeDisposal = resolve))
    const error = await Instance.disposeProjectEntries(registered.project.id, 25).catch((cause) => cause)
    _instances[Symbol.dispose]()
    _registry[Symbol.dispose]()
    const reuse = await Instance.provideProjectIdentity({
      directory: project.path,
      fn: () => Instance.project.id,
    })

    expect({ name: error.name, labels: error.labels, project: Project.get(registered.project.id)?.id, reuse }).toEqual({
      name: "InstanceSettlementInactivityError",
      labels: [expect.stringContaining("project-instance-disposal:")],
      project: registered.project.id,
      reuse: registered.project.id,
    })
  }, 90_000)

  test("rolls back anonymous promotion when its missing destination is registered to another Project", async () => {
    const carrying = await ImplicitProject.create()
    const destinationParentInput = path.join(path.dirname(carrying.directory), "promotion-targets")
    const conflictingProjectID = "project_claiming_missing_promotion_destination"
    await fs.mkdir(destinationParentInput)
    const destinationParent = await fs.realpath(destinationParentInput)
    const destination = path.join(destinationParent, "claimed-project")
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(ProjectTable)
        .values({
          id: conflictingProjectID,
          generation: crypto.randomUUID(),
          worktree: destination,
          sandboxes: [],
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    try {
      const error = await ImplicitProject.promote({
        project: carrying.project,
        destinationParent,
        name: "claimed-project",
        beforeMove: () => Instance.disposeAll(),
      }).catch((cause) => cause)
      expect(error).toMatchObject({ name: "ProjectRegisteredDirectoryConflictError" })
      const sourceState = await fs
        .stat(carrying.directory)
        .then((info) => (info.isDirectory() ? "restored" : "invalid"))
      const destinationState = await fs.stat(destination).then(
        () => "present" as const,
        (cause: NodeJS.ErrnoException) => (cause.code === "ENOENT" ? ("missing" as const) : Promise.reject(cause)),
      )
      expect({ error, sourceState, destinationState, project: Project.get(carrying.project.id) }).toMatchObject({
        error: { name: "ProjectRegisteredDirectoryConflictError" },
        sourceState: "restored",
        destinationState: "missing",
        project: { id: carrying.project.id, worktree: carrying.directory },
      })
    } finally {
      const current = Project.get(carrying.project.id)
      if (current) {
        await deleteProject(current, {
          actor: "user",
          source: "project.delete",
          surface: "api",
          requestID: "request_cleanup_promotion_conflict",
          reason: "Clean up promotion conflict fixture",
        })
      }
    }
  }, 90_000)
})

describe("Worktree GC uncertainty preservation", () => {
  test("keeps durable sandbox ownership across missing and restored discovery", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const registered = await Project.fromDirectory(project.path)
        const worktree = await Worktree.create({ name: `missing-durable-owner-${Date.now()}` })
        const sandbox = worktree.directory
        await fs.rm(sandbox, { recursive: true, force: true })

        const missing = await Project.fromDirectory(project.path)
        const missingRegistryEntry = (await Worktree.listRegisteredWorktrees(project.path)).find(
          (entry) => path.resolve(entry.path) === path.resolve(sandbox),
        )
        const missingPlan = await WorktreeGC.inspect()
        await fs.mkdir(sandbox, { recursive: true })
        const restored = await Project.fromDirectory(project.path)

        expect({
          missing: missing.project.sandboxes,
          registry: missingRegistryEntry?.prunable,
          preservation: missingPlan.preservations.map(({ projectID, reason }) => ({ projectID, reason })),
          restored: restored.project.sandboxes,
        }).toEqual({
          missing: [sandbox],
          registry: true,
          preservation: expect.arrayContaining([{ projectID: registered.project.id, reason: "durable-sandbox-owner" }]),
          restored: [sandbox],
        })

        await Project.removeSandbox(registered.project.id, sandbox)
        expect(Project.get(registered.project.id)?.sandboxes).toEqual([])
      },
    })
  }, 90_000)

  test("commits discovery against the latest sandbox authority without losing additions or reviving releases", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const registered = await Project.fromDirectory(project.path)
        const first = await Worktree.create({ name: `discovery-authority-first-${Date.now()}` })
        const concurrent = await Worktree.create({ name: `discovery-authority-concurrent-${Date.now()}` })
        const discovered = await Worktree.create({ name: `discovery-authority-new-${Date.now()}` })

        await Project.removeSandbox(registered.project.id, concurrent.directory)
        await Project.removeSandbox(registered.project.id, discovered.directory)

        {
          using _commit = Project.TestHooks.installBeforeDiscoveryCommit(async ({ directory }) => {
            if (!Project.samePath(directory, discovered.directory)) return
            await Project.addSandbox(registered.project.id, concurrent.directory)
          })
          await Project.fromDirectory(discovered.directory)
        }
        expect(Project.get(registered.project.id)?.sandboxes).toEqual([
          first.directory,
          concurrent.directory,
          discovered.directory,
        ])

        await Project.removeSandbox(registered.project.id, discovered.directory)
        {
          using _commit = Project.TestHooks.installBeforeDiscoveryCommit(async ({ directory }) => {
            if (!Project.samePath(directory, discovered.directory)) return
            await Project.removeSandbox(registered.project.id, first.directory)
          })
          await Project.fromDirectory(discovered.directory)
        }
        expect(Project.get(registered.project.id)?.sandboxes).toEqual([concurrent.directory, discovered.directory])
      },
    })
  }, 90_000)

  test("maps ownership observation failures to the public retryable contract", () => {
    const error = Ownership.observationFailure({
      operation: "scan-worktree-owner",
      code: "EACCES",
      scope: "worktree-ownership",
      diagnosticPath: path.join("private", "runtime", "marker.ownership.json"),
      cause: Object.assign(new Error("access denied"), { code: "EACCES" }),
    })

    expect({ status: namedErrorStatus(error), body: { name: error.name, data: error.data } }).toEqual({
      status: 503,
      body: {
        name: "WorktreeOwnershipObservationError",
        data: {
          operation: "scan-worktree-owner",
          code: "EACCES",
          scope: "worktree-ownership",
          message: "Worktree ownership could not be observed safely",
        },
      },
    })
    expect({ diagnosticPath: error.diagnosticPath, cause: error.cause }).toEqual({
      diagnosticPath: path.resolve("private", "runtime", "marker.ownership.json"),
      cause: expect.objectContaining({ code: "EACCES" }),
    })
  })

  test("projects ownership observation failures through each declared HTTP route contract", async () => {
    for (const request of [
      { path: "/project/current/cleanup-candidates", method: "GET" },
      { path: "/project/current/worktrees", method: "DELETE" },
      { path: "/experimental/worktree", method: "DELETE" },
    ]) {
      const error = Ownership.observationFailure({
        operation: "observe-worktree-authority",
        code: "EIO",
        scope: "worktree-ownership",
        diagnosticPath: path.join("private", "runtime", "authority"),
        cause: Object.assign(new Error("device unavailable"), { code: "EIO" }),
      })
      const headers = new Headers()
      const response = await serverErrorResponse(error, {
        req: { method: request.method, path: request.path, header: () => undefined, raw: {} },
        res: new Response(),
        header: (name: string, value: string) => headers.set(name, value),
        json: (body: unknown, init: { status: number }) => Response.json(body, init),
      } as never)
      expect({ route: request.path, status: response.status, body: await response.json() }).toEqual({
        route: request.path,
        status: 503,
        body: {
          name: "WorktreeOwnershipObservationError",
          data: {
            operation: "observe-worktree-authority",
            code: "EIO",
            scope: "worktree-ownership",
            message: "Worktree ownership could not be observed safely",
          },
        },
      })
    }
  })

  test("preserves a managed Worktree owned by an active durable process binding", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const session = await Session.create({ kind: "root", title: "Process binding owner" })
        const worktree = await Worktree.create({ name: `process-owner-${Date.now()}` })
        const now = Date.now()
        const binding = await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: worktree.directory,
          packageRevisionSHA256: "a".repeat(64),
          timeCreated: now,
        })
        Database.transaction((db) => {
          insertEngineTask(db, {
            taskID,
            projectID: Instance.project.id,
            sessionID: session.id,
            source: "test",
            productPillar: "code",
            title: "Process binding owner",
            request: "Keep the managed Worktree owned.",
            priority: "normal",
            metadata: {},
            timeStarted: now,
            timeCreated: now,
            timeUpdated: now,
          })
          appendTaskOpenedInTransaction({ db, taskID, sessionID: session.id, now, source: "test" })
          insertTaskProcessBinding({ db, payload: binding })
        })

        const result = await Worktree.removeManagedProjectWorktreeDirectory({
          projectID: Instance.project.id,
          directory: worktree.directory,
          releaseSandboxOwnership: true,
        })

        expect({
          result,
          project: Project.get(Instance.project.id),
          directory: await fs.realpath(worktree.directory),
        }).toEqual({
          result: { directory: worktree.directory, removed: false, proof: "owned" },
          project: expect.objectContaining({ sandboxes: expect.arrayContaining([worktree.directory]) }),
          directory: worktree.directory,
        })
      },
    })
  }, 90_000)

  test("returns exact GC preservation settlements after Project ownership reconciliation fails", async () => {
    await using project = await memoryProject()
    const registered = await Project.fromDirectory(project.path)
    const taskID = Identifier.ascending("task")
    const sessionID = Identifier.ascending("session")
    const candidateDirectory = ProjectRuntimePaths.worktreeDir(project.path, taskID, sessionID)
    await fs.mkdir(candidateDirectory, { recursive: true })
    await Ownership.Worktree.record({
      primaryWorktreeDir: project.path,
      worktreeDir: candidateDirectory,
      taskID,
      sessionID,
    })
    const markerDir = ProjectRuntimePaths.ownershipPaths(project.path, taskID, sessionID).worktreeMarkerDir
    const original = fs.readdir.bind(fs)
    const readdir = spyOn(fs, "readdir").mockImplementation(async (target, options) => {
      if (path.resolve(String(target)) === path.resolve(markerDir)) {
        throw Object.assign(new Error("ownership unavailable"), { code: "EACCES" })
      }
      return original(target, options as never) as never
    })
    try {
      const result = await WorktreeGC.apply({
        candidates: [
          {
            projectID: registered.project.id,
            primaryDir: project.path,
            directory: candidateDirectory,
            reason: "old-zombie",
          },
        ],
        preservations: [],
      })
      expect({
        result,
        project: Project.get(registered.project.id),
        directory: await fs.realpath(candidateDirectory),
      }).toEqual({
        result: {
          settlements: [
            {
              status: "preserved",
              scope: "project",
              projectID: registered.project.id,
              reason: "ownership-observation",
              operation: "list-worktree-markers",
              code: "EACCES",
            },
            {
              status: "preserved",
              scope: "candidate",
              projectID: registered.project.id,
              directory: candidateDirectory,
              reason: "ownership-observation",
              operation: "reconcile-worktree-owners",
              code: "PROJECT_AUTHORITY_PRESERVED",
            },
          ],
          summary: { removed: 0, preserved: 2 },
        },
        project: expect.objectContaining({ worktree: project.path }),
        directory: candidateDirectory,
      })
    } finally {
      readdir.mockRestore()
    }
  }, 90_000)

  test("contains unavailable Project roots and managed state while classifying a healthy Project's real residue", async () => {
    await using healthy = await memoryProject()
    await using malformed = await memoryProject()
    await Instance.provide({
      directory: healthy.path,
      fn: async () => {
        const invalidatedDirectory = path.join(healthy.path, "project-removed-after-registration")
        await fs.mkdir(invalidatedDirectory)
        const invalidated = await Project.fromDirectory(invalidatedDirectory)
        await fs.rm(invalidatedDirectory, { recursive: true })

        const malformedProject = await Project.fromDirectory(malformed.path)
        const malformedTasksRoot = ProjectRuntimePaths.taskCollectionRoot(malformed.path)
        await fs.mkdir(path.dirname(malformedTasksRoot), { recursive: true })
        await fs.writeFile(malformedTasksRoot, "malformed managed state")

        const zombie = path.join(Worktree.worktreesRoot(healthy.path), "legacy-zombie")
        await fs.mkdir(zombie, { recursive: true })
        const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1_000)
        await fs.utimes(zombie, old, old)

        const plan = await WorktreeGC.inspect({ retentionDays: 3 })

        expect(
          plan.preservations.map(({ projectID, primaryDir, reason }) => ({ projectID, primaryDir, reason })),
        ).toContainEqual({
          projectID: invalidated.project.id,
          primaryDir: invalidatedDirectory,
          reason: "primary-directory-unavailable",
        })
        expect(
          plan.preservations.map(({ projectID, primaryDir, reason }) => ({ projectID, primaryDir, reason })),
        ).toContainEqual({
          projectID: malformedProject.project.id,
          primaryDir: malformed.path,
          reason: "managed-state-unavailable",
        })
        expect(
          plan.candidates.map(({ projectID, primaryDir, directory, reason }) => ({
            projectID,
            primaryDir,
            directory,
            reason,
          })),
        ).toContainEqual({
          projectID: Instance.project.id,
          primaryDir: healthy.path,
          directory: zombie,
          reason: "old-zombie",
        })
      },
    })
  }, 0)
})
