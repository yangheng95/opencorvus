import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { EngineArtifactTable } from "../src/engine/engine.sql"
import { persistTask } from "../src/engine/pipeline"
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
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { PlatformCapabilitySetRegistry } from "../src/agent/platform-capability-sets"
import { EffectiveConfig } from "../src/config/effective"
import { Config } from "../src/config/config"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { EngineService } from "../src/task-api"
import {
  configureTaskIngressRunner,
  requireTaskCreationIngressID,
  TestHooks as TaskControlTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "../src/engine/task-root-ingress-delivery"
import { EngineTaskRootIngressTable } from "../src/engine/engine.sql"
import {
  resolvePinnedTaskSchedulerTurnProjection,
  taskPackageRevisionForSession,
} from "../src/engine/task-package-projection"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { CreateTaskInput } from "../src/engine/model"
import { MissionPanelActionSchema } from "../src/panel/capability"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { materializeMirrorPrismPackage } from "./fixture/expert-squad"
import { ensureMissionSession } from "../src/mission/session"
import {
  MissionExpertSquadAuthorityError,
  requireMissionTaskCreationOpenedOccurrence,
} from "../src/task-api/task-creator"
import { openMissionThroughRealWake } from "./fixture/mission-opened"
import { SkillMount } from "../src/skill/mounts"
import { PromptProfile } from "../src/agent/prompt-profile"
import { Message } from "../src/session/message"
import { parse as parseJsonc } from "jsonc-parser"

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
  const session = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Pinned package revision task",
    metadata: {
      configOverlay: { prompt_profile: { active: packageRevision.id } },
    },
  })
  persistTask({
    taskID,
    rootSession: session,
    now,
    title: "Pinned package revision task",
    request: "Verify immutable expert-squad package revision binding",
    productPillar: "code",
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
  return { taskID, session }
}

async function settleTaskCreationIngress(input: { taskID: string; wakeID?: string }) {
  if (!input.wakeID) throw new Error(`Task ${input.taskID} creation runner requires its exact ingress ID`)
  const rootSessionID = requireTask(input.taskID).session_id
  const session = await Session.create({
    kind: "orchestrator",
    parentID: rootSessionID,
    title: "Package revision creation settlement",
  })
  const now = Date.now()
  const messageID = Identifier.ascending("message")
  const info: Message.Assistant = {
    id: messageID,
    sessionID: session.id,
    parentID: Identifier.ascending("message"),
    role: "assistant",
    author: "orchestrator",
    time: { created: now, completed: now + 1 },
    agent: "orchestrator",
    providerID: "test",
    modelID: "package-revision-settlement",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
    taskIngress: { id: input.wakeID, kind: "task_creation" },
  }
  await Session.persistMessage({
    info,
    parts: [
      {
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID,
        type: "text",
        text: "Settled the exact Task creation ingress for the package revision contract.",
      },
    ],
  })
  return { finalMessageID: messageID }
}

describe("Task package revision binding", () => {
  test("enforces the immutable Mission held-Squad authority at Task creation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-authority-held",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        await openMissionThroughRealWake({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "mission-authority-held:dispatch",
        })
        using _taskIngress = TaskControlTestHooks.replaceTaskIngressRunner({ runner: settleTaskCreationIngress })
        const missionCreator = {
          actor: "mission" as const,
          sessionID: mission.id,
          openedOccurrence: requireMissionTaskCreationOpenedOccurrence(mission.id),
        }
        const taskID = await EngineService.createTask(
          {
            requestID: `mission-held-${Identifier.ascending("artifact")}`,
            title: "Held Base delivery",
            request: "Create one Task with the Mission-held Base expert squad",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          missionCreator,
        )
        expect(requireTaskPackageRevisionBinding(taskID)).toMatchObject({ id: "base", scope: "built_in" })

        try {
          await EngineService.createTask(
            {
              requestID: `mission-unheld-${Identifier.ascending("artifact")}`,
              title: "Unheld Advanced delivery",
              request: "Attempt a Task with an Expert Squad outside Mission authority",
              productPillar: "code",
              model: "firmware/gpt-5",
              promptProfile: "advanced",
            },
            missionCreator,
          )
          throw new Error("Expected Mission Expert Squad authority contract")
        } catch (error) {
          expect(error).toBeInstanceOf(MissionExpertSquadAuthorityError)
          expect((error as InstanceType<typeof MissionExpertSquadAuthorityError>).toObject().data).toEqual({
            message: 'Mission may create a Task only with a held Expert Squad; received "advanced".',
            missionSessionID: mission.id,
            requestedProfileID: "advanced",
            heldExpertSquadCount: 1,
            heldExpertSquadSnapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          })
        }
        try {
          await EngineService.createTask(
            {
              requestID: `mission-missing-profile-${Identifier.ascending("artifact")}`,
              title: "Missing Expert Squad delivery",
              request: "Attempt a Mission Task without an explicit Expert Squad",
              productPillar: "code",
              model: "firmware/gpt-5",
            },
            missionCreator,
          )
          throw new Error("Expected explicit Mission Expert Squad authority contract")
        } catch (error) {
          expect(error).toBeInstanceOf(MissionExpertSquadAuthorityError)
          expect((error as InstanceType<typeof MissionExpertSquadAuthorityError>).toObject().data).toMatchObject({
            missionSessionID: mission.id,
            requestedProfileID: null,
            heldExpertSquadCount: 1,
          })
        }
      },
    })
    await waitForIngressDeliveryHooksForTest()
  }, 0)

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
          taskRootOwnsPackageRevisionBinding({
            projectID: Instance.project.id,
            sessionID: requireTask(taskID).session_id,
          }),
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
        configureTaskIngressRunner(settleTaskCreationIngress)
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
          request: "Create an exact package-pinned Task",
          productPillar: "code",
          model: "firmware/gpt-5",
          promptProfile: "base",
          expectedPackageDigest: resolved.packageDigest,
          metadata: { web_search: true },
        }
        const firstTaskID = await EngineService.createTask(input, { actor: "user" })
        const firstCreationIngressID = requireTaskCreationIngressID(firstTaskID)
        const replayTaskID = await EngineService.createTask(input, { actor: "user" })
        expect(replayTaskID).toBe(firstTaskID)
        expect(requireTaskCreationIngressID(replayTaskID)).toBe(firstCreationIngressID)
        const firstTask = requireTask(firstTaskID)
        expect((await Session.get(firstTask.session_id)).permission).toEqual([
          { permission: "websearch", pattern: "*", action: "allow" },
        ])
        const firstCreationIngress = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.id, firstCreationIngressID))
            .get(),
        )
        expect({
          status: viewTask(firstTask).status,
          timeStarted: firstTask.time_started,
          ingress: firstCreationIngress,
        }).toMatchObject({
          status: "active",
          timeStarted: expect.any(Number),
          ingress: { source: "task", source_id: firstTaskID, inline_payload: null },
        })
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
            expect((error as InstanceType<typeof TaskCreationIdempotencyConflictError>).toObject().data).toMatchObject({
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
          expect((error as InstanceType<typeof TaskExpectedPackageDigestConflictError>).toObject().data).toMatchObject({
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
        expect([firstTaskID, acceptedRetryTaskID, channelTaskID].map((id) => viewTask(requireTask(id)).status)).toEqual(
          ["active", "active", "active"],
        )
        for (const conflictingInput of [
          { ...channelInput, promptProfile: "advanced" },
          { ...channelInput, expectedPackageDigest: "b".repeat(64) },
        ]) {
          try {
            await EngineService.createTask(conflictingInput, { actor: "user" })
            throw new Error("Expected immutable channel replay contract")
          } catch (error) {
            expect(error).toBeInstanceOf(TaskCreationIdempotencyConflictError)
            expect((error as InstanceType<typeof TaskCreationIdempotencyConflictError>).toObject().data).toMatchObject({
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
    await waitForIngressDeliveryHooksForTest()
  }, 0)
  test("reopens a persisted Task against the same package revision after Project runtime disposal", async () => {
    const project = await memoryProject()
    try {
      const created = await Instance.provide({
        directory: project.path,
        fn: async () => {
          configureTaskIngressRunner(settleTaskCreationIngress)
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
            },
            { actor: "user" },
          )
          return { taskID, packageDigest: resolved.packageDigest }
        },
      })

      await waitForIngressDeliveryHooksForTest()
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
  test("binds an external Task to an exact materialized candidate without changing the installed revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        configureTaskIngressRunner(settleTaskCreationIngress)
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
        const candidateManifest = parseJsonc(manifest) as {
          version: string
          product_pillars: Array<"code" | "work" | "research">
          capability_projection: {
            agents: Record<string, { base_role?: unknown; prompt?: unknown; [key: string]: unknown }>
          }
        }
        candidateManifest.version = "2026.08.07.2"
        const sourceAgent = Object.values(candidateManifest.capability_projection.agents).find(
          (agent) => typeof agent.prompt === "string",
        )
        if (!sourceAgent || typeof sourceAgent.prompt !== "string") {
          throw new Error("Pinned revision fixture requires one frontend-design Agent prompt")
        }
        candidateManifest.capability_projection.agents["candidate-skill-owner"] = {
          ...sourceAgent,
          label: "Candidate Skill Owner",
          prompt: "agents/candidate-skill-owner/system.md",
          base_role: "frontend-design",
          capability_refs: [
            ...((sourceAgent.capability_refs as string[] | undefined) ?? []).filter((encoded) => {
              const ref = CapabilityRefCodec.decode(encoded)
              return ref.kind !== "capability_set" || ref.source !== "platform"
            }),
            CapabilityRefCodec.encode(
              PlatformCapabilitySetRegistry.baseRef({ kind: "worker", baseRole: "frontend-design" }),
            ),
            CapabilityRefCodec.encode(
              capabilityRef({
                kind: "skill",
                source: "platform",
                owner_ref: "skill-manager",
                local_ref: "default/skill/design-taste-frontend",
              }),
            ),
          ].sort(),
        }
        await writeFile(manifestPath, `${JSON.stringify(candidateManifest, null, 2)}\n`)
        const candidateAgentDirectory = path.join(candidateDirectory, "agents", "candidate-skill-owner")
        await mkdir(candidateAgentDirectory, { recursive: true })
        await cp(
          path.join(candidateDirectory, ...sourceAgent.prompt.split("/")),
          path.join(candidateAgentDirectory, "system.md"),
        )
        await writeFile(
          path.join(candidateDirectory, "README.md"),
          `${await readFile(path.join(candidateDirectory, "README.md"), "utf8")}\nCandidate benchmark revision.\n`,
        )
        const candidate = await ExpertSquadRegistry.loadSourcePackage(candidateDirectory)

        const taskID = await EngineService.createTask(
          {
            requestID: `candidate-pin-${Identifier.ascending("artifact")}`,
            request: "Execute against the exact materialized candidate revision",
            productPillar: candidateManifest.product_pillars[0]!,
            model: "firmware/gpt-5",
            promptProfile: "prism",
            expectedPackageDigest: candidate.packageDigest,
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
        const sessionID = requireTask(taskID).session_id
        const packageRevisionForSession = taskPackageRevisionForSession(sessionID)
        expect(packageRevisionForSession?.packageDigest).toBe(candidate.packageDigest)
        const [projectConfig, effectiveConfig] = await Promise.all([
          EffectiveConfig.base({ sessionID }),
          EffectiveConfig.effective({ sessionID }),
        ])
        const catalog = await PromptProfileResolver.catalog({
          config: effectiveConfig,
          projectActive: PromptProfile.activeID(projectConfig),
          sessionOverride: "prism",
          scope: { kind: "session", directory: project.path, sessionID },
          packageRevision: packageRevisionForSession,
        })
        expect(catalog.active.package_revision.package_digest).toBe(candidate.packageDigest)
        const matrix = await SkillMount.matrix({ sessionID })
        expect(matrix.active_profile).toBe("prism")
        expect(matrix.projection_hash).toBe(catalog.active_skill_projection.projection_hash)
        const mutatedMatrix = await SkillMount.setOverride({
          scope: "session",
          sessionID,
          expertSquadID: "prism",
          agentID: "candidate-skill-owner",
          defaultSkillRef: "default/skill/design-taste-frontend",
          override: false,
        })
        expect(mutatedMatrix.agents.find((agent) => agent.agent_id === "candidate-skill-owner")).toMatchObject({
          base_role: "frontend-design",
          skill_mountable: true,
        })
        expect(
          mutatedMatrix.matrix
            .find((row) => row.agent_id === "candidate-skill-owner")
            ?.grants.find((grant) => grant.ref === "default/skill/design-taste-frontend"),
        ).toMatchObject({ session_override: false, manifest_grant: true, effective: true })
      },
    })
    await waitForIngressDeliveryHooksForTest()
  }, 0)
})
