import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { HostAgentRegistry } from "../../src/agent/host-agent-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { configureTaskIngressRunner } from "../../src/engine/task-root-ingress-delivery"
import { requireTask } from "../../src/engine/store"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../../src/id/id"
import { MCP } from "../../src/mcp"
import { createExactOrchestratorTool } from "../../src/orchestrator/tools"
import { Instance } from "../../src/project/instance"
import { sendSchedulerMessage } from "../../src/protocol/scheduler-message"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { SessionLoop } from "../../src/session/loop"
import { SessionProcessor } from "../../src/session/processor"
import { SessionRuntimeContractStore } from "../../src/session/runtime-contract"
import { bindRuntimeToolFactories, createRuntimeToolOwner } from "../../src/session/runtime-tool-owner"
import { readTaskArtifactRef } from "../../src/task-artifact/store"
import { EngineService } from "../../src/task-api"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { canonicalDigestSource } from "../../src/util/canonical-digest"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

for (const { projected, policy } of [true, false].flatMap((projected) =>
  (["allow", "tool-switch", "session-deny", "skill-deny"] as const).map((policy) => ({ projected, policy })),
)) {
  test(`executes snapshots and exact scheduler Skills through the ${projected ? "projected" : "registry"} Core owner (${policy})`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await fs.writeFile(path.join(project.path, "sample.txt"), "verified snapshot\n")
        await Config.updateProjectPatch({ prompt_profile: { active: "base" } })
        const config = await Config.get()
        const { schedulerCapability: capability, skillProjection } =
          await PromptProfileResolver.resolveSchedulerTurnProjection({ projectDirectory: project.path, config })
        configureTaskIngressRunner(async () => {})
        const taskID = await EngineService.createTask(
          {
            requestID: `core-artifact-owner-${projected}`,
            request: "Publish the exact sample file through the current Core tool owner.",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: capability.expertSquadID,
            expectedPackageDigest: capability.packageRevision.packageDigest,
          },
          { actor: "user" },
        )
        const session = await Session.create({
          kind: "orchestrator",
          parentID: requireTask(taskID).session_id!,
          title: "Core artifact owner",
        })
        if (policy === "session-deny" || policy === "skill-deny") {
          await Session.setPermission({
            sessionID: session.id,
            permission: [
              {
                permission: "skill",
                pattern: policy === "skill-deny" ? "base-delivery-method" : "*",
                action: "deny",
              },
            ],
          })
        }
        const projectedToolIDs = capability.builtInToolIDs.filter(
          (id) => id !== "capability_search" && (projected || !["artifact_snapshot", "skill"].includes(id)),
        )
        const mcp = MCP.createScopedConnectionOwner(`core-artifact-owner-${session.id}`)
        try {
          SessionRuntimeContractStore.set(session.id, {
            identity: {
              identityKind: "projected-scheduler",
              sessionID: session.id,
              ...capability.identity,
              expertSquadID: capability.expertSquadID,
              packageRevision: capability.packageRevision,
              taskID,
              contractKind: "orchestrator-wake",
              installedAt: Date.now(),
            },
            skillProjection,
            harnessGrants: PromptProfileResolver.schedulerHarnessGrants({ taskID, capability, projectedToolIDs }),
            projectDirectory: project.path,
            includeMcpTools: false,
            system: [],
            systemMode: "complete",
            resources: {
              mcp,
              tools: createRuntimeToolOwner({
                leaves: bindRuntimeToolFactories({
                  toolIDs: projectedToolIDs,
                  kind: "projected",
                  factoryInput: (toolID) => ({ tool_id: toolID }),
                  materialize: (toolID) =>
                    createExactOrchestratorTool({
                      toolID,
                      taskID,
                      agentSessionID: session.id,
                      sendSchedulerMessage,
                      dispatchAgents: [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents],
                    }),
                }),
              }),
            },
          })
          const model = {
            id: "core-owner-contract",
            providerID: "test",
            name: "Core owner contract",
            api: { id: "core-owner-contract", npm: "@ai-sdk/anthropic" },
            options: {},
            limit: { context: 100000, input: 90000, output: 4096 },
            cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
            capabilities: {
              toolcall: true,
              attachment: false,
              reasoning: false,
              temperature: true,
              input: { text: true, image: false, audio: false, video: false },
              output: { text: true, image: false, audio: false, video: false },
            },
          } as Provider.Model
          const user = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "orchestrator",
            agent: "orchestrator",
            time: { created: Date.now() },
            model: { providerID: model.providerID, modelID: model.id },
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: user.id,
            type: "text",
            text: '@skill("base-delivery-method") Publish the exact sample file.',
            source: "user",
            kind: "user_content",
          })
          const assistant = {
            id: Identifier.ascending("message"),
            parentID: user.id,
            sessionID: session.id,
            role: "assistant" as const,
            author: "orchestrator",
            agent: "orchestrator",
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            modelID: model.id,
            providerID: model.providerID,
            time: { created: Date.now() },
          }
          const processor = SessionProcessor.create({
            assistantMessage: assistant,
            sessionID: session.id,
            model,
            abort: new AbortController().signal,
          })
          const common = {
            config,
            model,
            session: await Session.get(session.id),
            assistant,
            processor,
            agent: sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config })),
            agentID: "orchestrator",
            messages: await Session.messages({ sessionID: session.id }),
            ...(policy === "tool-switch" ? { tools: { skill: false } } : {}),
          }
          const resolved = await resolveTestCapabilityTools(common)
          expect(typeof resolved.tools.evolve_expert_squad_from_feedback?.execute).toBe("function")
          expect(resolved.occurrence.payload.permanent_provider_base_definition.provider_names)
            .toContain("evolve_expert_squad_from_feedback")
          if (policy === "allow" || policy === "skill-deny") {
            expect(resolved.occurrence.payload.permanent_provider_base_definition.provider_names).toContain("skill")
          }
          if (policy === "allow") {
            const baseDefinitionDigest =
              resolved.occurrence.payload.permanent_provider_base_definition.definition_digest
            const capabilityProjection = SessionLoop.capabilityProjectionForResolvedTools(resolved.tools)
            expect({
              revision: capabilityProjection?.revision,
              activeSkillRef: capabilityProjection?.active_refs.find((ref) => ref.local_ref === "skill"),
              activeDefinitionDigest: capabilityProjection?.active_definition_digest,
            }).toEqual({
              revision: 0,
              activeSkillRef: resolved.occurrence.ref("skill"),
              activeDefinitionDigest: canonicalDigestSource("active-provider-tool-definitions-v2", {
                base_definition_digest: baseDefinitionDigest,
                leaves: [],
              }).sha256,
            })
          }
          expect(resolved.occurrence.ref("artifact_snapshot").owner_ref).toBe(
            projected ? "runtime-projection:orchestrator" : "tool-registry",
          )
          const result = (await resolved.tools.artifact_snapshot!.execute!(
            { files: [{ path: "sample.txt", media_type: "text/plain" }] },
            { toolCallId: `call_snapshot_${projected}`, messages: [], abortSignal: new AbortController().signal },
          )) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
          await processor.completeRecoveredToolPart({
            toolCallID: `call_snapshot_${projected}`,
            toolInput: { files: [{ path: "sample.txt", media_type: "text/plain" }] },
            output: result,
          })
          const output = JSON.parse(result.output)
          expect(output.resource_count).toBe(1)
          expect(
            (await Session.messages({ sessionID: session.id }))
              .flatMap((message) => message.parts)
              .filter((part) => part.type === "tool")
              .map((part) => part.tool),
          ).toEqual(["artifact_snapshot"])
          const ref = output.locators.find((entry: { role: string }) => entry.role === "resource").locator.ref
          await fs.writeFile(path.join(project.path, "sample.txt"), "subsequent working file\n")
          expect(
            Buffer.from(
              await readTaskArtifactRef({
                projectID: Instance.project.id,
                projectDirectory: project.path,
                taskID,
                ref,
              }),
            ).toString("utf8"),
          ).toBe("verified snapshot\n")

          expect(resolved.occurrence.ref("skill").owner_ref).toBe(
            projected ? "runtime-projection:orchestrator" : "tool-registry",
          )
          if (policy !== "allow") {
            await expect(
              resolveTestCapabilityTools({
                ...common,
                messages: await Session.messages({ sessionID: session.id }),
                activeLocalRefs: ["base/shared/method"],
              }),
            ).rejects.toMatchObject({ code: "execution_not_granted" })
            return
          }
          const revealed = resolved
          const descriptor = revealed.occurrence.payload.descriptors.find(
            (entry) => entry.ref.kind === "skill" && entry.ref.local_ref === "base/shared/method",
          )
          if (descriptor?.behavior.kind !== "open_skill") throw new Error("Missing Base method behavior")
          expect(descriptor.behavior.name).toBe("base-delivery-method")
          const toolInput = { name: descriptor.behavior.name }
          for (const phase of ["revealed", "reconstructed"]) {
            const current =
              phase === "revealed"
                ? revealed
                : await resolveTestCapabilityTools({
                    ...common,
                    messages: await Session.messages({ sessionID: session.id }),
                  })
            const toolCallID = `call_scheduler_skill_${projected}_${phase}`
            expect(typeof current.tools.evolve_expert_squad_from_feedback?.execute).toBe("function")
            const loaded = (await current.tools.skill!.execute!(toolInput, {
              toolCallId: toolCallID,
              messages: [],
              abortSignal: new AbortController().signal,
            })) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
            expect(loaded.metadata).toMatchObject({ name: "base-delivery-method", agent: "orchestrator" })
            expect(loaded.output).toContain("# Base delivery method")
            await processor.completeRecoveredToolPart({ toolCallID, toolInput, output: loaded })
          }
        } finally {
          await SessionRuntimeContractStore.dispose(session.id)
          await mcp.close()
        }
      },
    })
  }, 60_000)
}
