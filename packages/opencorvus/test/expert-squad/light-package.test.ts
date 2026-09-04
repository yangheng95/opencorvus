import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import type { Tool as AITool } from "ai"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "../../src/agent/dispatch-adapter-contract"
import { WorkerTurnDescriptor } from "../../src/agent/worker-turn-descriptor"
import { Config } from "../../src/config/config"
import { EffectiveConfig } from "../../src/config/effective"
import { createDispatchLineageOrigin, listDispatchLineage } from "../../src/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "../fixture/dispatch-lineage"
import { persistEstablishedTask } from "../fixture/engine-task"
import { EngineTaskRootIngressTable } from "../../src/engine/engine.sql"
import { acquireTaskRootIngressLease } from "../../src/engine/task-root-fact-store"
import { currentRuntimeOccurrenceID } from "../../src/runtime/process-occurrence"
import { Database, eq } from "../../src/storage/db"
import { requireTask } from "../../src/engine/store"
import { describeTask } from "../../src/engine/describe"
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
import { applyTaskProjectionDelta, currentOrchestratorControlMessage, renderTaskProjectionContext } from "../../src/orchestrator/agent"
import { createReadAgentMessageTool } from "../../src/orchestrator/read-agent-message-tool"
import {
  createDispatchAgentTool,
  type DispatchAdapterExecutors,
  waitForDetachedDispatchPipelinesForTest,
} from "../../src/orchestrator/dispatch-agent-tool"
import { createDispatchAgentsTool } from "../../src/orchestrator/dispatch-agents-tool"
import { requireOrchestratorToolExecutionContext } from "../../src/orchestrator/tool-execution-context"
import { createOrchestratorTools } from "../../src/orchestrator/tools"
import { taskRequestSHA256 } from "../../src/orchestrator/dispatch-turn-projection"
import { createDelegatedWorkerTool } from "../../src/orchestrator/delegated-worker-tool"
import { Instance } from "../../src/project/instance"
import { ProtocolStore } from "../../src/protocol/store"
import { sendSchedulerMessage } from "../../src/protocol/scheduler-message"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { SessionLoop } from "../../src/session/loop"
import { Message } from "../../src/session/message"
import { SessionProcessor } from "../../src/session/processor"
import { SkillMount } from "../../src/skill/mounts"
import { CapabilitySearchTool } from "../../src/tool/capability-search"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { allCapabilityGrants } from "./capability-grant-fixture"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

