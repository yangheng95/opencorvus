import { describe, expect, test } from "bun:test"
import { tool } from "ai"
import z from "zod"
import {
  bindRuntimeToolFactories,
  createRuntimeToolOwner,
} from "../../src/session/runtime-tool-owner"
import {
  compareDispatchStageCollectorHistory,
  createRecoveredDispatchStageToolFactory,
  DispatchStageRecoveryAuthorityError,
} from "../../src/agent/dispatch-stage-tool-factory"
import { DispatchAdapterContractRegistry } from "../../src/agent/dispatch-adapter-contract"
import { durableToolkitInputRefs } from "../../src/capability/catalog-binding"
import { canonicalDigestSource } from "../../src/util/canonical-digest"
import { compareCanonicalStrings } from "../../src/util/canonical-digest"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { createFrontendDesignOutputTools } from "../../src/frontend-design/output-tools"
import { createVisualQaOutputTools } from "../../src/visual-qa/output-tools"
import {
  createSingleSessionIntegrityToolKit,
  emptyConsensusCollector,
} from "../../src/integrity/team-agent"
import { createAgentContextToolFactory } from "../../src/agent/context-tools"
import { Instance } from "../../src/project/instance"
import { memoryProject } from "../fixture/memory"
import { PermissionAuthority } from "../../src/permission/authority"

