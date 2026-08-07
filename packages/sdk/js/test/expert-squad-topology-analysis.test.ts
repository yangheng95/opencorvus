import { expect, test } from "bun:test"
import {
  analyzeExpertSquadWorkflowTopology,
  type ExpertSquadManifestV1,
} from "../src/expert-squad-authoring"

const resources = {
  inherit_base_tools: false,
  built_in_tool_ids: [],
  default_skill_refs: [],
  package_skill_refs: [],
  default_tool_refs: [],
  package_tool_refs: [],
  default_mcp_server_refs: [],
  package_mcp_server_refs: [],
  default_mcp_tool_refs: [],
  package_mcp_tool_refs: [],
  default_mcp_prompt_refs: [],
  package_mcp_prompt_refs: [],
  default_mcp_resource_refs: [],
  package_mcp_resource_refs: [],
} as const

test("workflow topology analysis reports parallel roots, a join, and deterministic waves", () => {
  const manifest: ExpertSquadManifestV1 = {
    product_pillars: ["code", "work"],
    schema_version: 1,
    namespace: "example",
    id: "parallel-example",
    name: "Parallel example",
    label: "Parallel example",
    version: "2026.08.01.1",
    readme: "README.md",
    selector: {
      summary: "Inspect a parallel authoring example.",
      selection_guidance: "Use for the topology analysis contract.",
      instructions: "selector.md",
    },
    capability_projection: {
      scheduler: { ...resources, base_role: "orchestrator" },
      agents: {
        researcher: { ...resources, label: "Researcher", base_role: "explore", prompt: "agents/researcher.md" },
        builder: { ...resources, label: "Builder", base_role: "build", prompt: "agents/builder.md" },
        reviewer: { ...resources, label: "Reviewer", base_role: "integrity", prompt: "agents/reviewer.md" },
      },
      virtual_workflows: {
        delivery: {
          label: "Delivery",
          description: "Run independent preparation before review.",
          nodes: {
            build: { agent_id: "builder", description: "Build.", depends_on: [] },
            research: { agent_id: "researcher", description: "Research.", depends_on: [] },
            review: {
              agent_id: "reviewer",
              description: "Review both durable results.",
              depends_on: ["build", "research"],
            },
          },
        },
      },
    },
  }

  expect(analyzeExpertSquadWorkflowTopology(manifest)).toEqual([
    {
      workflow_id: "delivery",
      node_count: 3,
      initial_frontier_node_ids: ["build", "research"],
      waves: [
        { depth: 0, node_ids: ["build", "research"] },
        { depth: 1, node_ids: ["review"] },
      ],
      join_node_ids: ["review"],
      critical_path_node_count: 2,
      maximum_parallel_width: 2,
    },
  ])
})
