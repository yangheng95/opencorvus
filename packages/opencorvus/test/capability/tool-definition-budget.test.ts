import { afterAll, describe, expect, test } from "bun:test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { asSchema } from "ai"
import path from "node:path"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "../../src/agent/dispatch-adapter-contract"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { normalizedProviderToolDefinition } from "../../src/capability/reveal-owner"
import { Config } from "../../src/config/config"
import { EffectiveConfig } from "../../src/config/effective"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../../src/id/id"
import { createDispatchAgentTool, type DispatchAdapterExecutors } from "../../src/orchestrator/dispatch-agent-tool"
import { createDispatchAgentsTool } from "../../src/orchestrator/dispatch-agents-tool"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { SessionLoop } from "../../src/session/loop"
import { MessageStore } from "../../src/session/message-store"
import { CapabilitySearchTool } from "../../src/tool/capability-search"
import { createAiSdkToolFromInfo } from "../../src/tool/ai-sdk-adapter"
import { createPublishInteractiveArtifactAiTool } from "../../src/tool/publish-interactive-artifact"
import { ToolRegistry } from "../../src/tool/registry"
import {
  ActivatedCapability,
  CAPABILITY_REVEAL_MAX_ACTIVE_CHARS,
  CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS,
  CAPABILITY_SEARCH_INITIAL_MAX_CHARS,
  CAPABILITY_SEARCH_INITIAL_MAX_TOKENS,
  capabilityRevealBaseDefinitions,
  foldCapabilityRevealReceipts,
  providerToolDefinitionChars,
  providerToolDefinitionDigest,
  providerToolDefinitionTokens,
  reduceCapabilityRevealCandidate,
} from "../../src/capability/reveal-receipt"
import { Token } from "../../src/util/token"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const lightPackageRoot = path.resolve(import.meta.dir, "../../../../expert-squads/builtin/light")

function providerModels(): Provider.Model[] {
  const common = {
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: true,
      temperature: false,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    options: {},
  }
  return [
    {
      ...common,
      id: "claude-light-budget",
      providerID: "anthropic",
      name: "Anthropic Light budget",
      api: { id: "claude-light-budget", npm: "@ai-sdk/anthropic" },
    },
    {
      ...common,
      id: "gpt-light-budget",
      providerID: "openai",
      name: "OpenAI strict Light budget",
      api: { id: "gpt-light-budget", npm: "@ai-sdk/openai" },
    },
  ] as Provider.Model[]
}

