import { describe, expect, test } from "bun:test"
import { compareCandidateIntegrity } from "@squads/evolution-lab/lib/evolution-lab/candidate-integrity"

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

  // T2 stays a declared evolution surface, but only downward: a candidate may
  // drop or redistribute what its parent held and may never introduce a grant
  // the parent did not have. The upward case is covered below.
  test("accepts a capability grant change that stays inside what the parent already held", () => {
    const parent = packageValue({ ...baseline, schedulerTools: ["read", "write"] })
    const candidate = packageValue({
      ...baseline,
      version: "2026.08.17.2",
      description: "evolved description",
      schedulerTools: ["read"],
    })
    expect(compareCandidateIntegrity(parent, candidate).changed_paths).toEqual(["expert-squad.jsonc"])
  })

  test("rejects a revision that changes nothing at all", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(
      /must change at least one mutable text path or declared manifest field/,
    )
  })

  test("accepts a new agent with its own prompt file", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const agents = candidate.manifest.capability_projection.agents as Record<string, unknown>
    agents.reviewer = {
      label: "Reviewer",
      description: "added by evolution",
      base_role: "delegated-worker",
      prompt: "agents/reviewer/system.md",
    }
    candidate.files.push({ path: "agents/reviewer/system.md", sha256: digest("7"), bytes: 10, utf8_text: true })
    const comparison = compareCandidateIntegrity(parent, candidate)
    expect(comparison.changed_paths).toEqual(["agents/reviewer/system.md", "expert-squad.jsonc"])
  })

  test("rejects a manifest that names a prompt file the package does not ship", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const agents = candidate.manifest.capability_projection.agents as Record<string, unknown>
    agents.ghost = { label: "Ghost", description: "no prompt", base_role: "delegated-worker", prompt: "agents/ghost.md" }
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(
      /agent ghost prompt names missing package file agents\/ghost\.md/,
    )
  })

  test("rejects a workflow node that depends on an undeclared node", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const workflows = candidate.manifest.capability_projection.virtual_workflows as Record<string, any>
    workflows.main.nodes.worker.depends_on = ["absent"]
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(/depends on undeclared node absent/)
  })

  test("rejects a dependency cycle, which would deadlock dispatch", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const workflows = candidate.manifest.capability_projection.virtual_workflows as Record<string, any>
    workflows.main.nodes.second = { agent_id: "worker", description: "second", depends_on: ["worker"] }
    workflows.main.nodes.worker.depends_on = ["second"]
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(/dependency cycle/)
  })

  test("rejects a candidate that grants itself a built-in Tool the parent never held", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2", schedulerTools: ["read", "bash"] })
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(
      /Candidate grants built_in_tool_ids .*received: \["bash"\], expected: a subset of \["read"\]/,
    )
  })

  test("rejects a newly added agent that grants itself a package Tool the parent never held", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const agents = candidate.manifest.capability_projection.agents as Record<string, unknown>
    agents.reviewer = {
      label: "Reviewer",
      description: "added by evolution",
      base_role: "delegated-worker",
      prompt: "agents/reviewer/system.md",
      package_tool_refs: ["surface-target/shared/escalate"],
    }
    candidate.files.push({ path: "agents/reviewer/system.md", sha256: digest("7"), bytes: 10, utf8_text: true })
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(/Candidate grants package_tool_refs/)
  })

  test("accepts a newly added agent that reuses a reference the parent already declared elsewhere", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const agents = candidate.manifest.capability_projection.agents as Record<string, unknown>
    agents.reviewer = {
      label: "Reviewer",
      description: "added by evolution",
      base_role: "delegated-worker",
      prompt: "agents/reviewer/system.md",
      package_tool_refs: ["surface-target/shared/run"],
    }
    candidate.files.push({ path: "agents/reviewer/system.md", sha256: digest("7"), bytes: 10, utf8_text: true })
    expect(compareCandidateIntegrity(parent, candidate).changed_paths).toEqual([
      "agents/reviewer/system.md",
      "expert-squad.jsonc",
    ])
  })

  test("rejects moving an agent onto a base role the parent does not use", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const agents = candidate.manifest.capability_projection.agents as Record<string, any>
    agents.worker.base_role = "build"
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(/Candidate grants base_role/)
  })

  test("still refuses to touch an executable file", () => {
    const parent = packageValue(baseline)
    const candidate = packageValue({ ...baseline, version: "2026.08.17.2" })
    const runTool = candidate.files.find((file) => file.path === "tools/run.ts")!
    runTool.sha256 = digest("8")
    expect(() => compareCandidateIntegrity(parent, candidate)).toThrow(/changed frozen file tools\/run\.ts/)
  })
})
