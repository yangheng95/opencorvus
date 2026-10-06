import { afterAll, expect, test } from "bun:test"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { writeExpertSquadPackage } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { PlatformCapabilitySetRegistry } from "../../src/agent/platform-capability-sets"
import { WorkerTurnDescriptor } from "../../src/agent/worker-turn-descriptor"
import { sessionRuntimeWithResolvedModel } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { createDispatchLineageOrigin } from "../../src/engine/dispatch-lineage"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { selectedWorkflowBinding } from "../../src/engine/workflow-binding"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../../src/id/id"
import { MCP } from "../../src/mcp"
import { ensureMissionSession } from "../../src/mission/session"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { SessionRuntimeContractStore } from "../../src/session/runtime-contract"
import { createRuntimeToolOwner } from "../../src/session/runtime-tool-owner"
import { ToolRegistry } from "../../src/tool/registry"
import { Tool } from "../../src/tool/tool"
import { createPanelUIRequestToolContext } from "../../src/tool/panel"
import { persistEstablishedTask } from "../fixture/engine-task"
import { recordTestDispatchLineage } from "../fixture/dispatch-lineage"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
afterAll(resetMemoryDatabase)

for (const agentID of ["mission", "researcher"]) {
  test(`projected explore worker ${agentID} queries its actual Project Tasks through resolved registry grants`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const id = "explore-query-contract"
        await writeExpertSquadPackage({
          directory: path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, "test", id),
          definition: {
            manifest: {
              schema_version: 2,
              namespace: "test",
              id,
              label: "Explore query contract",
              version: "2026.10.06.1",
              product_pillars: ["code"],
              readme: "README.md",
              selector: {
                summary: "Read Project Tasks",
                selection_guidance: "Use for the query contract",
                instructions: "selector.md",
              },
              capability_sets: {},
              capability_projection: {
                scheduler: { base_role: "orchestrator", capability_refs: [] },
                agents: {
                  [agentID]: {
                    label: "Explorer",
                    base_role: "explore",
                    prompt: `agents/${agentID}/system.md`,
                    capability_refs: [
                      CapabilityRefCodec.encode(
                        PlatformCapabilitySetRegistry.baseRef({ kind: "worker", baseRole: "explore" }),
                      ),
                    ],
                  },
                },
                virtual_workflows: {},
              },
            },
            files: {
              "README.md": "# Explore query contract\n",
              "selector.md": "Read current Project Tasks.\n",
              [`agents/${agentID}/system.md`]: "Read current Project Tasks.\n",
            },
          },
        })
        await ExpertSquadRegistry.invalidateAvailable()
        const config = Config.Info.parse({ prompt_profile: { active: id } })
        const { workerCapability: capability, skillProjection } =
          await PromptProfileResolver.resolveWorkerTurnProjection({
            projectDirectory: project.path,
            config,
            agentID,
          })
        expect(capability.identity).toMatchObject({ agentID, baseRole: "explore", sessionKind: "explore" })
        expect(capability.builtInToolIDs).toEqual(expect.arrayContaining(["panel_query_task"]))
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Project query target",
          metadata: { configOverlay: { prompt_profile: { active: id } } },
        })
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Project query target",
          request: "Read Project Tasks",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: capability.packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: capability.packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const session = await Session.create({
          kind: capability.identity.sessionKind,
          parentID: root.id,
          title: agentID,
        })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          agent: agentID,
          model: { providerID: "test", modelID: "metadata-only" },
          time: { created: now },
        })
        const instruction = "Read current Project Tasks."
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: input.id,
          type: "text",
          text: instruction,
          kind: "user_content",
        })
        const system = "Read-only explorer query contract."
        const dispatchID = Identifier.ascending("artifact")
        const workflowBinding = selectedWorkflowBinding({
          projection: { packageRevision: capability.packageRevision, virtualWorkflows: {} },
          workflowID: null,
        })
        recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: root.id,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: agentID,
            projectedWorkerIdentity: capability.identity,
            workScope: { kind: "task" },
            workflowBinding,
            workflowNodeID: null,
            adapterInput: {},
          }),
          childSessionID: session.id,
        })
        const descriptor = WorkerTurnDescriptor.persistPrepared({
          descriptor: WorkerTurnDescriptor.prepare({
            sessionID: session.id,
            payload: {
              identity: capability.identity,
              expertSquadID: capability.expertSquadID,
              packageRevision: capability.packageRevision,
              model: { selection: "explicit", providerID: "test", modelID: "metadata-only" },
              prompt: { systemMode: "complete", systemSha256: digest(system) },
              tools: { enabled: capability.builtInToolIDs, stageOwned: [], stageMaterializers: {} },
              output: { format: "text", resultMode: "reply" },
              lifecycle: { taskID, workScope: { kind: "task" } },
              messageAuthority: {
                user_message_id: input.id,
                control_text_parts: [{ part_id: part.id, text_sha256: digest(instruction) }],
              },
              dispatchTurn: {
                kind: "initial",
                current_dispatch_id: dispatchID,
                workflow_binding: workflowBinding,
                workflow_node_id: null,
                workflow_occurrence_id: dispatchID,
                delivery_slice_revision_ids: [],
                evidence_locators: [],
                task_authority: {
                  task_id: taskID,
                  root_session_id: root.id,
                  request_sha256: digest("Read Project Tasks"),
                  initial_control_text_parts: [],
                },
              },
            },
          }),
        })
        const harnessGrants = PromptProfileResolver.workerHarnessGrants({
          taskID,
          capability,
          projectedToolIDs: capability.defaultTools.map((entry) => entry.providerName),
          stageToolIDs: [],
        })
        const runtime = sessionRuntimeWithResolvedModel(capability.runtime, {
          providerID: "test",
          modelID: "metadata-only",
        })
        const leaves = await ToolRegistry.exactRuntimeTools(
          { providerID: "test", modelID: "metadata-only" },
          capability.runtime,
          agentID,
          config,
          capability.builtInToolIDs,
        )
        const query = leaves.find((leaf) => leaf.id === "panel_query_task")
        if (!query) throw new Error("Resolved explorer query leaf missing")
        expect(query.executionMode).toBe("ordinary")
        expect(query.parameters.parse({})).toEqual({})
        const emptyIDs = query.parameters.safeParse({ taskIDs: [] })
        expect(
          emptyIDs.success
            ? { data: emptyIDs.data }
            : {
                issues: emptyIDs.error.issues.map(({ code, path }) => ({ code, path })),
              },
        ).toEqual({ issues: [{ code: "too_small", path: ["taskIDs"] }] })
        // This package has no extension/stage leaves. Built-ins have one owner: Registry.
        const tools = createRuntimeToolOwner({ leaves: [] })
        const mcp = MCP.createScopedConnectionOwner(`explore-query:${session.id}`)
        SessionRuntimeContractStore.set(session.id, {
          identity: {
            identityKind: "projected-worker",
            sessionID: session.id,
            ...capability.identity,
            expertSquadID: capability.expertSquadID,
            packageRevision: capability.packageRevision,
            workerTurnDescriptorID: descriptor.id,
            workerTurnDescriptorHash: descriptor.hash,
            taskID,
            workScope: { kind: "task" },
            contractKind: "stage-attempt",
            installedAt: now,
          },
          runtime,
          skillProjection,
          projectDirectory: project.path,
          system: [system],
          systemMode: "complete",
          harnessGrants,
          resources: { mcp, tools },
        })
        try {
          const assistant = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "assistant",
            parentID: input.id,
            author: agentID,
            agent: agentID,
            providerID: "test",
            modelID: "metadata-only",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            time: { created: Date.now() },
          })
          const callID = Identifier.ascending("call")
          const request = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: assistant.id,
            type: "tool",
            tool: "panel_query_task",
            callID,
            state: { status: "running", input: {}, time: { start: Date.now() } },
          })
          const executionAuthority = await resolveSessionExecutionAuthority({
            sessionID: session.id,
            projectID: Instance.project.id,
            expected: { kind: "task", taskID },
          })
          expect({
            kind: executionAuthority.kind,
            sessionID: executionAuthority.sessionID,
            projectID: executionAuthority.projectID,
            directory: executionAuthority.directory,
          }).toEqual({
            kind: "task",
            sessionID: session.id,
            projectID: Instance.project.id,
            directory: project.path,
          })
          expect(request).toMatchObject({
            id: request.id,
            messageID: assistant.id,
            sessionID: session.id,
            type: "tool",
            tool: "panel_query_task",
            callID,
            state: { status: "running", input: {} },
          })
          const context: Tool.Context = {
            sessionID: session.id,
            messageID: assistant.id,
            agent: agentID,
            callID,
            executionAuthority,
            abort: new AbortController().signal,
            messages: [
              await MessageStore.get({ sessionID: session.id, messageID: input.id }),
              await MessageStore.get({ sessionID: session.id, messageID: assistant.id }),
            ],
            extra: { surface: "panel", projectID: Instance.project.id },
            executionSurface: Tool.executionSurface(capability.builtInToolIDs, []),
            metadata() {},
          }
          const result = await query.execute({}, context)
          expect(JSON.parse(result.output)).toEqual({
            tasks: [{ taskID, title: "Project query target", status: "active" }],
          })
          expect({ title: result.title, count: result.metadata.count }).toEqual({ title: "Tasks", count: 1 })
          const detailCallID = Identifier.ascending("call")
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: assistant.id,
            type: "tool",
            tool: "panel_query_task",
            callID: detailCallID,
            state: { status: "running", input: { taskIDs: [taskID] }, time: { start: Date.now() } },
          })
          const detail = await query.execute({ taskIDs: [taskID] }, { ...context, callID: detailCallID })
          expect(JSON.parse(detail.output)).toMatchObject({
            tasks: [{ taskID, title: "Project query target", status: "active" }],
          })
          expect(detail.title).toBe("Tasks")
          if (agentID === "mission") {
            const mission = await ensureMissionSession({
              missionID: "native-query-contract",
              defaultCwd: project.path,
              productPillar: "code",
              heldExpertSquadIDs: ["base"],
            })
            const nativeInput = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: mission.id,
              role: "user",
              author: "user",
              agent: "mission",
              model: { providerID: "test", modelID: "metadata-only" },
              time: { created: Date.now() },
            })
            const nativeAssistant = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: mission.id,
              role: "assistant",
              parentID: nativeInput.id,
              author: "mission",
              agent: "mission",
              providerID: "test",
              modelID: "metadata-only",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
              time: { created: Date.now() },
            })
            const nativeCallID = Identifier.ascending("call")
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: mission.id,
              messageID: nativeAssistant.id,
              type: "tool",
              tool: "panel_query_task",
              callID: nativeCallID,
              state: { status: "running", input: {}, time: { start: Date.now() } },
            })
            const nativeAuthority = await resolveSessionExecutionAuthority({
              sessionID: mission.id,
              projectID: Instance.project.id,
              expected: { kind: "conversation" },
            })
            const nativeContext: Tool.Context = {
              ...context,
              sessionID: mission.id,
              messageID: nativeAssistant.id,
              callID: nativeCallID,
              agent: "mission",
              executionAuthority: nativeAuthority,
              messages: [
                await MessageStore.get({ sessionID: mission.id, messageID: nativeInput.id }),
                await MessageStore.get({ sessionID: mission.id, messageID: nativeAssistant.id }),
              ],
            }
            const nativeResult = await query.execute({}, nativeContext)
            expect({
              title: nativeResult.title,
              data: JSON.parse(nativeResult.output),
              metadata: nativeResult.metadata,
            }).toEqual({
              title: "Mission Tasks",
              data: { tasks: [] },
              metadata: { truncated: false, count: 0, missionID: "native-query-contract" },
            })
            for (const agent of [undefined, "", "  "]) {
              // Reflect exercises malformed JavaScript input at the actual public boundary.
              const outcome = await Promise.resolve(
                Reflect.apply(query.execute, query, [{}, { ...nativeContext, agent }]),
              ).then(
                (value) => ({ result: value }),
                (error: unknown) =>
                  error instanceof Error ? { name: error.name, message: error.message } : { thrown: error },
              )
              expect(outcome).toEqual({
                name: "Error",
                message: "panel Session-bound execution requires an explicit nonblank agent identity.",
              })
            }
            const uiLeaves = await ToolRegistry.exactRuntimeTools(
              { providerID: "test", modelID: "metadata-only" },
              runtime,
              "panel_ui",
              config,
              ["panel_query_task"],
            )
            const uiQuery = uiLeaves.find((leaf) => leaf.id === "panel_query_task")
            if (!uiQuery) throw new Error("Server UI query registry leaf missing")
            const uiResult = await uiQuery.execute(
              {},
              createPanelUIRequestToolContext({ surface: "panel", requestID: randomUUID() }),
            )
            expect({
              title: uiResult.title,
              data: JSON.parse(uiResult.output),
              count: uiResult.metadata.count,
            }).toEqual({
              title: "Tasks",
              data: { tasks: [{ taskID, title: "Project query target", status: "active" }] },
              count: 1,
            })
          }
        } finally {
          await SessionRuntimeContractStore.dispose(session.id)
        }
      },
    })
  }, 120_000)
}