function fiveMemberLightFrontier() {
  const targets = ["light-planner", "light-investigator", "light-planner", "light-investigator", "light-planner"]
  return {
    team: targets.map((target, index) => ({
      name: `budget-member-${index + 1}`,
      target,
      responsibility: `Own budget partition ${index + 1}`,
      boundary: `Use only budget partition ${index + 1}`,
      expected_result: `Return budget result ${index + 1}`,
      depends_on: [],
    })),
    dispatches: targets.map((target, index) => ({
      dispatch: {
        target,
        work_scope: { kind: "task" as const },
        turn:
          index < 2
            ? {
                kind: "initial" as const,
                workflow_subject: { kind: "direct" as const },
                use_worktree: false,
                input: {
                  goal_ids: [],
                  instruction: `Inspect budget partition ${index + 1}`,
                  reason: `Verify the complete Light collection contract ${index + 1}`,
                },
              }
            : {
                kind: "continuation" as const,
                authority: {
                  kind: "prior_dispatch" as const,
                  continuation_dispatch_id: `dsp_light_budget_prior_${index + 1}`,
                },
                guidance: `Continue budget partition ${index + 1}`,
                evidence_locators: [],
              },
      },
    })),
  }
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("search-native Tool definition budgets", () => {
  test("keeps every projectable built-in leaf below the individual reveal budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const runtime = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const measurements: Array<{ id: string; chars: number; tokens: number }> = []
        for (const id of await ToolRegistry.ids()) {
          const tools = await ToolRegistry.exactRuntimeTools(
            { providerID: "opencorvus", modelID: "gpt-5.6" },
            runtime,
            "coding",
            config,
            [id],
          )
          for (const tool of tools) {
            const schema = JSON.stringify(asSchema(tool.parameters).jsonSchema ?? {})
            measurements.push({
              id: tool.id,
              chars: tool.id.length + tool.description.length + schema.length,
              tokens: Token.estimate(tool.id) + Token.estimate(tool.description) + Token.estimate(schema),
            })
          }
        }
        measurements.sort((left, right) => right.chars - left.chars)
        expect(measurements.filter((measurement) => measurement.chars > CAPABILITY_REVEAL_MAX_ACTIVE_CHARS)).toEqual([])
        const search = measurements.find((measurement) => measurement.id === "capability_search")
        expect(search).toEqual({
          id: "capability_search",
          chars: expect.any(Number),
          tokens: expect.any(Number),
        })
        expect(search!.chars).toBeLessThanOrEqual(CAPABILITY_SEARCH_INITIAL_MAX_CHARS)
        expect(search!.tokens).toBeLessThanOrEqual(CAPABILITY_SEARCH_INITIAL_MAX_TOKENS)
      },
    })
  }, 0)

  test("admits the real Light collection Tool beside capability search for Anthropic and strict OpenAI", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: lightPackageRoot,
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
        const projection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config,
          packageRevision,
        })
        const projectedAgents = [...projection.schedulerOnlyAgents, ...projection.projectedAgents]
        expect(projectedAgents.map((agent) => agent.identity.agentID).sort()).toEqual([
          "light-investigator",
          "light-planner",
          "universal-build",
        ])
        const executors = Object.fromEntries(
          DispatchAdapterContractRegistry.ids.map((id) => [
            id,
            async () => {
              throw new Error(`budget validation must not execute ${id}`)
            },
          ]),
        ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>
        const dispatchAgent = createDispatchAgentTool({
          taskID: "tsk_light_tool_budget",
          projectedAgents,
          executors,
          runDetached: async (run) => run(),
          runDetachedRecovery: async (run) => run(),
          runInWorktree: async ({ run }) => run(),
          openLineage() {
            throw new Error("budget validation stops before lineage creation")
          },
        })
        const dispatchAgents = createDispatchAgentsTool(dispatchAgent)
        const capabilitySearch = await createAiSdkToolFromInfo({
          info: CapabilitySearchTool,
          agent: "orchestrator",
          taskID: "tsk_light_tool_budget",
        })
        const collectionInput = fiveMemberLightFrontier()
        expect(collectionInput.dispatches.map((member) => member.dispatch.turn.kind)).toEqual([
          "initial",
          "initial",
          "continuation",
          "continuation",
          "continuation",
        ])
        const measurements: Array<{ provider: string; chars: number; tokens: number }> = []
        for (const model of providerModels()) {
          const preparedSearch = SessionLoop.prepareProviderTool({
            name: "capability_search",
            source: "registry",
            model,
            tool: capabilitySearch,
          })
          const preparedCollection = SessionLoop.prepareProviderTool({
            name: "dispatch_agents",
            source: "registry",
            model,
            tool: dispatchAgents,
          })
          const searchDefinition = normalizedProviderToolDefinition("capability_search", preparedSearch)
          const collectionDefinition = normalizedProviderToolDefinition("dispatch_agents", preparedCollection)
          const prior = foldCapabilityRevealReceipts({
            occurrenceID: "msg_light_tool_budget",
            parts: [],
            harnessProjectionHash: "0".repeat(64),
            catalogSnapshotRef: "artifact:light-tool-budget",
            catalogSnapshotHash: "1".repeat(64),
            baseDefinition: capabilityRevealBaseDefinitions([searchDefinition]),
          })
          const ref = capabilityRef({
            kind: "tool",
            source: "platform",
            owner_ref: "tool-registry",
            local_ref: "dispatch_agents",
          })
          const candidate = reduceCapabilityRevealCandidate({
            prior,
            deactivateRefs: [],
            activated: [
              ActivatedCapability.parse({
                requested_ref: ref,
                executable_ref: ref,
                provider_name: "dispatch_agents",
                definition: collectionDefinition,
                definition_digest: providerToolDefinitionDigest(collectionDefinition),
                payload_chars: providerToolDefinitionChars(collectionDefinition),
                payload_tokens: providerToolDefinitionTokens(collectionDefinition),
                materializer_binding_digest: "2".repeat(64),
              }),
            ],
          })
          measurements.push({
            provider: model.providerID,
            chars: candidate.payloadChars,
            tokens: candidate.payloadTokens,
          })
          expect(candidate.payloadChars).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_CHARS)
          expect(candidate.payloadTokens).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS)

          const session = await Session.create({ kind: "orchestrator", title: `${model.providerID} Light budget` })
          const user = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "orchestrator",
            model: { providerID: model.providerID, modelID: model.id },
            time: { created: Date.now() },
          })
          const assistantID = Identifier.ascending("message")
          await Session.updateMessage({
            id: assistantID,
            parentID: user.id,
            sessionID: session.id,
            role: "assistant",
            author: "orchestrator",
            agent: "orchestrator",
            providerID: model.providerID,
            modelID: model.id,
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
            time: { created: Date.now() },
          })
          const partID = Identifier.ascending("part")
          const callID = Identifier.ascending("call")
          await Session.updatePart({
            id: partID,
            sessionID: session.id,
            messageID: assistantID,
            type: "tool",
            callID,
            tool: "dispatch_agents",
            state: { status: "running", input: collectionInput, time: { start: Date.now() } },
          })
          const result = await preparedCollection.execute!(
            collectionInput as never,
            {
              toolCallId: callID,
              messages: [],
              abortSignal: new AbortController().signal,
              opencorvus: {
                sessionID: session.id,
                messageID: assistantID,
                toolCallID: callID,
                toolPartID: partID,
                visibleToolName: "dispatch_agents",
              },
            } as never,
          )
          expect((result as { metadata: { frontier_size: number } }).metadata.frontier_size).toBe(5)
          expect((await MessageStore.parts(assistantID))[0]).toMatchObject({
            id: partID,
            type: "tool",
            tool: "dispatch_agents",
          })
        }
        expect(measurements.map((entry) => entry.provider).sort()).toEqual(["anthropic", "openai"])
      },
    })
  }, 0)

  test("admits the exact interactive artifact publication leaf beside capability search", async () => {
    const capabilitySearch = await createAiSdkToolFromInfo({
      info: CapabilitySearchTool,
      agent: "mission",
      taskID: "tsk_artifact_tool_budget",
    })
    const artifactTool = createPublishInteractiveArtifactAiTool()
    const measurements: Array<{ provider: string; chars: number; tokens: number }> = []
    for (const model of providerModels()) {
      const searchDefinition = normalizedProviderToolDefinition(
        "capability_search",
        SessionLoop.prepareProviderTool({
          name: "capability_search",
          source: "registry",
          model,
          tool: capabilitySearch,
        }),
      )
      const artifactDefinition = normalizedProviderToolDefinition(
        "publish_interactive_artifact",
        SessionLoop.prepareProviderTool({
          name: "publish_interactive_artifact",
          source: "registry",
          model,
          tool: artifactTool,
        }),
      )
      const prior = foldCapabilityRevealReceipts({
        occurrenceID: "msg_artifact_tool_budget",
        parts: [],
        harnessProjectionHash: "3".repeat(64),
        catalogSnapshotRef: "artifact:interactive-artifact-tool-budget",
        catalogSnapshotHash: "4".repeat(64),
        baseDefinition: capabilityRevealBaseDefinitions([searchDefinition]),
      })
      const ref = capabilityRef({
        kind: "tool",
        source: "platform",
        owner_ref: "tool-registry",
        local_ref: "publish_interactive_artifact",
      })
      const candidate = reduceCapabilityRevealCandidate({
        prior,
        deactivateRefs: [],
        activated: [
          ActivatedCapability.parse({
            requested_ref: ref,
            executable_ref: ref,
            provider_name: "publish_interactive_artifact",
            definition: artifactDefinition,
            definition_digest: providerToolDefinitionDigest(artifactDefinition),
            payload_chars: providerToolDefinitionChars(artifactDefinition),
            payload_tokens: providerToolDefinitionTokens(artifactDefinition),
            materializer_binding_digest: "5".repeat(64),
          }),
        ],
      })
      measurements.push({
        provider: model.providerID,
        chars: candidate.payloadChars,
        tokens: candidate.payloadTokens,
      })
    }
    expect(measurements).toEqual([
      {
        provider: "anthropic",
        chars: expect.any(Number),
        tokens: expect.any(Number),
      },
      {
        provider: "openai",
        chars: expect.any(Number),
        tokens: expect.any(Number),
      },
    ])
    for (const measurement of measurements) {
      expect(measurement.chars).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_CHARS)
      expect(measurement.tokens).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS)
    }
  }, 0)
})
