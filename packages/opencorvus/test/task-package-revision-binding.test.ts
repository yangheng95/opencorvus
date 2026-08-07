import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import { persistQueuedTask } from "../src/engine/pipeline"
import {
  TaskCreationIdempotencyConflictError,
  TaskExpectedPackageDigestConflictError,
  TaskPromptProfileImmutableError,
  requireTaskPackageRevisionBinding,
  taskRootOwnsPackageRevisionBinding,
} from "../src/engine/task-package-revision-binding"
import { requireTask, viewTask, viewTaskListTask } from "../src/engine/store"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { assertTaskWorkflowBindingInTransaction } from "../src/engine/workflow-binding-facts"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { EffectiveConfig } from "../src/config/effective"
import { Config } from "../src/config/config"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { EngineService } from "../src/task-api"
import { configureTaskLoopRunner, startQueuedTaskInCwd } from "../src/engine/queue"
import { resolvePinnedTaskSchedulerTurnProjection } from "../src/engine/task-package-projection"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { CreateTaskInput } from "../src/engine/model"
import { MissionPanelActionSchema } from "../src/panel/capability"
import { cp, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { ExecutionCapsuleRuntimeUnavailableError } from "../src/execution-capsule/runtime"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { materializeMirrorPrismPackage } from "./fixture/expert-squad"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

async function createBoundTask() {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const session = await Session.create({
    kind: "root",
    title: "Pinned package revision task",
    metadata: {
      configOverlay: { prompt_profile: { active: packageRevision.id } },
    },
  })
  persistQueuedTask({
    taskID,
    sessionID: session.id,
    now,
    title: "Pinned package revision task",
    request: "Verify immutable expert-squad package revision binding",
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
  return { taskID, session }
}

describe("Task package revision binding", () => {
  test("commits one exact package revision with the Task and projects it through Task reads", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createBoundTask()
        const expectedBinding = {
          scope: "built_in",
          project_id: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.06.1",
          package_digest: "a".repeat(64),
        }

        expect(requireTaskPackageRevisionBinding(taskID)).toEqual(expectedBinding)
        expect(viewTask(requireTask(taskID)).packageRevisionBinding).toEqual(expectedBinding)
        expect(viewTaskListTask(requireTask(taskID)).packageRevisionBinding).toEqual(expectedBinding)
        expect(
          taskRootOwnsPackageRevisionBinding({ projectID: Instance.project.id, sessionID: requireTask(taskID).session_id }),
        ).toBe(true)

        const workflowBinding = selectedWorkflowBinding({
          projection: { packageRevision, virtualWorkflows: {} },
          workflowID: null,
        })
        Database.use((db) =>
          assertTaskWorkflowBindingInTransaction({
            db,
            taskID,
            workflowBinding,
          }),
        )
      },
    })
  }, 0)

  test("accepts same-profile root configuration updates and returns the immutable-profile error contract", async () => {
    const project = await memoryProject()
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { taskID, session } = await createBoundTask()
          const updated = await Session.mergeConfigOverlay({
            sessionID: session.id,
            patch: { prompt_profile: { active: packageRevision.id } },
          })
          expect(
            (updated.metadata?.configOverlay as { prompt_profile: { active: string } }).prompt_profile.active,
          ).toBe(packageRevision.id)

          try {
            await Session.mergeConfigOverlay({
              sessionID: session.id,
              patch: { prompt_profile: { active: "advanced" } },
            })
            throw new Error("Expected immutable Task expert-squad profile contract")
          } catch (error) {
            expect(error).toBeInstanceOf(TaskPromptProfileImmutableError)
            expect((error as InstanceType<typeof TaskPromptProfileImmutableError>).toObject()).toEqual({
              name: "TaskPromptProfileImmutableError",
              data: {
                message: `Task ${taskID} is permanently bound to expert squad base`,
                taskID,
                pinnedPackageRevision: requireTaskPackageRevisionBinding(taskID),
                requestedProfileID: "advanced",
              },
            })
          }
          expect(ProcessSupervisor.metricsSnapshot()).toEqual({ live: 0, owners: {} })
        },
      })
    } finally {
      await project[Symbol.asyncDispose]()
    }
    expect(ProcessSupervisor.metricsSnapshot()).toEqual({ live: 0, owners: {} })
  }, 0)

  test("creates and idempotently replays a Task against the exact resolved package digest", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskLoopRunner(async () => {})
        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "base" },
        })
        const resolved = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: Instance.project.worktree,
          config,
        })
        const requestID = `package-pin-${Identifier.ascending("artifact")}`
        const input = {
          requestID,
          request: "Create an exact package-pinned queued Task",
          productPillar: "code",
          model: "firmware/gpt-5",
          promptProfile: "base",
          expectedPackageDigest: resolved.packageDigest,
          queue: true,
        }
        const firstTaskID = await EngineService.createTask(input, { actor: "user" })
        const replayTaskID = await EngineService.createTask(input, { actor: "user" })
        expect(replayTaskID).toBe(firstTaskID)
        expect(requireTaskPackageRevisionBinding(firstTaskID).package_digest).toBe(resolved.packageDigest)
        for (const conflictingInput of [
          { ...input, promptProfile: "advanced" },
          { ...input, expectedPackageDigest: "b".repeat(64) },
        ]) {
          try {
            await EngineService.createTask(conflictingInput, { actor: "user" })
            throw new Error("Expected immutable request replay contract")
          } catch (error) {
            expect(error).toBeInstanceOf(TaskCreationIdempotencyConflictError)
            expect(
              (error as InstanceType<typeof TaskCreationIdempotencyConflictError>).toObject().data,
            ).toMatchObject({
              taskID: firstTaskID,
              identityKind: "request",
              identity: requestID,
              pinnedPackageRevision: requireTaskPackageRevisionBinding(firstTaskID),
            })
          }
        }
        const projectionAfterAmbientProfileChange = await resolvePinnedTaskSchedulerTurnProjection({
          taskID: firstTaskID,
          projectDirectory: Instance.project.worktree,
          config: Config.mergeOverlay(config, { prompt_profile: { active: "advanced" } }),
        })
        expect(projectionAfterAmbientProfileChange.schedulerCapability.expertSquadID).toBe("base")
        expect(projectionAfterAmbientProfileChange.packageRevision.packageDigest).toBe(resolved.packageDigest)

        const retryRequestID = `package-pin-retry-${Identifier.ascending("artifact")}`
        try {
          await EngineService.createTask(
            {
              ...input,
              requestID: retryRequestID,
              expectedPackageDigest: "b".repeat(64),
            },
            { actor: "user" },
          )
          throw new Error("Expected package digest compare-and-swap conflict")
        } catch (error) {
          expect(error).toBeInstanceOf(TaskExpectedPackageDigestConflictError)
          expect(
            (error as InstanceType<typeof TaskExpectedPackageDigestConflictError>).toObject().data,
          ).toMatchObject({
            profileID: "base",
            expectedPackageDigest: "b".repeat(64),
            actualPackageDigest: resolved.packageDigest,
          })
        }
        const acceptedRetryTaskID = await EngineService.createTask(
          { ...input, requestID: retryRequestID },
          { actor: "user" },
        )
        expect(requireTaskPackageRevisionBinding(acceptedRetryTaskID).package_digest).toBe(resolved.packageDigest)

        const channelBinding = {
          platform: "test",
          channel: `package-pin-${Identifier.ascending("artifact")}`,
          thread: "root",
        }
        const channelInput = { ...input, requestID: undefined, channelBinding }
        const channelTaskID = await EngineService.createTask(channelInput, { actor: "user" })
        expect(await EngineService.createTask(channelInput, { actor: "user" })).toBe(channelTaskID)
        for (const conflictingInput of [
          { ...channelInput, promptProfile: "advanced" },
          { ...channelInput, expectedPackageDigest: "b".repeat(64) },
        ]) {
          try {
            await EngineService.createTask(conflictingInput, { actor: "user" })
            throw new Error("Expected immutable channel replay contract")
          } catch (error) {
            expect(error).toBeInstanceOf(TaskCreationIdempotencyConflictError)
            expect(
              (error as InstanceType<typeof TaskCreationIdempotencyConflictError>).toObject().data,
            ).toMatchObject({
              taskID: channelTaskID,
              identityKind: "channel",
              pinnedPackageRevision: requireTaskPackageRevisionBinding(channelTaskID),
            })
          }
        }

        expect(
          CreateTaskInput.parse({
            request: "Create through the HTTP Task contract",
            productPillar: "code",
            promptProfile: "base",
            expectedPackageDigest: resolved.packageDigest,
          }).expectedPackageDigest,
        ).toBe(resolved.packageDigest)
        expect(
          MissionPanelActionSchema.parse({
            action: "create_task",
            request: "Create through the Mission Panel contract",
            title: "Pinned package Task",
            productPillar: "code",
            promptProfile: "base",
            expectedPackageDigest: resolved.packageDigest,
          }).expectedPackageDigest,
        ).toBe(resolved.packageDigest)
      },
    })
  }, 0)

  test("reopens a persisted Task against the same package revision after Project runtime disposal", async () => {
    const project = await memoryProject()
    try {
      const created = await Instance.provide({
        directory: project.path,
        fn: async () => {
          configureTaskLoopRunner(async () => {})
          const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
            prompt_profile: { active: "base" },
          })
          const resolved = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: Instance.project.worktree,
            config,
          })
          const taskID = await EngineService.createTask(
            {
              requestID: `package-restart-${Identifier.ascending("artifact")}`,
              request: "Reopen this package-pinned Task after Project runtime disposal",
              productPillar: "code",
              model: "firmware/gpt-5",
              promptProfile: "base",
              expectedPackageDigest: resolved.packageDigest,
              queue: true,
            },
            { actor: "user" },
          )
          return { taskID, packageDigest: resolved.packageDigest }
        },
      })

      await Instance.disposeAll()
      expect(ProcessSupervisor.metricsSnapshot()).toEqual({ live: 0, owners: {} })

      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
            prompt_profile: { active: "advanced" },
          })
          const resumed = await resolvePinnedTaskSchedulerTurnProjection({
            taskID: created.taskID,
            projectDirectory: Instance.project.worktree,
            config,
          })
          expect(resumed.packageRevision.packageDigest).toBe(created.packageDigest)
          expect(resumed.schedulerCapability.expertSquadID).toBe("base")
          const worker = await PromptProfileResolver.resolveWorkerTurnProjection({
            projectDirectory: Instance.project.worktree,
            config,
            agentID: "base-researcher",
            packageRevision: resumed.packageRevision,
          })
          expect(worker.workerCapability.expertSquadID).toBe("base")
          expect(worker.workerCapability.packageRevision.packageDigest).toBe(created.packageDigest)
          expect(viewTask(requireTask(created.taskID)).packageRevisionBinding.package_digest).toBe(
            created.packageDigest,
          )
        },
      })
    } finally {
      await project[Symbol.asyncDispose]()
    }
    expect(ProcessSupervisor.metricsSnapshot()).toEqual({ live: 0, owners: {} })
  }, 0)

  test("keeps a queued Task durable when its required Execution Capsule binding is unavailable", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createBoundTask()
        configureTaskLoopRunner(async () => {})
        const previousDescriptor = process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
        const previousProcessMode = process.env.OPENCORVUS_TASK_PROCESS_MODE
        process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = path.join(project.path, "runtime-descriptor.json")
        process.env.OPENCORVUS_TASK_PROCESS_MODE = "capsule"
        try {
          await startQueuedTaskInCwd(taskID, project.path)
          throw new Error("Expected the immutable Execution Capsule binding error")
        } catch (error) {
          expect(error).toBeInstanceOf(ExecutionCapsuleRuntimeUnavailableError)
          expect({ code: (error as ExecutionCapsuleRuntimeUnavailableError).code, status: viewTask(requireTask(taskID)).status }).toEqual({
            code: "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE",
            status: "queued",
          })
        } finally {
          if (previousDescriptor === undefined) delete process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
          else process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = previousDescriptor
          if (previousProcessMode === undefined) delete process.env.OPENCORVUS_TASK_PROCESS_MODE
          else process.env.OPENCORVUS_TASK_PROCESS_MODE = previousProcessMode
        }
      },
    })
  }, 0)

  test("binds an external Task to an exact materialized candidate without changing the installed revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskLoopRunner(async () => {})
        const sourcePackage = await materializeMirrorPrismPackage(path.join(project.path, "source-prism"))
        const baseline = await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: sourcePackage,
          installationScope: "project",
        })
        const candidateDirectory = path.join(project.path, "candidate-prism")
        await cp(sourcePackage, candidateDirectory, { recursive: true })
        const manifestPath = path.join(candidateDirectory, "expert-squad.jsonc")
        const manifest = await readFile(manifestPath, "utf8")
        await writeFile(manifestPath, manifest.replace('"version": "2026.08.07.1"', '"version": "2026.08.07.2"'))
        await writeFile(
          path.join(candidateDirectory, "README.md"),
          `${await readFile(path.join(candidateDirectory, "README.md"), "utf8")}\nCandidate benchmark revision.\n`,
        )
        const candidate = await ExpertSquadRegistry.loadSourcePackage(candidateDirectory)

        const taskID = await EngineService.createTask(
          {
            requestID: `candidate-pin-${Identifier.ascending("artifact")}`,
            request: "Execute against the exact materialized candidate revision",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "prism",
            expectedPackageDigest: candidate.packageDigest,
            queue: true,
          },
          { actor: "user" },
        )
        expect(requireTaskPackageRevisionBinding(taskID)).toEqual({
          scope: "project",
          project_id: Instance.project.id,
          namespace: "mirror",
          id: "prism",
          version: "2026.08.07.2",
          package_digest: candidate.packageDigest,
        })
        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "prism" },
        })
        const installed = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: Instance.project.worktree,
          config,
        })
        expect(installed.packageDigest).toBe(baseline.after.packageDigest)
        expect(
          (
            await resolvePinnedTaskSchedulerTurnProjection({
              taskID,
              projectDirectory: Instance.project.worktree,
              config,
            })
          ).packageRevision.packageDigest,
        ).toBe(candidate.packageDigest)
      },
    })
  }, 0)
})
