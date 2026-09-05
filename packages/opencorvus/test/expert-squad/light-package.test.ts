import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import { asSchema, type Tool as AITool } from "ai"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "../../src/agent/dispatch-adapter-contract"
import { DispatchOutcome } from "../../src/agent/dispatch-outcome"
import { WorkerTurnDescriptor } from "../../src/agent/worker-turn-descriptor"
import { Config } from "../../src/config/config"
import { EffectiveConfig } from "../../src/config/effective"
import { createDispatchLineageOrigin, listDispatchLineage } from "../../src/engine/dispatch-lineage"
import { DispatchSettlementTestHooks, recordDispatchSettlement } from "../../src/engine/dispatch-settlement"
import { recordTestDispatchLineage } from "../fixture/dispatch-lineage"
import { persistEstablishedTask } from "../fixture/engine-task"
import { EngineTaskRootIngressTable } from "../../src/engine/engine.sql"
import { acquireTaskRootIngressLease } from "../../src/engine/task-root-fact-store"
import { dispatchCollectionWakeDecisionInTransaction } from "../../src/engine/dispatch-delivery-disposition"
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
import { CapabilitySearchInput } from "../../src/capability/descriptor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { allCapabilityGrants } from "./capability-grant-fixture"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

const packageRoot = path.resolve(import.meta.dir, "../../../../expert-squads/builtin/light")
const skillRef = "light/shared/method"
function authoredRevealRefs(prompt: string) {
  const blocks = [...prompt.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)]
  expect(blocks).toHaveLength(1)
  return CapabilitySearchInput.parse({ exact_refs: JSON.parse(blocks[0]![1]!) }).exact_refs
}
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
      version: "2026.09.05.1",
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
          after: { installationScope: "project", namespace: "builtin", id: "light", version: "2026.09.05.1" },
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

        expect(revision).toMatchObject({ namespace: "builtin", id: "light", version: "2026.09.05.1" })
        expect(scheduler.virtualWorkflows).toEqual({})
        expect(scheduler.builtInToolIDs).toEqual(schedulerTools)
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([])
        expect(authoredRevealRefs(scheduler.promptOverlay)).toEqual(
          ["dispatch_agents", "read_agent_message", "manage_task"].map((local_ref) => ({
            kind: "tool", source: "platform", owner_ref: "runtime-projection:orchestrator", local_ref,
          })),
        )
        expect(skillProjection.projectedAgentIDs).toEqual(Object.keys(agentRoles).sort())
        expect(scheduler.promptOverlay).toContain('reveal `read_agent_message` and `manage_task` together in one `capability_search` call')
        expect(scheduler.promptOverlay).toContain("submit the ordered list in one `read_agent_message` call")
        expect(scheduler.promptOverlay).toContain('Preserve every user-required exact output line in the `complete_task` summary after verification')

        const workers = await Promise.all(
          Object.entries(agentRoles).map(async ([agentID, expectedBaseRole]) => {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(authoredRevealRefs(worker.promptOverlay)).toEqual([
              { kind: "skill", source: "package", owner_ref: "light", local_ref: skillRef },
              { kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: "read" },
            ])
            if (agentID === "light-planner") {
              expect(worker.promptOverlay).toContain("When assigned a file or source, read it before deciding")
              expect(worker.promptOverlay).toContain("Report the actual source locator, decisive observed values and comparison")
            }
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

  test.each([false, true])("settles four overlapping Light dispatches (injected fixture failure: %s)", async (failAfterStarted) => {
    await using project = await memoryProject()
    const injectedFailure = new Error("injected Light fixture failure after worker admission")
    let processorFinishes = 0
    const collectionAdmissionObservedFinishedCounts: number[] = []
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
    let collectionAdmissionLease: Disposable | undefined
    let providerSpy: ReturnType<typeof spyOn> | undefined
    let processorSpy: ReturnType<typeof spyOn> | undefined
    let taskID = ""
    let childSessionIDs: string[] = []
    let dispatchIDs: string[] = []
    try {
      const execution = Instance.provide({
        directory: project.path,
        fn: async () => {
          // Release held workers before Instance.provide closes its activity
          // lease, including when an assertion or the start deadline rejects.
          using workerRelease = { [Symbol.dispose]: () => releaseWorkers?.() }
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
          collectionAdmissionLease = IngressTestHooks.replaceBeforeTerminalLifecycleDelivery((input) => {
            if (input.taskID === taskID) collectionAdmissionObservedFinishedCounts.push(processorFinishes)
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
                    const revealed = await resolveTestCapabilityTools(common)
                    expect(Object.keys(revealed.tools)).toEqual(["capability_search"])
                    const authoredWorker = await PromptProfileResolver.resolveWorkerCapability({
                      projectDirectory: project.path, config, packageRevision, agentID: streamInput.agentID,
                    })
                    // Use the exact installed prompt bytes, then validate them through
                    // the real frozen Catalog/Harness and materialization owner.
                    const revealInput = {
                      queries: ["light/shared/method", "read"],
                      deactivate_refs: [],
                      limit: 5,
                      exact_refs: authoredRevealRefs(authoredWorker.promptOverlay),
                    }
                    const revealID = `call_reveal_light_method_and_read_${assistant.id}`
                    const revealContext = { toolCallId: revealID, messages: [], abortSignal: input.abort }
                    const opened = await revealed.tools.capability_search!.execute!(revealInput, revealContext) as
                      Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    expect(JSON.parse(opened.output)).toMatchObject({
                      reveal_revision: 1,
                      active_refs: revealInput.exact_refs,
                    })
                    await processor.completeRecoveredToolPart({ toolCallID: revealID, toolInput: revealInput, output: opened })
                    const replayed = await revealed.tools.capability_search!.execute!(revealInput, revealContext) as
                      Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    expect(replayed.output).toBe(opened.output)
                    const skill = revealed.occurrence.payload.descriptors.find(
                      (descriptor) => descriptor.ref.kind === "skill" && descriptor.ref.local_ref === "light/shared/method",
                    )
                    if (!skill || skill.behavior.kind !== "open_skill") {
                      throw new Error("Light method has no exact Skill behavior")
                    }
                    expect(skill.behavior.name).toBe("light-advisory-method")
                    const reconstructed = await resolveTestCapabilityTools(common)
                    expect(Object.keys(reconstructed.tools).sort()).toEqual(["capability_search", "read", "skill"])
                    const loaded = await reconstructed.tools.skill!.execute!(
                      { name: skill.behavior.name },
                      { toolCallId: `call_load_light_method_${assistant.id}`, messages: [], abortSignal: input.abort },
                    ) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
                    expect(loaded.metadata.name).toBe("light-advisory-method")
                    expect(loaded.output).toContain('<skill_content name="light-advisory-method">')
                    expect(loaded.output).toContain("For every Planner and Investigator partition, an explicitly assigned source is a verification obligation")
                    expect(loaded.output).toContain("a paraphrase is not a substitute for an explicitly required line")
                    await processor.completeRecoveredToolPart({
                      toolCallID: `call_load_light_method_${assistant.id}`,
                      toolInput: { name: skill.behavior.name },
                      output: loaded,
                    })
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
          if (failAfterStarted) throw injectedFailure
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
          expect(
            Database.use((db) =>
              DispatchSettlementTestHooks.collectionGroupQueryPlan(db, lineages[0]!.artifactID),
            ).join("\n"),
          ).toContain("engine_dispatch_lineage_collection_member_idx")
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
          const collectionDecisions = Database.use((db) =>
            lineages.map((lineage) =>
              dispatchCollectionWakeDecisionInTransaction(db, {
                taskID,
                sessionID: lineage.payload.child_session_id,
                dispatchID: lineage.dispatchID,
              }),
            ),
          )
          expect(
            collectionDecisions.map((decision) =>
              decision.kind === "ready"
                ? { kind: decision.kind, delivered: decision.delivered, source: decision.source.kind }
                : { kind: decision.kind },
            ),
          ).toEqual(targets.map(() => ({ kind: "ready", delivered: true, source: "protocol_event" })))
          expect(collectionAdmissionObservedFinishedCounts).toEqual([4])
          const collectionSourceIDs = new Set(
            collectionDecisions.flatMap((decision) => (decision.kind === "ready" ? [decision.source.sourceID] : [])),
          )
          expect(collectionSourceIDs.size).toBe(1)
          expect(
            Database.use((db) =>
              db
                .select({ source: EngineTaskRootIngressTable.source, sourceID: EngineTaskRootIngressTable.source_id })
                .from(EngineTaskRootIngressTable)
                .where(eq(EngineTaskRootIngressTable.task_id, taskID))
                .all()
                .filter((ingress) => collectionSourceIDs.has(ingress.sourceID)),
            ),
          ).toEqual([{ source: "protocol_event", sourceID: [...collectionSourceIDs][0] }])
          const settled = await describeTask(taskID)
          const projected = renderTaskProjectionContext(runningProjection.baseline, settled)
          expect(applyTaskProjectionDelta(JSON.parse(projected.parts[0]!), projected.parts[1]!)).toEqual(
            JSON.parse(JSON.stringify(settled)),
          )
          const dispatches = settled.workflow_execution!.nodes.flatMap((node) => node.dispatches)
          expect(dispatches.length).toBe(4)
          const reader = createReadAgentMessageTool({ taskID }).read_agent_message
          const finalIDs: string[] = []
          for (const dispatch of dispatches) {
            expect(dispatch.settlement).toMatchObject({ outcome_kind: "terminal_success" })
            const finalID = dispatch.settlement!.final_message_id
            if (!finalID) throw new Error("Settled Light dispatch has no final report reference")
            finalIDs.push(finalID)
            expect(settled.agent_message_refs!.find((message) => message.message_id === finalID)).toMatchObject({
              session_id: dispatch.session_id,
              finish: "stop",
            })
          }
          const providerContract = asSchema(reader.inputSchema) as {
            jsonSchema: any
            validate?: (
              value: unknown,
            ) => Promise<
              { success: true; value: { message_ids: string[] } } | { success: false; error: Error }
            >
          }
          const providerSchema = providerContract.jsonSchema
          expect(providerSchema.properties.message_ids).toMatchObject({
            type: "array",
            minItems: 1,
            maxItems: 8,
            uniqueItems: true,
            items: { type: "string" },
          })
          expect(providerSchema.properties.message_ids.items.enum.toSorted()).toEqual(finalIDs.toSorted())
          expect(await providerContract.validate?.({ message_ids: finalIDs })).toEqual({
            success: true,
            value: { message_ids: finalIDs },
          })
          const rejected = await providerContract.validate?.({ message_ids: ["msg_not_a_current_settlement"] })
          expect(rejected?.success).toBe(false)
          if (rejected?.success === false) {
            expect(rejected.error.message).toContain("not current terminal dispatch settlements")
          }
          const output = JSON.parse(
            (await reader.execute!(
              { message_ids: finalIDs },
              {
                toolCallId: "read_collection_reports",
                messages: [],
              },
            )) as string,
          )
          expect(output.messages).toEqual(
            dispatches.map((dispatch, index) =>
              expect.objectContaining({
                session_id: dispatch.session_id,
                message_id: finalIDs[index],
                role: "assistant",
                author: dispatch.target_agent_id,
                finish: "stop",
                text: [`completed ${dispatch.session_id}`],
                time_completed: expect.any(Number),
              }),
            ),
          )
          for (const message of output.messages) {
            expect(message.time_completed).toBeGreaterThan(0)
            expect(message.tool_facts).toEqual(
              expect.arrayContaining([expect.objectContaining({ tool_name: "read", status: "completed" })]),
            )
          }

          const directDecisionMessageID = Identifier.ascending("message")
          const laterNow = Date.now() + 1_000
          const laterDirectLineages = lineages.slice(0, 2).map((sourceLineage, index) => {
            const laterOrigin = createDispatchLineageOrigin({
              taskID,
              orchestratorSessionID: orchestrator.id,
              orchestratorMessageID: directDecisionMessageID,
              toolPartID: Identifier.ascending("part"),
              toolCallID: Identifier.ascending("call"),
              toolName: "dispatch_agent",
              targetAgentID: sourceLineage.payload.target_agent_id,
              projectedWorkerIdentity: sourceLineage.payload.projected_worker_identity,
              workScope: sourceLineage.payload.work_scope,
              deliverySliceRevisionIDs: sourceLineage.payload.delivery_slice_revision_ids,
              workflowBinding: sourceLineage.payload.workflow_binding,
              workflowNodeID: sourceLineage.payload.workflow_node_id,
              adapterInput: sourceLineage.payload.adapter_input,
            })
            const laterLineage = recordTestDispatchLineage({
              origin: laterOrigin,
              childSessionID: sourceLineage.payload.child_session_id,
              now: laterNow + index,
            }, { completeCreatorAssistant: false })
            recordDispatchSettlement({
              taskID,
              dispatchID: laterLineage.dispatchID,
              outcome: DispatchOutcome.terminal({
                sessionID: sourceLineage.payload.child_session_id,
                finalMessageID: finalIDs[index]!,
              }),
              now: laterNow + 10 + index,
            })
            return { lineage: laterLineage, origin: laterOrigin }
          })
          for (const [index, direct] of laterDirectLineages.entries()) {
            await Session.updatePart({
              id: direct.origin.toolPartID,
              sessionID: orchestrator.id,
              messageID: directDecisionMessageID,
              type: "tool",
              callID: direct.origin.toolCallID,
              tool: "dispatch_agent",
              state: {
                status: "completed",
                input: {},
                output: JSON.stringify({ dispatchID: direct.lineage.dispatchID }),
                title: "Direct sibling dispatch",
                metadata: {},
                time: { start: laterNow + index, end: laterNow + 10 + index },
              },
            })
          }
          dispatchIDs.push(...laterDirectLineages.map(({ lineage }) => lineage.dispatchID))
          const directPlans = Database.use((db) =>
            DispatchSettlementTestHooks.directGroupQueryPlans(db, laterDirectLineages[0]!.lineage.artifactID),
          )
          expect(directPlans.requests.join("\n")).toContain("tool_part_request_message_idx (message_id=?)")
          expect(directPlans.lineages.join("\n")).toContain(
            "engine_dispatch_lineage_direct_tool_occurrence_idx (task_id=? AND <expr>=? AND <expr>=?)",
          )
          const latestGroupSchema = asSchema(createReadAgentMessageTool({ taskID }).read_agent_message.inputSchema)
            .jsonSchema as any
          expect(latestGroupSchema.properties.message_ids.items.enum).toEqual(finalIDs.slice(0, 2))
        },
      })

      if (failAfterStarted) {
        await expect(execution).rejects.toBe(injectedFailure)
        return
      }
      await execution
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
      await waitForDetachedDispatchPipelinesForTest().catch(() => undefined)
      await waitForIngressDeliveryHooksForTest().catch(() => undefined)
      ingressRunnerLease?.[Symbol.dispose]()
      collectionAdmissionLease?.[Symbol.dispose]()
      processorSpy?.mockRestore()
      providerSpy?.mockRestore()
    }
  }, 60_000)
})