const packageRoot = path.resolve(import.meta.dir, "../../../../expert-squads/builtin/light")
const skillRef = "light/shared/method"
const schedulerTools = [
  "capability_search",
  "dispatch_agents",
  "manage_task",
  "no_action",
  "question",
  "scheduler_message",
  "read_task_message",
  "read_agent_message",
].sort()
const agentRoles = {
  "light-investigator": "delegated-worker",
  "light-planner": "delegated-worker",
} as const
const projectedReadOnlyTools = [
  "artifact_publish",
  "artifact_read",
  "artifact_search",
  "artifact_select",
  "artifact_snapshot",
  "publish_interactive_artifact",
  "capability_search",
  "external_code_search",
  "glob",
  "read",
  "search_code",
  "skill",
  "webfetch",
  "websearch",
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
    expect(source.manifest).toMatchObject({
      namespace: "builtin",
      id: "light",
      version: "2026.09.04.2",
      product_pillars: ["code", "work"],
    })
    expect(Object.keys(source.manifest.capability_projection.agents).sort()).toEqual(Object.keys(agentRoles).sort())
    expect(source.manifest.capability_projection.virtual_workflows).toEqual({})
    expect([...source.packageSkills.keys()]).toEqual([skillRef])
    expect(allCapabilityGrants(source.manifest).map((grant) => grant.packageSkillRefs)).toEqual([
      [],
      [skillRef],
      [skillRef],
    ])
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
          after: { installationScope: "project", namespace: "builtin", id: "light", version: "2026.09.04.2" },
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

        expect(revision).toMatchObject({ namespace: "builtin", id: "light", version: "2026.09.04.2" })
        expect(scheduler.virtualWorkflows).toEqual({})
        expect(scheduler.builtInToolIDs).toEqual(schedulerTools)
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([])
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
      runner: async ({ taskID, wakeID, predecessorID, activationID }) => {
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
          activationID,
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
            installationScope: "project",
          })
          const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
            prompt_profile: { active: "light" },
          })
          const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: project.path,
            config,
          })
          const schedulerCapability = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
            packageRevision,
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
          const creatorIngress = Database.use((db) => db.select().from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, taskID)).get())
          if (!creatorIngress) throw new Error("Light fixture has no Task creation ingress")
          const activation = acquireTaskRootIngressLease({
            ingressID: creatorIngress.id,
            ownerOccurrenceID: currentRuntimeOccurrenceID(),
            now: now + 1,
            leaseMilliseconds: 120_000,
            assertControlOwnerInTransaction: () => undefined,
          })
          if (!activation.acquired) throw new Error("Light fixture could not acquire its creator ingress")
          const orchestrator = await Session.create({
            kind: "orchestrator",
            parentID: root.id,
            title: "Light dispatching Turn",
          })
          const control = currentOrchestratorControlMessage(
            { taskCreation: { taskID } }, taskID, creatorIngress.id, creatorIngress.id,
          )
          if (!control) throw new Error("Light fixture has no canonical creator control Message")
          const parentMessageID = control.messageID
          const orchestratorMessageID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: parentMessageID,
              sessionID: orchestrator.id,
              role: "user",
              author: "orchestrator",
              extra: control.extra,
              time: { created: now + 1 },
              agent: "orchestrator",
              model,
            },
            parts: [{
              id: control.partID,
              sessionID: orchestrator.id,
              messageID: parentMessageID,
              type: "text",
              text: control.text,
              kind: "control",
              source: "system",
            }],
          })
          await Session.persistMessage({
            info: {
              id: orchestratorMessageID,
              sessionID: orchestrator.id,
              parentID: parentMessageID,
              role: "assistant",
              author: "orchestrator",
              time: { created: now + 2 },
              activationID: activation.activationID,
              agent: "orchestrator",
              providerID: model.providerID,
              modelID: model.modelID,
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
            },
            parts: [],
          })

          const rawSchedulerTools = createOrchestratorTools({
            taskID,
            agentSessionID: orchestrator.id,
            sendSchedulerMessage,
            dispatchAgents: [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents],
          }).tools
          const capabilitySearch = await CapabilitySearchTool.init({ agentID: "orchestrator" })
          const projectedSchedulerTools: Record<string, AITool> = Object.fromEntries(
            schedulerCapability.builtInToolIDs.map((toolID) => [
              toolID,
              toolID === "capability_search"
                ? { description: capabilitySearch.description, inputSchema: capabilitySearch.parameters }
                : rawSchedulerTools[toolID] as AITool,
            ]),
          )
          const schedulerToolBudget = SessionLoop.estimateToolPayload(projectedSchedulerTools)
          expect({
            toolIDs: Object.keys(projectedSchedulerTools),
            withinTokenBudget: schedulerToolBudget.tokensEst <= 40_000,
          }).toEqual({
            toolIDs: schedulerTools,
            withinTokenBudget: true,
          })

          let processorStarts = 0
          let processorFinishes = 0
          const workerToolBudgets = new Map<string, ReturnType<typeof SessionLoop.estimateToolPayload>>()
          let resolveAllStarted!: () => void
          let resolveAllFinished!: () => void
          let rejectAllStarted!: (reason: unknown) => void
          const allStarted = new Promise<void>((resolve, reject) => {
            resolveAllStarted = resolve
            rejectAllStarted = reject
          })
          const allFinished = new Promise<void>((resolve) => {
            resolveAllFinished = resolve
          })
          const release = new Promise<void>((resolve) => {
            releaseWorkers = resolve
          })
          providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
          const createProcessor = SessionProcessor.create
          processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
            const assistant = input.assistantMessage
            const processor = createProcessor(input)
            return {
              ...processor,
              async process(streamInput: {
                agentID: string
                agent: Parameters<typeof SessionLoop.resolveTools>[0]["agent"]
                tools: Parameters<typeof SessionLoop.estimateToolPayload>[0]
              }) {
                try {
                  if (Object.hasOwn(agentRoles, streamInput.agentID)) {
                    workerToolBudgets.set(streamInput.agentID, SessionLoop.estimateToolPayload(streamInput.tools))
                    const common = {
                      config: await EffectiveConfig.effective({ sessionID: assistant.sessionID }),
                      model: providerModel(),
                      session: await Session.get(assistant.sessionID),
                      assistant,
                      processor,
                      agent: streamInput.agent,
                      agentID: streamInput.agentID,
                      messages: await Session.messages({ sessionID: assistant.sessionID }),
                    }
                    const revealed = await resolveTestCapabilityTools({
                      ...common,
                      activeLocalRefs: ["light/shared/method"],
                    })
                    const skill = revealed.occurrence.payload.descriptors.find(
                      (descriptor) => descriptor.ref.kind === "skill" && descriptor.ref.local_ref === "light/shared/method",
                    )
                    if (!skill || skill.behavior.kind !== "open_skill") {
                      throw new Error("Light method has no exact Skill behavior")
                    }
                    expect(skill.behavior.name).toBe("light-advisory-method")
                    const reconstructed = await resolveTestCapabilityTools(common)
                    const loaded = await reconstructed.tools.skill!.execute!(
                      { name: skill.behavior.name },
                      { toolCallId: `call_load_light_method_${assistant.id}`, messages: [], abortSignal: input.abort },
                    ) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    expect(loaded.metadata.name).toBe("light-advisory-method")
                    expect(loaded.output).toContain('<skill_content name="light-advisory-method">')
                    await processor.completeRecoveredToolPart({
                      toolCallID: `call_load_light_method_${assistant.id}`,
                      toolInput: { name: skill.behavior.name },
                      output: loaded,
                    })
                    const searchInput = {
                      queries: ["read repository file"], kinds: ["tool", "mcp_tool"],
                      next_owner_kinds: ["call_tool"], owner_refs: [], exact_refs: [], deactivate_refs: [], limit: 5,
                    }
                    const searchID = `call_find_light_read_${assistant.id}`
                    const searchContext = { toolCallId: searchID, messages: [], abortSignal: input.abort }
                    const found = await reconstructed.tools.capability_search!.execute!(searchInput, searchContext) as
                      Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    const readRef = JSON.parse(found.output).results[0].ref
                    expect(readRef).toEqual({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: "read" })
                    await processor.completeRecoveredToolPart({ toolCallID: searchID, toolInput: searchInput, output: found })
                    const replayed = await reconstructed.tools.capability_search!.execute!(searchInput, searchContext) as
                      Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    expect(replayed.output).toBe(found.output)
                    const revealInput = { ...searchInput, exact_refs: [readRef] }
                    const revealID = `call_reveal_light_read_${assistant.id}`
                    const opened = await reconstructed.tools.capability_search!.execute!(revealInput, {
                      toolCallId: revealID, messages: [], abortSignal: input.abort,
                    }) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    await processor.completeRecoveredToolPart({ toolCallID: revealID, toolInput: revealInput, output: opened })
                    const readable = await resolveTestCapabilityTools(common)
                    const filePath = path.join(project.path, `evidence-${assistant.id}.txt`)
                    const evidence = `EXACT_SOURCE=${assistant.sessionID}`
                    await Bun.write(filePath, evidence)
                    const readInput = { filePath }
                    const readID = `call_read_light_evidence_${assistant.id}`
                    const contents = await readable.tools.read!.execute!(readInput, {
                      toolCallId: readID, messages: [], abortSignal: input.abort,
                    }) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    expect(contents.output).toContain(evidence)
                    await processor.completeRecoveredToolPart({ toolCallID: readID, toolInput: readInput, output: contents })
                  }
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
                } catch (error) {
                  rejectAllStarted(error)
                  throw error
                }
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
              toolOptions,
            }) {
              if (!workflowBinding || workflowBinding.kind !== "direct" || workflowNodeID !== null)
                throw new Error("Light dispatch must retain direct workflow authority")
              const toolExecution = requireOrchestratorToolExecutionContext(toolOptions, "dispatch_agent")
              if (toolExecution.visibleToolName !== "dispatch_agents" || !toolExecution.collectionMember) {
                throw new Error("Light dispatch must be owned by one canonical collection member")
              }
              const origin = createDispatchLineageOrigin({
                taskID,
                orchestratorSessionID: toolExecution.orchestratorSessionID,
                orchestratorMessageID: toolExecution.orchestratorMessageID,
                toolPartID: toolExecution.toolPartID,
                toolCallID: toolExecution.toolCallID,
                toolName: "dispatch_agents",
                collectionMemberIndex: toolExecution.collectionMember.index,
                collectionMemberCount: toolExecution.collectionMember.count,
                targetAgentID,
                projectedWorkerIdentity: projectedAgent.identity,
                workScope,
                deliverySliceRevisionIDs,
                workflowBinding,
                workflowNodeID,
                adapterInput,
              })
              const dispatchID = origin.dispatchID
              const childSessionID = Identifier.deterministic("session", `light-dispatch\0${origin.dispatchID}`)
              const lineage = recordTestDispatchLineage({ origin, childSessionID })
              return {
                dispatchID,
                deliverySliceRevisionIDs,
                adapterInput,
                newSessionID: childSessionID,
                signal: new AbortController().signal,
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
                  if (sessionID !== childSessionID) throw new Error("Light dispatch Session identity drift")
                  return { artifactID: lineage.artifactID }
                },
                releaseAdmission() {},
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
          const collection = {
            team: targets.map((target, index) => ({
              name: `light-member-${index + 1}`,
              target,
              responsibility: `Own advisory partition ${index + 1}`,
              boundary: `Use only evidence partition ${index + 1}`,
              expected_result: `Return the complete advisory result for partition ${index + 1}`,
              depends_on: [],
            })),
            dispatches: requests,
          }
          const outerToolPartID = Identifier.ascending("part")
          const outerToolCallID = Identifier.ascending("call")
          await Session.updatePart({
            id: outerToolPartID,
            sessionID: orchestrator.id,
            messageID: orchestratorMessageID,
            type: "tool",
            callID: outerToolCallID,
            tool: "dispatch_agents",
            state: { status: "running", input: collection, time: { start: Date.now() } },
          })
          const collectionTool = createDispatchAgentsTool(dispatchTool)
          if (!collectionTool.execute) throw new Error("dispatch_agents has no production executor")
          const collectionResult = (await collectionTool.execute(
            collection as never,
            {
              toolCallId: outerToolCallID,
              opencorvus: {
                sessionID: orchestrator.id,
                messageID: orchestratorMessageID,
                toolCallID: outerToolCallID,
                toolPartID: outerToolPartID,
                visibleToolName: "dispatch_agents",
              },
            } as never,
          )) as { output: string }
          const collectionMembers = JSON.parse(collectionResult.output).members
          expect(collectionMembers).toMatchObject(targets.map((target, member_index) => ({
            member_index,
            target,
            status: "completed",
            outcome: { kind: "accepted" },
          })))
          const receipts = collectionMembers.map(
            (member: { status: string; outcome?: { kind: string; session_id?: string } }) => member.outcome,
          ) as Array<{ kind: string; session_id?: string }>
          expect(receipts.map((receipt) => receipt.kind)).toEqual(["accepted", "accepted", "accepted", "accepted"])
          await requireWithin(allStarted, "four overlapping Light worker processors")
          childSessionIDs = receipts.map((receipt) => {
            if (receipt.kind !== "accepted") throw new Error(`Expected accepted dispatch, got ${receipt.kind}`)
            if (!receipt.session_id) throw new Error("Accepted Light dispatch lost its child Session")
            return receipt.session_id
          })
          expect(new Set(childSessionIDs).size).toBe(4)
          expect(processorStarts).toBe(4)
          for (const agentID of Object.keys(agentRoles)) {
            const budget = workerToolBudgets.get(agentID)
            if (!budget) throw new Error(`Light ${agentID} final Provider Tool surface was not resolved`)
            expect(budget.chars).toBeGreaterThan(0)
            expect(budget.tokensEst).toBeGreaterThan(0)
            expect(budget.tokensEst).toBeLessThanOrEqual(50_000)
          }
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
          expect(
            lineages
              .map((lineage) => ({
                tool: lineage.payload.tool_name,
                part: lineage.payload.tool_part_id,
                call: lineage.payload.tool_call_id,
                member: lineage.payload.collection_member_index,
                count: lineage.payload.collection_member_count,
              }))
              .sort((left, right) => (left.member ?? -1) - (right.member ?? -1)),
          ).toEqual(
            targets.map((_, index) => ({
              tool: "dispatch_agents",
              part: outerToolPartID,
              call: outerToolCallID,
              member: index,
              count: targets.length,
            })),
          )
          expect(lineages.map((lineage) => lineage.payload.workflow_binding.kind)).toEqual(targets.map(() => "direct"))
          expect(lineages.map((lineage) => lineage.payload.workflow_node_id)).toEqual(targets.map(() => null))
          expect(
            childSessionIDs
              .map((sessionID) => WorkerTurnDescriptor.latestForSession(sessionID)?.payload.identity.agentID)
              .sort(),
          ).toEqual([...targets].sort())
          expect(requests.map((request) => request.dispatch.turn.use_worktree)).toEqual([false, false, false, false])

          const runningProjection = renderTaskProjectionContext(undefined, await describeTask(taskID))
          expect(runningProjection.baseline.workflow_execution?.nodes.flatMap((node) => node.dispatches)
            .map((dispatch) => dispatch.settlement)).toEqual(targets.map(() => null))

          if (!releaseWorkers) throw new Error("Light worker release callback was not initialized")
          releaseWorkers()
          await requireWithin(allFinished, "four completed Light worker processors")
          await requireWithin(waitForDetachedDispatchPipelinesForTest(), "detached Light dispatch pipelines")
          await requireWithin(waitForIngressDeliveryHooksForTest(), "Light lifecycle ingress deliveries")
          const settled = await describeTask(taskID)
          const projected = renderTaskProjectionContext(runningProjection.baseline, settled)
          expect(applyTaskProjectionDelta(JSON.parse(projected.parts[0]!), projected.parts[1]!)).toEqual(
            JSON.parse(JSON.stringify(settled)),
          )
          const dispatches = settled.workflow_execution!.nodes.flatMap((node) => node.dispatches)
          expect(dispatches.length).toBe(4)
          const reader = createReadAgentMessageTool({ taskID }).read_agent_message
          for (const dispatch of dispatches) {
            expect(dispatch.settlement).toMatchObject({ outcome_kind: "terminal_success" })
            const finalID = dispatch.settlement!.final_message_id
            if (!finalID) throw new Error("Settled Light dispatch has no final report reference")
            expect(settled.agent_message_refs!.find((message) => message.message_id === finalID)).toMatchObject({
              session_id: dispatch.session_id,
              finish: "stop",
            })
            const output = JSON.parse(await reader.execute!({ message_id: finalID }, {
              toolCallId: `read_${dispatch.dispatch_id}`,
              messages: [],
            }) as string)
            expect(output).toMatchObject({
              session_id: dispatch.session_id,
              message_id: finalID,
              finish: "stop",
              text: [`completed ${dispatch.session_id}`],
            })
            expect(output.time_completed).toBeGreaterThan(0)
          }
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
