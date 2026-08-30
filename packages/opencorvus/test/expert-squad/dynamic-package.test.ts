import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "../../src/agent/dispatch-adapter-contract"
import { WorkerTurnDescriptor } from "../../src/agent/worker-turn-descriptor"
import { Config } from "../../src/config/config"
import { EffectiveConfig } from "../../src/config/effective"
import { createDispatchLineageOrigin, listDispatchLineage } from "../../src/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "../fixture/dispatch-lineage"
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
import { createDispatchAgentsTool } from "../../src/orchestrator/dispatch-agents-tool"
import { taskRequestSHA256 } from "../../src/orchestrator/dispatch-turn-projection"
import { createDelegatedWorkerTool } from "../../src/orchestrator/delegated-worker-tool"
import { createReadAgentMessageTool } from "../../src/orchestrator/read-agent-message-tool"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { ProtocolStore } from "../../src/protocol/store"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { SessionProcessor } from "../../src/session/processor"
import { SessionStatus } from "../../src/session/status"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { allCapabilityGrants } from "./capability-grant-fixture"

const packageRoot = path.resolve(import.meta.dir, "../../../../expert-squads/builtin/dynamic")
const skillRef = "dynamic/shared/method"
const model = { providerID: "test", modelID: "dynamic-parallel-dispatch" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Dynamic Parallel Dispatch Test",
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
    api: { id: model.modelID, url: "https://dynamic-dispatch.test.invalid", npm: "@ai-sdk/anthropic" },
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

describe("Dynamic Expert Squad package", () => {
  test("loads and installs the direct-dispatch package with two reusable capability envelopes", async () => {
    const source = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(source.manifest).toMatchObject({
      namespace: "builtin",
      id: "dynamic",
      version: "2026.08.30.2",
      product_pillars: ["code", "work"],
      capability_projection: {
        agents: {
          "dynamic-generalist": { base_role: "delegated-worker" },
          "dynamic-builder": { base_role: "build" },
        },
        virtual_workflows: {},
      },
    })
    expect([...source.packageSkills.keys()]).toEqual([skillRef])
    expect(
      allCapabilityGrants(source.manifest).map((grant) => grant.packageSkillRefs),
    ).toEqual([[skillRef], [skillRef], [skillRef]])

    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const receipt = await ExpertSquadPackageManager.installPayloadPackage({
          projectDirectory: project.path,
          id: "dynamic",
          installationScope: "project",
        })
        expect(receipt).toMatchObject({
          operation: "installed",
          after: { installationScope: "project", namespace: "builtin", id: "dynamic", version: "2026.08.30.2" },
        })

        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "dynamic" },
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
        const generalist = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
          agentID: "dynamic-generalist",
        })
        const builder = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
          agentID: "dynamic-builder",
        })

        expect(scheduler.virtualWorkflows).toEqual({})
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([skillRef])
        expect(scheduler.promptOverlay).toContain("required `dispatch_agents.team` rows")
        expect(scheduler.promptOverlay).toContain("same visible streamed assistant Tool call")
        expect(scheduler.promptOverlay).toContain("`team` and `dispatches` are aligned arrays")
        expect(scheduler.promptOverlay).toContain("Immediately call `dispatch_agents` once")
        expect(scheduler.builtInToolIDs).toEqual([
          "artifact_read",
          "artifact_search",
          "artifact_select",
          "artifact_snapshot",
          "capability_search",
          "publish_interactive_artifact",
          "dispatch_agents",
          "manage_task",
          "no_action",
          "read_agent_message",
          "read_task_message",
          "skill",
        ])
        expect(scheduler.promptOverlay).toContain(
          "call `read_agent_message` once with that worker's exact Task-projected `final_message_id`",
        )
        expect({
          generalist: {
            identity: generalist.identity,
            skillRefs: generalist.productionSkills.map((entry) => entry.ref),
          },
          builder: {
            identity: builder.identity,
            skillRefs: builder.productionSkills.map((entry) => entry.ref),
          },
        }).toMatchObject({
          generalist: {
            identity: { agentID: "dynamic-generalist", baseRole: "delegated-worker" },
            skillRefs: [skillRef],
          },
          builder: {
            identity: { agentID: "dynamic-builder", baseRole: "build" },
            skillRefs: [skillRef],
          },
        })
        expect([...generalist.builtInToolIDs].sort()).toEqual([
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
          "request_orchestrator_decision",
          "send_mailbox_message",
        ].sort())
        expect(builder.builtInToolIDs).toEqual(
          expect.arrayContaining(["artifact_search", "artifact_publish", "bash", "edit", "write", "apply_patch"]),
        )
      },
    })
  }, 0)

  test("runs repeated generated members as overlapping direct-dispatch sibling Sessions", async () => {
    await using project = await memoryProject()
    const ingressRunner = {
      runner: async ({ taskID, wakeID, predecessorID }) => {
        if (!wakeID || !predecessorID) throw new Error("Dynamic lifecycle delivery lost its exact ingress identity")
        const task = requireTask(taskID)
        if (!task.session_id) throw new Error(`Task ${taskID} has no root Session`)
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: task.session_id,
          title: "Dynamic lifecycle receiver",
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
            prompt_profile: { active: "dynamic" },
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
          const taskID = Identifier.ascending("task")
          const taskRequest = "Investigate two independent surfaces and synthesize the result"
          const root = Session.prepareRootNext({
            kind: "root",
            directory: Instance.directory,
            title: "Dynamic generated team",
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
            title: "Dynamic generated team",
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
            title: "Dynamic direct dispatch",
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

          const requests = [
            {
              dispatch: {
                target: "dynamic-generalist",
                work_scope: { kind: "task" },
                turn: {
                  kind: "initial",
                  workflow_subject: { kind: "direct" },
                  use_worktree: false,
                  input: {
                    goal_ids: [],
                    instruction: "source-a: inspect evidence partition A without overlapping partition B",
                    reason: "The generated workflow makes source-a independently ready",
                  },
                },
              },
            },
            {
              dispatch: {
                target: "dynamic-generalist",
                work_scope: { kind: "task" },
                turn: {
                  kind: "initial",
                  workflow_subject: { kind: "direct" },
                  use_worktree: false,
                  input: {
                    goal_ids: [],
                    instruction: "source-b: inspect evidence partition B without overlapping partition A",
                    reason: "The generated workflow makes source-b independently ready",
                  },
                },
              },
            },
          ]
          const frontierInput = {
            team: [
              {
                name: "source-a",
                target: "dynamic-generalist",
                responsibility: "Inspect evidence partition A",
                boundary: "Read only partition A and do not overlap partition B",
                expected_result: "Return cited findings from partition A",
                depends_on: [],
              },
              {
                name: "source-b",
                target: "dynamic-generalist",
                responsibility: "Inspect evidence partition B",
                boundary: "Read only partition B and do not overlap partition A",
                expected_result: "Return cited findings from partition B",
                depends_on: [],
              },
            ],
            dispatches: requests,
          }
          const frontierPartID = Identifier.ascending("part")
          await Session.updatePart({
            id: frontierPartID,
            sessionID: orchestrator.id,
            messageID: orchestratorMessageID,
            type: "tool",
            callID: frontierPartID,
            tool: "dispatch_agents",
            state: {
              status: "running",
              input: frontierInput,
              time: { start: Date.now() },
            },
          })

          let starts = 0
          let finishes = 0
          let resolveStarted!: () => void
          let resolveFinished!: () => void
          const allStarted = new Promise<void>((resolve) => (resolveStarted = resolve))
          const allFinished = new Promise<void>((resolve) => (resolveFinished = resolve))
          const release = new Promise<void>((resolve) => (releaseWorkers = resolve))
          providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
          processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
            const assistant = input.assistantMessage
            return {
              message: assistant,
              partFromToolCall() {
                return undefined
              },
              async process() {
                starts++
                if (starts === 2) resolveStarted()
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
                finishes++
                if (finishes === 2) resolveFinished()
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
              toolOptions,
            }) {
              if (!workflowBinding || workflowBinding.kind !== "direct" || workflowNodeID !== null) {
                throw new Error("Dynamic dispatch must retain direct workflow authority")
              }
              const execution = (toolOptions as {
                opencorvus?: {
                  toolPartID?: unknown
                  toolCallID?: unknown
                  visibleToolName?: unknown
                  collectionMember?: { index?: unknown; count?: unknown }
                }
              } | undefined)?.opencorvus
              const toolPartID = typeof execution?.toolPartID === "string" ? execution.toolPartID : ""
              const toolCallID = typeof execution?.toolCallID === "string" ? execution.toolCallID : ""
              if (!toolPartID || !toolCallID) {
                throw new Error(`Dynamic dispatch ${targetAgentID} lost its visible Tool Part authority`)
              }
              if (
                execution?.visibleToolName !== "dispatch_agents" ||
                !Number.isInteger(execution.collectionMember?.index) ||
                !Number.isInteger(execution.collectionMember?.count)
              ) {
                throw new Error(`Dynamic dispatch ${targetAgentID} lost its collection member authority`)
              }
              const dispatchID = Identifier.ascending("artifact")
              const origin = createDispatchLineageOrigin({
                dispatchID,
                taskID,
                orchestratorSessionID: orchestrator.id,
                orchestratorMessageID,
                toolPartID,
                toolCallID,
                toolName: "dispatch_agents",
                collectionMemberIndex: execution.collectionMember!.index as number,
                collectionMemberCount: execution.collectionMember!.count as number,
                targetAgentID,
                projectedWorkerIdentity: projectedAgent.identity,
                workScope,
                deliverySliceRevisionIDs,
                workflowBinding,
                workflowNodeID,
                adapterInput,
              })
              const childSessionID = Identifier.deterministic("session", `dynamic-frontier\0${origin.dispatchID}`)
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
                  if (sessionID !== childSessionID) throw new Error("Dynamic dispatch Session identity drift")
                  return { artifactID: lineage.artifactID }
                },
                releaseAdmission() {},
              }
            },
          })
          if (!dispatchTool.execute) throw new Error("dispatch_agent has no production executor")
          const frontierTool = createDispatchAgentsTool(dispatchTool)
          if (!frontierTool.execute) throw new Error("dispatch_agents has no production executor")
          const frontierResult = (await frontierTool.execute(frontierInput as never, {
            toolCallId: frontierPartID,
            opencorvus: {
              sessionID: orchestrator.id,
              messageID: orchestratorMessageID,
              toolCallID: frontierPartID,
              toolPartID: frontierPartID,
              visibleToolName: "dispatch_agents",
            },
          } as never)) as { output: string; title: string; metadata: { members: any[] } }
          await Session.updatePart({
            id: frontierPartID,
            sessionID: orchestrator.id,
            messageID: orchestratorMessageID,
            type: "tool",
            callID: frontierPartID,
            tool: "dispatch_agents",
            state: {
              status: "completed",
              input: frontierInput,
              output: frontierResult.output,
              title: frontierResult.title,
              metadata: frontierResult.metadata,
              time: { start: now + 3, end: Date.now() },
            },
          })
          const receipts = frontierResult.metadata.members.map((member) => member.outcome)
          for (const receipt of receipts) {
            if (receipt.kind !== "accepted") {
              throw new Error(`Expected accepted Dynamic dispatch, got ${JSON.stringify(receipt)}`)
            }
          }
          expect(receipts.map((receipt) => receipt.kind)).toEqual(["accepted", "accepted"])
          expect(await MessageStore.parts(orchestratorMessageID)).toMatchObject([
            {
              id: frontierPartID,
              messageID: orchestratorMessageID,
              type: "tool",
              callID: frontierPartID,
              tool: "dispatch_agents",
              state: { status: "completed", input: frontierInput },
            },
          ])
          await requireWithin(allStarted, "two overlapping Dynamic members")
          const childSessionIDs = receipts.map((receipt) => {
            if (receipt.kind !== "accepted") throw new Error(`Expected accepted dispatch, got ${receipt.kind}`)
            return receipt.session_id
          })
          expect(new Set(childSessionIDs).size).toBe(2)
          expect(
            (await Promise.all(childSessionIDs.map((sessionID) => Session.get(sessionID)))).map((session) => ({
              kind: session.kind,
              parentID: session.parentID,
              directory: session.directory,
            })),
          ).toEqual([
            { kind: "delegated-worker", parentID: orchestrator.id, directory: project.path },
            { kind: "delegated-worker", parentID: orchestrator.id, directory: project.path },
          ])
          releaseWorkers()
          await requireWithin(allFinished, "two completed Dynamic members")
          const lineages = listDispatchLineage(taskID)
          expect(new Set(lineages.map((lineage) => lineage.dispatchID)).size).toBe(2)
          expect(lineages.map((lineage) => lineage.payload.target_agent_id).sort()).toEqual([
            "dynamic-generalist",
            "dynamic-generalist",
          ])
          expect(lineages.map((lineage) => lineage.payload.workflow_binding.kind)).toEqual([
            "direct",
            "direct",
          ])
          expect(lineages.map((lineage) => lineage.payload.workflow_node_id)).toEqual([null, null])
          expect(lineages.map((lineage) => lineage.payload.orchestrator_message_id)).toEqual([
            orchestratorMessageID,
            orchestratorMessageID,
          ])
          expect(lineages.map((lineage) => lineage.payload.tool_part_id)).toEqual([
            frontierPartID,
            frontierPartID,
          ])
          expect(lineages.map((lineage) => lineage.payload.tool_name)).toEqual([
            "dispatch_agents",
            "dispatch_agents",
          ])
          expect(lineages.map((lineage) => lineage.payload.collection_member_index).toSorted()).toEqual([0, 1])
          expect(lineages.map((lineage) => lineage.payload.collection_member_count).toSorted()).toEqual([2, 2])
          expect(
            childSessionIDs.map(
              (sessionID) => WorkerTurnDescriptor.latestForSession(sessionID)?.payload.identity.agentID,
            ),
          ).toEqual(["dynamic-generalist", "dynamic-generalist"])

          await requireWithin(waitForDetachedDispatchPipelinesForTest(), "detached Dynamic dispatch pipelines")
          await requireWithin(waitForIngressDeliveryHooksForTest(), "Dynamic lifecycle ingress deliveries")
          const readAgentMessage = createReadAgentMessageTool({ taskID }).read_agent_message
          if (!readAgentMessage.execute) throw new Error("read_agent_message has no production executor")
          for (const sessionID of childSessionIDs) {
            const descriptor = WorkerTurnDescriptor.latestForSession(sessionID)
            expect(descriptor).toBeDefined()
            const finalMessage = (await Session.messages({ sessionID }))
              .filter((message) => message.info.role === "assistant")
              .at(-1)
            if (!finalMessage) throw new Error(`Dynamic worker ${sessionID} has no final assistant Message`)
            const exactMessage = await readAgentMessage.execute(
              { message_id: finalMessage.info.id },
              {
                toolCallId: Identifier.ascending("call"),
                messages: [],
                abortSignal: new AbortController().signal,
              },
            )
            expect(JSON.parse(String(exactMessage))).toMatchObject({
              session_id: sessionID,
              message_id: finalMessage.info.id,
              role: "assistant",
              author: "dynamic-generalist",
              text: [`completed ${sessionID}`],
            })
            expect(
              ProtocolStore.latestSessionOccurrenceEvent(
                sessionID,
                "agent.execution.lifecycle",
                descriptor!.payload.messageAuthority.user_message_id,
              ),
            ).toMatchObject({
              sessionID,
              payload: {
                status: {
                  type: "terminal",
                  reason: "completed",
                  final_message_id: finalMessage.info.id,
                },
              },
            })
          }

          const foreignTaskID = Identifier.ascending("task")
          const foreignRoot = Session.prepareRootNext({
            kind: "root",
            directory: Instance.directory,
            title: "Foreign Dynamic Task",
          })
          const foreignNow = Date.now()
          persistEstablishedTask({
            taskID: foreignTaskID,
            rootSession: foreignRoot,
            now: foreignNow,
            title: "Foreign Dynamic Task",
            request: "Produce one foreign Task message",
            productPillar: "work",
            source: "test",
            priority: "normal",
            metadata: {},
            projectID: Instance.project.id,
            packageRevision,
            executionCapsuleBinding: await prepareTaskProcessBinding({
              mode: "native",
              taskID: foreignTaskID,
              projectID: Instance.project.id,
              rootDirectory: Instance.directory,
              packageRevisionSHA256: packageRevision.packageDigest,
              timeCreated: foreignNow,
            }),
          })
          const foreignWorker = await Session.create({
            kind: "delegated-worker",
            parentID: foreignRoot.id,
            title: "Foreign worker",
          })
          const foreignInputID = Identifier.ascending("message")
          const foreignFinalID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: foreignInputID,
              sessionID: foreignWorker.id,
              role: "user",
              author: "orchestrator",
              time: { created: foreignNow + 1 },
              agent: "dynamic-generalist",
              model,
            },
            parts: [],
          })
          await Session.persistMessage({
            info: {
              id: foreignFinalID,
              sessionID: foreignWorker.id,
              parentID: foreignInputID,
              role: "assistant",
              author: "dynamic-generalist",
              time: { created: foreignNow + 2, completed: foreignNow + 3 },
              agent: "dynamic-generalist",
              providerID: model.providerID,
              modelID: model.modelID,
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "stop",
            },
            parts: [],
          })
          await expect(
            readAgentMessage.execute(
              { message_id: foreignFinalID },
              {
                toolCallId: Identifier.ascending("call"),
                messages: [],
                abortSignal: new AbortController().signal,
              },
            ),
          ).rejects.toThrow(`Message ${foreignFinalID} does not belong to Task ${taskID}`)
        },
      })
    } finally {
      releaseWorkers?.()
      await requireWithin(waitForDetachedDispatchPipelinesForTest(), "Dynamic cleanup dispatch pipelines").catch(
        () => undefined,
      )
      await requireWithin(waitForIngressDeliveryHooksForTest(), "Dynamic cleanup ingress deliveries").catch(
        () => undefined,
      )
      processorSpy?.mockRestore()
      providerSpy?.mockRestore()
      ingressRunnerLease?.[Symbol.dispose]()
    }
  }, 0)
})