describe("exact Runtime Tool factory owner", () => {
  test("orders keyed and legacy collector history by one canonical total order", () => {
    const legacyIDs = ["é", "a\0tail", "中", "a", "A"]
    const forward = legacyIDs
      .map((id) => ({ id }))
      .sort(compareDispatchStageCollectorHistory)
      .map((part) => part.id)
    const reversed = [...legacyIDs]
      .reverse()
      .map((id) => ({ id }))
      .sort(compareDispatchStageCollectorHistory)
      .map((part) => part.id)
    expect(forward).toEqual([...legacyIDs].sort(compareCanonicalStrings))
    expect(reversed).toEqual(forward)

    const keyed = {
      id: "z",
      orderKey: "v1:0000000000000001:0000000000000031:0000000000000000:part:z",
    }
    expect([legacyIDs[0] ? { id: legacyIDs[0] } : { id: "legacy" }, keyed].sort(compareDispatchStageCollectorHistory)[0]).toEqual(keyed)
  })

  test("materializes only the selected leaf and rebuilds only the active leaf on the next owner", async () => {
    const materialized: string[] = []
    const owner = () =>
      createRuntimeToolOwner({
        leaves: bindRuntimeToolFactories({
          toolIDs: ["alpha", "beta"],
          kind: "stage",
          factoryInput: (toolID) => ({ reducer_version: 1, tool_id: toolID }),
          materialize: (toolID) => {
            materialized.push(toolID)
            return tool({
              description: toolID,
              inputSchema: z.object({}).strict(),
              execute: async () => toolID,
            })
          },
        }),
      })

    const first = owner()
    expect((await first.exact("alpha"))?.description).toBe("alpha")
    expect(materialized).toEqual(["alpha"])

    const nextStep = owner()
    expect((await nextStep.exact("alpha"))?.description).toBe("alpha")
    expect(materialized).toEqual(["alpha", "alpha"])
  })

  test("constructs only the requested Frontend, Visual QA, and Integrity collector leaf", async () => {
    const frontendMaterialized: string[] = []
    const frontend = createFrontendDesignOutputTools(
      { mode: "greenfield_original", taskID: "task_frontend_exact" },
      (toolID) => {
        frontendMaterialized.push(toolID)
      },
    )
    expect(frontend.materializeExact("update_frontend_basics")?.description).toContain("frontend result basics")
    expect(frontendMaterialized).toEqual(["update_frontend_basics"])

    const visualMaterialized: string[] = []
    const visual = createVisualQaOutputTools({}, (toolID) => {
      visualMaterialized.push(toolID)
    })
    expect(visual.materializeExact("register_visual_qa_check_item")?.description).toContain("Visual QA check item")
    expect(visualMaterialized).toEqual(["register_visual_qa_check_item"])

    const integrityMaterialized: string[] = []
    const integrity = await createSingleSessionIntegrityToolKit({
      agentID: "integrity-exact",
      collector: emptyConsensusCollector(),
      onToolMaterialized: (toolID) => {
        integrityMaterialized.push(toolID)
      },
    })
    expect((await integrity.materializeExact("register_integrity_check_item"))?.description).toContain(
      "Integrity check item",
    )
    expect(integrityMaterialized).toEqual(["register_integrity_check_item"])
  })

  test("constructs only the requested shared context leaf", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const materialized: string[] = []
        const context = createAgentContextToolFactory(project.path, (toolID) => {
          materialized.push(toolID)
        })
        expect(context.materializeExact("read")?.description).toContain("Read the contents of a file")
        expect(materialized).toEqual(["read"])
      },
    })
  })

  test("reconstructs a non-requirements mixed adapter collector from its occurrence binding", async () => {
    const payload = {
      identity: {
        dispatchAdapterID: "visual_qa",
        dispatchAdapterABIVersion: 1,
        agentID: "visual-reviewer",
      },
      lifecycle: { taskID: "task_visual_recovery" },
      messageAuthority: { user_message_id: "message_visual_recovery" },
      tools: {
        stageMaterializers: {
          register_visual_qa_problem_dom_region: {
            input: { taskID: "task_visual_recovery", projectRoot: "C:/visual-recovery" },
          },
        },
      },
    } as any
    const toolID = "register_visual_qa_check_item"
    const reducerVersion = DispatchAdapterContractRegistry.collectorReducerVersion("visual_qa")
    const refs = durableToolkitInputRefs(payload)
    const effectfulToolID = "register_visual_qa_problem_dom_region"
    const effectfulBinding = payload.tools.stageMaterializers[effectfulToolID]
    const occurrenceBinding = {
      kind: "dispatch_stage" as const,
      adapter_id: "visual_qa",
      adapter_abi_version: 1,
      dispatch_turn_digest: canonicalDigestSource("dispatch-stage-turn-v1", null).sha256,
      effectful_tools: [
        {
          ref: capabilityRef({
            kind: "tool",
            source: "platform",
            owner_ref: "dispatch-stage:visual_qa",
            local_ref: effectfulToolID,
          }),
          materializer_binding_digest: canonicalDigestSource(
            "dispatch-stage-effectful-materializer-v1",
            effectfulBinding,
          ).sha256,
        },
      ],
      collector_tools: [
        {
          ref: capabilityRef({
            kind: "tool",
            source: "platform",
            owner_ref: "dispatch-stage:visual_qa",
            local_ref: toolID,
          }),
          reducer_version: reducerVersion,
          toolkit_input_refs: refs,
          toolkit_input_digest: canonicalDigestSource("dispatch-stage-toolkit-input-v1", {
            tool_id: toolID,
            reducer_version: reducerVersion,
            refs,
            dispatch_turn: null,
          }).sha256,
        },
      ],
    }
    const recovered = createRecoveredDispatchStageToolFactory({
      continuationRequestID: "permission_visual_recovery",
      payload,
      occurrenceBinding,
      projectDirectory: "C:/visual-recovery",
      toolDirectory: "C:/visual-recovery",
      historyParts: [],
    })
    expect((await recovered.materializeCollectorExact(toolID)).description).toContain("Visual QA check item")

    expect(() =>
      createRecoveredDispatchStageToolFactory({
        continuationRequestID: "permission_visual_recovery_mismatch",
        payload,
        occurrenceBinding: {
          ...occurrenceBinding,
          effectful_tools: [{ ...occurrenceBinding.effectful_tools[0]!, materializer_binding_digest: "0".repeat(64) }],
        },
        projectDirectory: "C:/visual-recovery",
        toolDirectory: "C:/visual-recovery",
        historyParts: [],
      }),
    ).toThrow(DispatchStageRecoveryAuthorityError)
    expect(() =>
      createRecoveredDispatchStageToolFactory({
        continuationRequestID: "permission_visual_recovery_stale",
        payload,
        occurrenceBinding: { ...occurrenceBinding, effectful_tools: [] },
        projectDirectory: "C:/visual-recovery",
        toolDirectory: "C:/visual-recovery",
        historyParts: [],
      }),
    ).toThrow(PermissionAuthority.StaleContinuationError)
  })

  test("reduces completed collector ToolParts before continuing a recovered collector", async () => {
    const payload = {
      identity: { dispatchAdapterID: "requirements", dispatchAdapterABIVersion: 1, agentID: "requirements" },
      lifecycle: { taskID: "task_requirements_reducer" },
      messageAuthority: { user_message_id: "message_requirements_reducer" },
      tools: { stageMaterializers: {} },
    } as any
    const toolID = "register_requirement"
    const reducerVersion = DispatchAdapterContractRegistry.collectorReducerVersion("requirements")
    const refs = durableToolkitInputRefs(payload)
    const occurrenceBinding = {
      kind: "dispatch_stage" as const,
      adapter_id: "requirements",
      adapter_abi_version: 1,
      dispatch_turn_digest: canonicalDigestSource("dispatch-stage-turn-v1", null).sha256,
      effectful_tools: [],
      collector_tools: [
        {
          ref: capabilityRef({
            kind: "tool",
            source: "platform",
            owner_ref: "dispatch-stage:requirements",
            local_ref: toolID,
          }),
          reducer_version: reducerVersion,
          toolkit_input_refs: refs,
          toolkit_input_digest: canonicalDigestSource("dispatch-stage-toolkit-input-v1", {
            tool_id: toolID,
            reducer_version: reducerVersion,
            refs,
            dispatch_turn: null,
          }).sha256,
        },
      ],
    }
    const firstInput = {
      id: "REQ-1",
      type: "explicit",
      description: "Persist prior collector state",
      acceptance: "The prior requirement remains present",
      non_goals: "No unrelated behavior",
      evidence_refs: [],
    }
    const recovered = createRecoveredDispatchStageToolFactory({
      continuationRequestID: "permission_requirements_reducer",
      payload,
      occurrenceBinding,
      projectDirectory: "C:/requirements-recovery",
      toolDirectory: "C:/requirements-recovery",
      historyParts: [
        {
          id: "part_requirements_history_2",
          sessionID: "session_requirements_history",
          messageID: "message_requirements_history",
          type: "tool",
          tool: toolID,
          callID: "call_requirements_history_2",
          orderKey: "v1:0000000000000002:0000000000000001:0000000000000000:part:part_requirements_history_2",
          state: {
            status: "completed",
            input: {
              ...firstInput,
              id: "REQ-2",
              description: "Persist the second prior collector state",
            },
            output: "OK: REQ-2 registered (2 total)",
            title: "register_requirement",
            metadata: {},
            time: { start: 3, end: 4 },
          },
        } as any,
        {
          id: "part_requirements_history",
          sessionID: "session_requirements_history",
          messageID: "message_requirements_history",
          type: "tool",
          tool: toolID,
          callID: "call_requirements_history",
          orderKey: "v1:0000000000000001:0000000000000001:0000000000000000:part:part_requirements_history",
          state: {
            status: "completed",
            input: firstInput,
            output: "OK: REQ-1 registered (1 total)",
            title: "register_requirement",
            metadata: {},
            time: { start: 1, end: 2 },
          },
        } as any,
      ],
    })
    const exact = await recovered.materializeCollectorExact(toolID)
    const second = await exact.execute!(
      {
        ...firstInput,
        id: "REQ-3",
        description: "Continue recovered collector state",
      },
      { toolCallId: "call_requirements_after_recovery", messages: [], abortSignal: new AbortController().signal },
    )
    expect(second).toBe("OK: REQ-3 registered (3 total)")
  })
})
