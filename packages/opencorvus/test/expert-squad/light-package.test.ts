import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "../../src/agent/dispatch-adapter-contract"
import { WorkerTurnDescriptor } from "../../src/agent/worker-turn-descriptor"
import { Config } from "../../src/config/config"
import { EffectiveConfig } from "../../src/config/effective"
import {
  createDispatchLineageOrigin,
  listDispatchLineage,
  recordDispatchLineage,
} from "../../src/engine/dispatch-lineage"
import { persistEstablishedTask } from "../fixture/engine-task"
import { requireTask } from "../../src/engine/store"
import {
  TestHooks as IngressTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "../../src/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Identifier } from "../../src/id/id"
import { orchestratorControlOccurrenceIdentity } from "../../src/orchestrator/control-message-identity"
import {
  createDispatchAgentTool,
  type DispatchAdapterExecutors,
  waitForDetachedDispatchPipelinesForTest,
} from "../../src/orchestrator/dispatch-agent-tool"
import { taskRequestSHA256 } from "../../src/orchestrator/dispatch-turn-projection"
import { createDelegatedWorkerTool } from "../../src/orchestrator/delegated-worker-tool"
import { Instance } from "../../src/project/instance"
import { ProtocolStore } from "../../src/protocol/store"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { SessionProcessor } from "../../src/session/processor"
import { SkillMount } from "../../src/skill/mounts"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = path.resolve(import.meta.dir, "../../../../expert-squads/builtin/light")
const skillRef = "light/shared/method"
const agentRoles = {
  "light-investigator": "delegated-worker",
  "light-planner": "delegated-worker",
} as const
const projectedReadOnlyTools = [
  "artifact_search",
  "artifact_read",
  "artifact_select",
  "artifact_snapshot",
  "artifact_publish",
  "publish_interactive_artifact",
  "capability_search",
  "read",
  "glob",
  "search_code",
  "webfetch",
  "websearch",
  "external_code_search",
  "skill",
]
const model = { providerID: "test", modelID: "light-parallel-dispatch" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Light Parallel Dispatch Test",
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
    api: { id: model.modelID, url: "https://light-dispatch.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-29",
  } as ProviderType.Model
}

async function requireWithin<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    Bun.sleep(10_000).then(() => {
      throw new Error(`Timed out waiting for ${label}`)
    }),
  ])
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Light Expert Squad package", () => {
  test("loads exactly the Planner and Investigator advisory roles with one shared package Skill", async () => {
    const source = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const projections = [
      source.manifest.capability_projection.scheduler,
      ...Object.values(source.manifest.capability_projection.agents),
    ]

    expect(source.manifest).toMatchObject({
      namespace: "builtin",
      id: "light",
      version: "2026.08.29.1",
      product_pillars: ["code", "work"],
    })
    expect(Object.keys(source.manifest.capability_projection.agents).sort()).toEqual(Object.keys(agentRoles).sort())
    expect(source.manifest.capability_projection.virtual_workflows).toEqual({})
    expect([...source.packageSkills.keys()]).toEqual([skillRef])
    expect(projections.map((projection) => projection.package_skill_refs)).toEqual([[skillRef], [skillRef], [skillRef]])
  })

  test("installs the released payload and projects the exact read-only advisory and Skill surfaces", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const receipt = await ExpertSquadPackageManager.installPayloadPackage({
          projectDirectory: project.path,
          id: "light",
          installationScope: "project",
        })
        expect(receipt).toMatchObject({
          operation: "installed",
          after: { installationScope: "project", namespace: "builtin", id: "light", version: "2026.08.29.1" },
        })

        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "light" },
        })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
        })
        const skillProjection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
        })

        expect(revision).toMatchObject({ namespace: "builtin", id: "light", version: "2026.08.29.1" })
        expect(scheduler.virtualWorkflows).toEqual({})
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([skillRef])
        expect(skillProjection.projectedAgentIDs).toEqual(Object.keys(agentRoles).sort())

        const workers = await Promise.all(
          Object.entries(agentRoles).map(async ([agentID, expectedBaseRole]) => {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            return {
              agentID: worker.identity.agentID,
              baseRole: worker.identity.baseRole,
              skillRefs: worker.productionSkills.map((entry) => entry.ref),
              builtInToolIDs: worker.builtInToolIDs,
              expectedBaseRole,
            }
          }),
        )
        expect(workers).toEqual([
          {
            agentID: "light-investigator",
            baseRole: "delegated-worker",
            skillRefs: [skillRef],
            builtInToolIDs: projectedReadOnlyTools,
            expectedBaseRole: "delegated-worker",
          },
          {
            agentID: "light-planner",
            baseRole: "delegated-worker",
            skillRefs: [skillRef],
            builtInToolIDs: projectedReadOnlyTools,
            expectedBaseRole: "delegated-worker",
          },
        ])

        const matrix = await SkillMount.matrix({ expertSquadID: "light" })
        for (const agentID of Object.keys(agentRoles)) {
          expect(matrix.agents.find((agent) => agent.agent_id === agentID)).toMatchObject({
            agent_id: agentID,
            base_role: "delegated-worker",
            skill_mountable: true,
            skill_tool_available: true,
            projected_tool_ids: [...projectedReadOnlyTools].sort(),
          })
          expect(
            matrix.matrix.find((row) => row.agent_id === agentID)?.grants.find((grant) => grant.ref === skillRef),
          ).toMatchObject({ manifest_grant: true, effective: true, enabled: true })
        }
      },
    })
  }, 0)

  test("runs two Planner and two Investigator dispatches as overlapping real sibling Sessions", async () => {
    await using project = await memoryProject()
    const ingressRunner = {
      runner: async ({ taskID, wakeID, predecessorID }) => {
        if (!wakeID || !predecessorID) throw new Error("Light lifecycle delivery lost its exact ingress identity")
        const task = requireTask(taskID)
        if (!task.session_id) throw new Error(`Task ${taskID} has no root Session`)
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: task.session_id,
          title: "Light lifecycle receiver",
        })
        const now = Date.now()
        const parentID = orchestratorControlOccurrenceIdentity(wakeID, predecessorID).messageID
        await Session.persistMessage({
          info: {
            id: parentID,
            sessionID: orchestrator.id,
            role: "user",
            author: "orchestrator",
            time: { created: now },
            agent: "orchestrator",
            model,
          },
          parts: [],
        })
        const assistant: Message.Assistant = {
          id: Identifier.ascending("message"),
          sessionID: orchestrator.id,
          parentID,
          role: "assistant",
          author: "orchestrator",
          time: { created: now, completed: now + 1 },
          agent: "orchestrator",
          providerID: model.providerID,
          modelID: model.modelID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
          taskIngress: { id: wakeID, kind: "agent_lifecycle_delivery" },
        }
        await Session.persistMessage({ info: assistant, parts: [] })
        return { finalMessageID: assistant.id }
      },
    } satisfies Parameters<typeof IngressTestHooks.replaceTaskIngressRunner>[0]

    let releaseWorkers: (() => void) | undefined
    let ingressRunnerLease: Disposable | undefined
    let providerSpy: ReturnType<typeof spyOn> | undefined
    let processorSpy: ReturnType<typeof spyOn> | undefined
    let taskID = ""
    let childSessionIDs: string[] = []
    let dispatchIDs: string[] = []
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          ingressRunnerLease = IngressTestHooks.replaceTaskIngressRunner(ingressRunner)
          await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: packageRoot,
            replace: false,
            installationScope: "project",
          })
          const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
            prompt_profile: { active: "light" },
          })
          const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: project.path,
            config,
          })
          const skillProjection = await PromptProfileResolver.resolveSkillProjection({
            projectDirectory: project.path,
            config,
            packageRevision,
          })
          taskID = Identifier.ascending("task")
          const taskRequest = "Compare the evidence and propose the smallest remaining questions"
          const root = Session.prepareRootNext({
            kind: "root",
            directory: Instance.directory,
            title: "Light parallel advisory",
            metadata: {
              configOverlay: {
                model: `${model.providerID}/${model.modelID}`,
                prompt_profile: { active: packageRevision.id },
              },
            },
          })
          const now = Date.now()
          persistEstablishedTask({
            taskID,
            rootSession: root,
            now,
            title: "Light parallel advisory",
            request: taskRequest,
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
          const orchestrator = await Session.create({
            kind: "orchestrator",
            parentID: root.id,
            title: "Light dispatching Turn",
          })
          const parentMessageID = Identifier.ascending("message")
          const orchestratorMessageID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: parentMessageID,
              sessionID: orchestrator.id,
              role: "user",
              author: "user",
              time: { created: now + 1 },
              agent: "orchestrator",
              model,
            },
            parts: [],
          })
          await Session.persistMessage({
            info: {
              id: orchestratorMessageID,
              sessionID: orchestrator.id,
              parentID: parentMessageID,
              role: "assistant",
              author: "orchestrator",
              time: { created: now + 2 },
              agent: "orchestrator",
              providerID: model.providerID,
              modelID: model.modelID,
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
            },
            parts: [],
          })

          let processorStarts = 0
          let processorFinishes = 0
          let resolveAllStarted!: () => void
          let resolveAllFinished!: () => void
          const allStarted = new Promise<void>((resolve) => {
            resolveAllStarted = resolve
          })
          const allFinished = new Promise<void>((resolve) => {
            resolveAllFinished = resolve
          })
          const release = new Promise<void>((resolve) => {
            releaseWorkers = resolve
          })
          providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
          processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
            const assistant = input.assistantMessage
            return {
              message: assistant,
              partFromToolCall() {
                return undefined
              },
              async process() {
                processorStarts++
                if (processorStarts === 4) resolveAllStarted()
                await release
                await Session.updatePart({
                  id: Identifier.ascending("part"),
                  sessionID: assistant.sessionID,
                  messageID: assistant.id,
                  type: "text",
                  text: `completed ${assistant.sessionID}`,
                })
                assistant.finish = "stop"
                assistant.time.completed = Date.now()
                await Session.updateMessage(assistant)
                processorFinishes++
                if (processorFinishes === 4) resolveAllFinished()
                return "stop"
              },
            } as any
          })

          const workerTool = createDelegatedWorkerTool({
            taskID,
            agentSessionID: orchestrator.id,
            requireCurrentTaskAndAgentSessionLineage: async () => requireTask(taskID),
          }).delegated_worker
          const executors = Object.fromEntries(
            DispatchAdapterContractRegistry.ids.map((id) => [
              id,
              id === "delegated_worker"
                ? async (args: unknown, context: unknown) => workerTool.execute!(args as never, context as never)
                : async () => {
                    throw new Error(`unexpected ${id} adapter execution`)
                  },
            ]),
          ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>
          const dispatchTool = createDispatchAgentTool({
            taskID,
            projectedAgents: skillProjection.projectedAgents,
            executors,
            runDetached: async (run) => run(),
            runDetachedRecovery: async (run) => run(),
            runInWorktree: async ({ run }) => run(),
            openLineage({
              targetAgentID,
              projectedAgent,
              workScope,
              deliverySliceRevisionIDs,
              workflowBinding,
              workflowNodeID,
              adapterInput,
            }) {
              if (!workflowBinding || workflowBinding.kind !== "direct" || workflowNodeID !== null)
                throw new Error("Light dispatch must retain direct workflow authority")
              const dispatchID = Identifier.ascending("artifact")
              const origin = createDispatchLineageOrigin({
                dispatchID,
                taskID,
                orchestratorSessionID: orchestrator.id,
                orchestratorMessageID,
                toolPartID: Identifier.ascending("part"),
                toolCallID: Identifier.ascending("call"),
                targetAgentID,
                projectedWorkerIdentity: projectedAgent.identity,
                workScope,
                deliverySliceRevisionIDs,
                workflowBinding,
                workflowNodeID,
                adapterInput,
              })
              return {
                dispatchID,
                deliverySliceRevisionIDs,
                adapterInput,
                turn: {
                  kind: "initial",
                  current_dispatch_id: dispatchID,
                  workflow_binding: workflowBinding,
                  workflow_node_id: workflowNodeID,
                  workflow_occurrence_id: origin.workflowOccurrenceID!,
                  delivery_slice_revision_ids: deliverySliceRevisionIDs,
                  evidence_locators: [],
                  task_authority: {
                    task_id: taskID,
                    root_session_id: root.id,
                    request_sha256: taskRequestSHA256(taskRequest),
                    initial_control_text_parts: [],
                  },
                },
                observeSession() {},
                commitSession(sessionID: string, descriptor: WorkerTurnDescriptor.Info) {
                  expect(WorkerTurnDescriptor.get({ id: descriptor.id, sessionID })).toEqual(descriptor)
                  return { artifactID: recordDispatchLineage({ origin, childSessionID: sessionID }).artifactID }
                },
              }
            },
          })
          if (!dispatchTool.execute) throw new Error("dispatch_agent has no production executor")

          const targets = ["light-planner", "light-planner", "light-investigator", "light-investigator"] as const
          const requests = targets.map((target, index) => ({
            dispatch: {
              target,
              work_scope: { kind: "task" },
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
                use_worktree: false,
                input: {
                  goal_ids: [],
                  instruction: `Independent advisory partition ${index + 1}`,
                  reason: `Prove concurrent ${target} Session ${index + 1}`,
                },
              },
            },
          }))
          const receipts = await Promise.all(
            requests.map((request) => dispatchTool.execute!(request as never, {} as never)),
          )
          expect(receipts.map((receipt) => receipt.kind)).toEqual(["accepted", "accepted", "accepted", "accepted"])
          await requireWithin(allStarted, "four overlapping Light worker processors")
          childSessionIDs = receipts.map((receipt) => {
            if (receipt.kind !== "accepted") throw new Error(`Expected accepted dispatch, got ${receipt.kind}`)
            return receipt.session_id
          })
          expect(new Set(childSessionIDs).size).toBe(4)
          expect(processorStarts).toBe(4)
          const sessions = await Promise.all(childSessionIDs.map((sessionID) => Session.get(sessionID)))
          expect(
            sessions.map((session) => ({
              kind: session.kind,
              parentID: session.parentID,
              directory: session.directory,
            })),
          ).toEqual(
            targets.map(() => ({ kind: "delegated-worker", parentID: orchestrator.id, directory: project.path })),
          )

          const lineages = listDispatchLineage(taskID)
          dispatchIDs = lineages.map((lineage) => lineage.dispatchID)
          expect(new Set(dispatchIDs).size).toBe(4)
          expect(lineages.map((lineage) => lineage.payload.target_agent_id).sort()).toEqual([...targets].sort())
          expect(lineages.map((lineage) => lineage.payload.orchestrator_message_id)).toEqual(
            targets.map(() => orchestratorMessageID),
          )
          expect(lineages.map((lineage) => lineage.payload.workflow_binding.kind)).toEqual(targets.map(() => "direct"))
          expect(lineages.map((lineage) => lineage.payload.workflow_node_id)).toEqual(targets.map(() => null))
          expect(
            childSessionIDs
              .map((sessionID) => WorkerTurnDescriptor.latestForSession(sessionID)?.payload.identity.agentID)
              .sort(),
          ).toEqual([...targets].sort())
          expect(requests.map((request) => request.dispatch.turn.use_worktree)).toEqual([false, false, false, false])

          releaseWorkers()
          await requireWithin(allFinished, "four completed Light worker processors")
        },
      })

      await waitForDetachedDispatchPipelinesForTest()
      await waitForIngressDeliveryHooksForTest()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          expect(
            listDispatchLineage(taskID)
              .map((lineage) => lineage.dispatchID)
              .sort(),
          ).toEqual([...dispatchIDs].sort())
          for (const sessionID of childSessionIDs) {
            const descriptor = WorkerTurnDescriptor.latestForSession(sessionID)
            expect(descriptor).toBeDefined()
            expect(
              ProtocolStore.latestSessionOccurrenceEvent(
                sessionID,
                "agent.execution.lifecycle",
                descriptor!.payload.messageAuthority.user_message_id,
              ),
            ).toMatchObject({
              sessionID,
              payload: { status: { type: "terminal", reason: "completed" } },
            })
          }
        },
      })
    } finally {
      releaseWorkers?.()
      await waitForDetachedDispatchPipelinesForTest().catch(() => undefined)
      await waitForIngressDeliveryHooksForTest().catch(() => undefined)
      ingressRunnerLease?.[Symbol.dispose]()
      processorSpy?.mockRestore()
      providerSpy?.mockRestore()
    }
  }, 60_000)
})
