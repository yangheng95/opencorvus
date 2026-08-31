import type { Tool as AITool } from "ai"
import {
  bindRuntimeToolFactories,
  type RuntimeToolOwnerKind,
} from "../../src/session/runtime-tool-owner"
import { stageToolMaterializerBindingOf } from "../../src/agent/stage-tool-materializer"

export function testRuntimeToolFactories(
  tools: Readonly<Record<string, AITool>>,
  kind: RuntimeToolOwnerKind,
  owner?:
    | { workerTurnDescriptorHash: string; projectionHash: string }
    | { source: "scheduler-projection" },
) {
  return bindRuntimeToolFactories({
    toolIDs: Object.keys(tools),
    kind,
    factoryInput: (toolID) =>
      owner
        ? "source" in owner
          ? { source: owner.source, tool_id: toolID }
          : kind === "projected"
          ? {
              source: "worker-projection",
              tool_id: toolID,
              worker_turn_descriptor_hash: owner.workerTurnDescriptorHash,
              projection_hash: owner.projectionHash,
            }
          : {
              source: "worker-stage",
              tool_id: toolID,
              worker_turn_descriptor_hash: owner.workerTurnDescriptorHash,
              materializer: stageToolMaterializerBindingOf(tools[toolID] as object) ?? null,
            }
        : { source: "test-runtime-tool", tool_id: toolID },
    materialize: (toolID) => tools[toolID]!,
  })
}
