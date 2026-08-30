import { expect, test } from "bun:test"
import {
  analyzeExpertSquadWorkflowTopology,
  validateBuiltInExpertSquadTopologyPolicy,
  type ExpertSquadManifestV2,
} from "../src/expert-squad-authoring"

const resources = { capability_refs: [] } as const

test("workflow topology analysis reports parallel roots, a join, and deterministic waves", () => {
  const manifest: ExpertSquadManifestV2 = {
    product_pillars: ["code", "work"],
    schema_version: 2,
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
    capability_sets: {},
    capability_projection: {
      scheduler: { ...resources, base_role: "orchestrator" },
      agents: {
        researcher: { ...resources, label: "Researcher", base_role: "explore", prompt: "agents/researcher.md" },
        builder: { ...resources, label: "Builder", base_role: "build", prompt: "agents/builder.md" },
        reviewer: {
          ...resources,
          label: "Reviewer",
          base_role: "integrity",
          execution_contract: "platform_integrity_review",
          prompt: "agents/reviewer.md",
        },
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
      structure: "parallel_workers_join",
      planner_node_id: null,
      parallel_worker_node_ids: [],
    },
  ])
})

test("workflow topology analysis identifies a Planner-first parallel-worker frontier", () => {
  const manifest: ExpertSquadManifestV2 = {
    product_pillars: ["code", "work"],
    schema_version: 2,
    namespace: "builtin",
    id: "flat-example",
    name: "Flat example",
    label: "Flat example",
    version: "2026.08.13.1",
    readme: "README.md",
    selector: {
      summary: "Inspect a flat authoring example.",
      selection_guidance: "Use for the Planner-first topology contract.",
      instructions: "selector.md",
    },
    capability_sets: {},
    capability_projection: {
      scheduler: { ...resources, base_role: "orchestrator" },
      agents: {
        planner: { ...resources, label: "Planner", base_role: "delegated-worker", prompt: "agents/planner.md" },
        researcher: { ...resources, label: "Researcher", base_role: "explore", prompt: "agents/researcher.md" },
        builder: { ...resources, label: "Builder", base_role: "build", prompt: "agents/builder.md" },
        tester: { ...resources, label: "Tester", base_role: "delegated-worker", prompt: "agents/tester.md" },
      },
      virtual_workflows: {
        delivery: {
          label: "Delivery",
          description: "Plan once and execute independent workers in parallel.",
          nodes: {
            planner: { agent_id: "planner", description: "Plan.", depends_on: [] },
            research: { agent_id: "researcher", description: "Research.", depends_on: ["planner"] },
            build: { agent_id: "builder", description: "Build.", depends_on: ["planner"] },
            test: { agent_id: "tester", description: "Test.", depends_on: ["planner"] },
          },
        },
      },
    },
  }

  expect(validateBuiltInExpertSquadTopologyPolicy(manifest)).toBe(manifest)
  expect(analyzeExpertSquadWorkflowTopology(manifest)[0]).toMatchObject({
    structure: "flat_planner_parallel_workers",
    planner_node_id: "planner",
    parallel_worker_node_ids: ["build", "research", "test"],
    initial_frontier_node_ids: ["planner"],
    maximum_parallel_width: 3,
  })
})
