import { describe, expect, test } from "bun:test"
import { compareCandidateIntegrity } from "../../../expert-squads/builtin/evolution-lab/lib/evolution-lab/candidate-integrity"

const digest = (seed: string) => seed.repeat(64).slice(0, 64)

const resourceSet = {
  snapshot: {
    schema_version: 2 as const,
    project_id: "project-1",
    task_id: "task-1",
    snapshot_id: "00000000-0000-4000-8000-000000000001",
    manifest_sha256: digest("a"),
  },
  tree: "package",
}

function manifest(overrides: {
  version: string
  description: string
  agentDescription: string
  nodeDescription: string
  schedulerTools: string[]
}) {
  return {
    schema_version: 1,
    namespace: "builtin",
    id: "surface-target",
    name: "Surface Target",
    label: "Surface Target",
    description: overrides.description,
    version: overrides.version,
    readme: "README.md",
    selector: { summary: "pick me", selection_guidance: "when relevant", instructions: "selector.md" },
    capability_projection: {
      scheduler: {
        base_role: "orchestrator",
        prompt: "agents/orchestrator/system.md",
        inherit_base_tools: true,
        built_in_tool_ids: overrides.schedulerTools,
      },
      agents: {
        worker: {
          label: "Worker",
          description: overrides.agentDescription,
          base_role: "delegated-worker",
          prompt: "agents/worker/system.md",
          package_tool_refs: ["surface-target/shared/run"],
        },
      },
      virtual_workflows: {
        main: {
          label: "Main",
          description: "one node",
          nodes: { worker: { agent_id: "worker", description: overrides.nodeDescription, depends_on: [] } },
        },
      },
    },
  }
}

function packageValue(input: {
  version: string
  description: string
  agentDescription: string
  nodeDescription: string
  schedulerTools: string[]
  promptDigest: string
}) {
  return {
    resource_set: resourceSet,
    package_digest: digest("b"),
    namespace: "builtin",
    id: "surface-target",
    version: input.version,
    manifest: manifest(input),
    skill_closures: [],
    files: [
      { path: "expert-squad.jsonc", sha256: digest("c"), bytes: 10, utf8_text: true },
      { path: "README.md", sha256: digest("d"), bytes: 10, utf8_text: true },
      { path: "selector.md", sha256: digest("e"), bytes: 10, utf8_text: true },
      { path: "agents/orchestrator/system.md", sha256: digest("f"), bytes: 10, utf8_text: true },
      { path: "agents/worker/system.md", sha256: input.promptDigest, bytes: 10, utf8_text: true },
      { path: "tools/run.ts", sha256: digest("9"), bytes: 10, utf8_text: true },
    ],
  }
}

const baseline = {
  version: "2026.08.17.1",
  description: "incumbent description",
  agentDescription: "incumbent agent description",
  nodeDescription: "incumbent node description",
  schedulerTools: ["read"],
  promptDigest: digest("1"),
}

describe("Evolution candidate manifest surface", () => {
  test("accepts a declared descriptive change with no other edit", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2", description: "evolved description" })
    const comparison = compareCandidateIntegrity(parent, candidate)
    expect(comparison.changed_paths).toEqual(["expert-squad.jsonc"])
  })

  test("accepts agent and workflow node descriptions evolving together with a prompt", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({
      ...baseline,
      version: "2026.08.17.2",
      agentDescription: "evolved agent description",
      nodeDescription: "evolved node description",
      promptDigest: digest("2"),
    })
    const comparison = compareCandidateIntegrity(parent, candidate)
    expect(comparison.changed_paths).toEqual(["agents/worker/system.md", "expert-squad.jsonc"])
  })

  test("rejects a capability grant change disguised as a descriptive revision", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({
      ...baseline,
      version: "2026.08.17.2",
      description: "evolved description",
      schedulerTools: ["read", "write"],
    })
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(
      /frozen capability, reference, topology, or dependency field/,
    )
  })

  test("rejects a revision that changes nothing at all", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(
      /must change at least one V1 mutable text path or declared descriptive field/,
    )
  })
})
