import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "../../src/agent/dispatch-adapter-contract"
import { WorkerTurnDescriptor } from "../../src/agent/worker-turn-descriptor"
import { BuildAgent } from "../../src/build/agent"
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
import { createBuildTool } from "../../src/orchestrator/build-tool"
import { orchestratorControlOccurrenceIdentity } from "../../src/orchestrator/control-message-identity"
import {
  createDispatchAgentTool,
  type DispatchAdapterExecutors,
  waitForDetachedDispatchPipelinesForTest,
} from "../../src/orchestrator/dispatch-agent-tool"
import { taskRequestSHA256 } from "../../src/orchestrator/dispatch-turn-projection"
import { createDelegatedWorkerTool } from "../../src/orchestrator/delegated-worker-tool"
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
      version: "2026.08.29.1",
      product_pillars: ["code", "work"],
      capability_projection: {
        agents: {
          "dynamic-generalist": { base_role: "delegated-worker", inherit_base_tools: false },
          "dynamic-builder": { base_role: "build", inherit_base_tools: true },
        },
        virtual_workflows: {},
      },
    })
    expect([...source.packageSkills.keys()]).toEqual([skillRef])
    expect(
      [
        source.manifest.capability_projection.scheduler,
        ...Object.values(source.manifest.capability_projection.agents),
      ].map((projection) => projection.package_skill_refs),
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
          after: { installationScope: "project", namespace: "builtin", id: "dynamic", version: "2026.08.29.1" },
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
        expect(scheduler.promptOverlay).toContain("one compact `Dynamic team` block")
        expect(scheduler.promptOverlay).toContain("immediately dispatch every dependency-ready member")
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
        expect(generalist.builtInToolIDs).toEqual([
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
        ])
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
    let buildAgentSpy: ReturnType<typeof spyOn> | undefined
    let builderFinalMessageID: string | undefined
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

          const initialTeamText = [
            "Dynamic team",
            "- source-a (dynamic-generalist): inspect evidence partition A; read-only; return cited findings.",
            "- source-b (dynamic-generalist): inspect evidence partition B; read-only; return cited findings.",
            "- implementation-owner (dynamic-builder): implement one disjoint bounded scaffold independent of both evidence partitions.",
          ].join("\n")
          const teamPart = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: orchestrator.id,
            messageID: orchestratorMessageID,
            type: "text",
            text: initialTeamText,
          })
          const visibleDescription = `${initialTeamText}\n\nWorkflow\nsource-a || source-b || implementation-owner`
          const streamedTeamPart = await Session.updatePart({ ...teamPart, text: visibleDescription })
          expect({ initial: teamPart.text, streamed: streamedTeamPart }).toMatchObject({
            initial: expect.stringContaining("Dynamic team"),
            streamed: { id: teamPart.id, messageID: orchestratorMessageID, text: visibleDescription },
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
            {
              dispatch: {
                target: "dynamic-builder",
                work_scope: { kind: "task" },
                turn: {
                  kind: "initial",
                  workflow_subject: { kind: "direct" },
                  use_worktree: false,
                  input: {
                    goal_ids: [],
                    request:
                      "implementation-owner: own one disjoint bounded scaffold and its checks without consuming source-a or source-b",
                    reason: "The generated workflow makes the independent Builder partition immediately ready",
                  },
                },
              },
            },
          ]
          const toolAuthorities = requests.map((request) => ({
            target: request.dispatch.target,
            partID: Identifier.ascending("part"),
            callID: Identifier.ascending("call"),
            request,
          }))
          for (const authority of toolAuthorities) {
            await Session.updatePart({
              id: authority.partID,
              sessionID: orchestrator.id,
              messageID: orchestratorMessageID,
              type: "tool",
              callID: authority.callID,
              tool: "dispatch_agent",
              state: {
                status: "running",
                input: authority.request,
                time: { start: Date.now() },
              },
            })
          }
          const authorityQueues = new Map<string, typeof toolAuthorities>()
          for (const authority of toolAuthorities) {
            const queue = authorityQueues.get(authority.target) ?? []
            queue.push(authority)
            authorityQueues.set(authority.target, queue)
          }

          let starts = 0
          let finishes = 0
          let resolveStarted!: () => void
          let resolveFinished!: () => void
          const allStarted = new Promise<void>((resolve) => (resolveStarted = resolve))
          const allFinished = new Promise<void>((resolve) => (resolveFinished = resolve))
          const release = new Promise<void>((resolve) => (releaseWorkers = resolve))
          providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
          buildAgentSpy = spyOn(BuildAgent, "run").mockImplementation(async (input: any) => {
            const child = await Session.create({
              kind: "build",
              parentID: input.parentSessionID,
              title: "Dynamic Builder production adapter",
            })
            await input.onSessionCreated?.(child.id, {})
            const inputMessage = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: child.id,
              role: "user",
              author: "orchestrator",
              time: { created: Date.now() },
              agent: "dynamic-builder",
              model,
            })
            const control = await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: child.id,
              messageID: inputMessage.id,
              type: "text",
              text: input.message.text,
            })
            const descriptor = WorkerTurnDescriptor.create({
              sessionID: child.id,
              payload: {
                identity: skillProjection.projectedAgents.find((agent) => agent.identity.agentID === "dynamic-builder")!
                  .identity,
                expertSquadID: packageRevision.id,
                packageRevision,
                model: { selection: "explicit", providerID: model.providerID, modelID: model.modelID },
                prompt: { systemMode: "complete", systemSha256: "d".repeat(64) },
                tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
                output: { format: "text", resultMode: "reply" },
                lifecycle: { taskID, workScope: input.workScope },
                messageAuthority: {
                  user_message_id: inputMessage.id,
                  control_text_parts: [{ part_id: control.id, text_sha256: taskRequestSHA256(control.text) }],
                },
                dispatchTurn: input.dispatchTurn,
              },
            })
            await input.onDispatchAuthorityCommit?.(child.id, descriptor)
            await input.onRuntimeReady?.(child.id)
            starts++
            if (starts === 3) resolveStarted()
            await release
            const finalMessage = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: child.id,
              parentID: inputMessage.id,
              role: "assistant",
              author: "dynamic-builder",
              time: { created: Date.now(), completed: Date.now() + 1 },
              agent: "dynamic-builder",
              providerID: model.providerID,
              modelID: model.modelID,
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "stop",
            })
            builderFinalMessageID = finalMessage.id
            SessionStatus.beginExecutionOccurrence(child.id, inputMessage.id)
            await SessionStatus.set(
              child.id,
              { type: "terminal", reason: "completed" },
              { taskID, inputMessageID: inputMessage.id },
            )
            finishes++
            if (finishes === 3) resolveFinished()
            return {
              sessionID: child.id,
              finalMessageID: finalMessage.id,
              terminalFactPublication: { kind: "terminal_success" },
            } as never
          })
          processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
            const assistant = input.assistantMessage
            return {
              message: assistant,
              partFromToolCall() {
                return undefined
              },
              async process() {
                starts++
                if (starts === 3) resolveStarted()
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
                if (finishes === 3) resolveFinished()
                return "stop"
              },
            } as any
          })

          const workerTool = createDelegatedWorkerTool({
            taskID,
            agentSessionID: orchestrator.id,
            requireCurrentTaskAndAgentSessionLineage: async () => requireTask(taskID),
          }).delegated_worker
          const buildTool = createBuildTool({
            inputSchema: DispatchAdapterContractRegistry.inputSchema("build"),
            taskID,
            parentSessionID: orchestrator.id,
            buildAgentContextSections: () => [],
          }).build
          const executors = Object.fromEntries(
            DispatchAdapterContractRegistry.ids.map((id) => [
              id,
              id === "delegated_worker"
                ? async (args: unknown, context: unknown) => workerTool.execute!(args as never, context as never)
                : id === "build"
                  ? async (args: unknown, context: unknown) => buildTool.execute!(args as never, context as never)
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
              if (!workflowBinding || workflowBinding.kind !== "direct" || workflowNodeID !== null) {
                throw new Error("Dynamic dispatch must retain direct workflow authority")
              }
              const authority = authorityQueues.get(targetAgentID)?.shift()
              if (!authority) throw new Error(`Dynamic dispatch ${targetAgentID} lost its visible Tool Part authority`)
              const dispatchID = Identifier.ascending("artifact")
              const origin = createDispatchLineageOrigin({
                dispatchID,
                taskID,
                orchestratorSessionID: orchestrator.id,
                orchestratorMessageID,
                toolPartID: authority.partID,
                toolCallID: authority.callID,
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
                  return { artifactID: recordDispatchLineage({ origin, childSessionID: sessionID }).artifactID }
                },
              }
            },
          })
          if (!dispatchTool.execute) throw new Error("dispatch_agent has no production executor")

          const receipts = await Promise.all(
            requests.map((request) => dispatchTool.execute!(request as never, {} as never)),
          )
          for (const receipt of receipts) {
            if (receipt.kind !== "accepted") {
              throw new Error(`Expected accepted Dynamic dispatch, got ${JSON.stringify(receipt)}`)
            }
          }
          expect(receipts.map((receipt) => receipt.kind)).toEqual(["accepted", "accepted", "accepted"])
          for (const [index, authority] of toolAuthorities.entries()) {
            await Session.updatePart({
              id: authority.partID,
              sessionID: orchestrator.id,
              messageID: orchestratorMessageID,
              type: "tool",
              callID: authority.callID,
              tool: "dispatch_agent",
              state: {
                status: "completed",
                input: authority.request,
                output: JSON.stringify(receipts[index]),
                title: `Dispatched ${authority.target}`,
                metadata: { target: authority.target },
                time: { start: now + 3 + index, end: Date.now() },
              },
            })
          }
          const persistedOrchestratorMessage = await MessageStore.get({
            sessionID: orchestrator.id,
            messageID: orchestratorMessageID,
          })
          await Session.updateMessage({
            ...persistedOrchestratorMessage.info,
            time: { created: now + 2, completed: Date.now() },
            finish: "tool-calls",
          } as Message.Assistant)
          expect(await MessageStore.parts(orchestratorMessageID)).toMatchObject([
            { id: teamPart.id, messageID: orchestratorMessageID, type: "text", text: visibleDescription },
            ...toolAuthorities.map((authority) => ({
              id: authority.partID,
              messageID: orchestratorMessageID,
              type: "tool",
              callID: authority.callID,
              tool: "dispatch_agent",
              state: { status: "completed", input: authority.request },
            })),
          ])
          await requireWithin(allStarted, "three overlapping Dynamic members")
          const childSessionIDs = receipts.map((receipt) => {
            if (receipt.kind !== "accepted") throw new Error(`Expected accepted dispatch, got ${receipt.kind}`)
            return receipt.session_id
          })
          expect(new Set(childSessionIDs).size).toBe(3)
          expect(
            (await Promise.all(childSessionIDs.map((sessionID) => Session.get(sessionID)))).map((session) => ({
              kind: session.kind,
              parentID: session.parentID,
              directory: session.directory,
            })),
          ).toEqual([
            { kind: "delegated-worker", parentID: orchestrator.id, directory: project.path },
            { kind: "delegated-worker", parentID: orchestrator.id, directory: project.path },
            { kind: "build", parentID: orchestrator.id, directory: project.path },
          ])
          releaseWorkers()
          await requireWithin(allFinished, "three completed Dynamic members")
          const lineages = listDispatchLineage(taskID)
          expect(new Set(lineages.map((lineage) => lineage.dispatchID)).size).toBe(3)
          expect(lineages.map((lineage) => lineage.payload.target_agent_id).sort()).toEqual([
            "dynamic-builder",
            "dynamic-generalist",
            "dynamic-generalist",
          ])
          expect(lineages.map((lineage) => lineage.payload.workflow_binding.kind)).toEqual([
            "direct",
            "direct",
            "direct",
          ])
          expect(lineages.map((lineage) => lineage.payload.workflow_node_id)).toEqual([null, null, null])
          expect(lineages.map((lineage) => lineage.payload.orchestrator_message_id)).toEqual([
            orchestratorMessageID,
            orchestratorMessageID,
            orchestratorMessageID,
          ])
          expect(lineages.map((lineage) => lineage.payload.tool_part_id).sort()).toEqual(
            toolAuthorities.map((authority) => authority.partID).sort(),
          )
          expect(
            childSessionIDs.map(
              (sessionID) => WorkerTurnDescriptor.latestForSession(sessionID)?.payload.identity.agentID,
            ),
          ).toEqual(["dynamic-generalist", "dynamic-generalist", "dynamic-builder"])

          await requireWithin(waitForDetachedDispatchPipelinesForTest(), "detached Dynamic dispatch pipelines")
          await requireWithin(waitForIngressDeliveryHooksForTest(), "Dynamic lifecycle ingress deliveries")
          for (const sessionID of childSessionIDs) {
            const descriptor = WorkerTurnDescriptor.latestForSession(sessionID)
            expect(descriptor).toBeDefined()
            if (descriptor!.payload.identity.agentID === "dynamic-builder") {
              expect(await MessageStore.get({ sessionID, messageID: builderFinalMessageID! })).toMatchObject({
                info: {
                  id: builderFinalMessageID,
                  role: "assistant",
                  finish: "stop",
                  time: { completed: expect.any(Number) },
                },
              })
              continue
            }
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
      await requireWithin(waitForDetachedDispatchPipelinesForTest(), "Dynamic cleanup dispatch pipelines").catch(
        () => undefined,
      )
      await requireWithin(waitForIngressDeliveryHooksForTest(), "Dynamic cleanup ingress deliveries").catch(
        () => undefined,
      )
      buildAgentSpy?.mockRestore()
      processorSpy?.mockRestore()
      providerSpy?.mockRestore()
      ingressRunnerLease?.[Symbol.dispose]()
    }
  }, 0)
})
