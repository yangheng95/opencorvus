import { expect, test } from "bun:test"
import {
  auditDispatchedSkillCoverage,
  auditSkillEvidenceSeal,
  auditSkillProjection,
} from "../../script/benchmark/external-agent/contract"

const projection = {
  skill_name: "automationbench-api",
  mounted_agents: ["Orchestrator", "Developer", "Tester"],
  unmountable_agents: [],
}

function assistant(agent: string, sessionID: string, parts: Array<Record<string, unknown>>) {
  return {
    info: { role: "assistant", agent, sessionID },
    parts,
  }
}

function skill() {
  return {
    type: "tool",
    tool: "skill",
    state: { status: "completed", input: { name: "automationbench-api" } },
  }
}

function client(command: string) {
  return {
    type: "tool",
    tool: "bash",
    state: { status: "completed", input: { command } },
  }
}

test("runtime adherence follows the agents that use the projected benchmark client", async () => {
  const audit = await auditDispatchedSkillCoverage({
    projection,
    transcript: [
      assistant("Orchestrator", "orchestrator-session", []),
      assistant("Developer", "developer-session", [skill(), client("python automationbench_tool.py list")]),
      assistant("Tester", "tester-session", [skill(), client("python3 ./automationbench_tool.py get --id result")]),
    ] as any,
  })

  expect(audit.runtime_adherence_passed).toBe(true)
  expect(audit.dispatched_owner_sessions).toEqual([
    { agent_id: "Developer", session_id: "developer-session" },
    { agent_id: "Orchestrator", session_id: "orchestrator-session" },
    { agent_id: "Tester", session_id: "tester-session" },
  ])
  expect(audit.successful_skill_loads).toHaveLength(2)
  expect(audit.benchmark_client_attempts).toHaveLength(2)
  expect(audit.missing_skill_loads).toEqual([])
})

test("runtime adherence reports a flagged absolute-path client call before Skill loading", async () => {
  const audit = await auditDispatchedSkillCoverage({
    projection,
    transcript: [
      assistant("Developer", "developer-session", [
        client("python -u /tmp/project/automationbench_tool.py get --id result"),
      ]),
    ] as any,
  })

  expect(audit.benchmark_client_attempts).toHaveLength(1)
  expect(audit.runtime_adherence_passed).toBe(false)
  expect(audit.runtime_adherence_violations).toEqual([
    "missing_skill_load:Developer:developer-session",
    "client_before_skill_load:Developer:developer-session:0:0",
  ])
})

test("runtime adherence parses the quoted Python script position", async () => {
  const audit = await auditDispatchedSkillCoverage({
    projection,
    transcript: [
      assistant("Developer", "developer-session", [client('python -u "automationbench_tool.py" list')]),
    ] as any,
  })

  expect(audit.runtime_adherence_violations).toEqual([
    "missing_skill_load:Developer:developer-session",
    "client_before_skill_load:Developer:developer-session:0:0",
  ])
})

test("runtime adherence accepts an ordinary Python script with a benchmark path argument", async () => {
  const audit = await auditDispatchedSkillCoverage({
    projection,
    transcript: [
      assistant("Developer", "developer-session", [
        client("python inspect.py --path /tmp/project/automationbench_tool.py"),
      ]),
    ] as any,
  })

  expect(audit.runtime_adherence_passed).toBe(true)
})

test("runtime adherence finds benchmark clients in parsed Bash control structures", async () => {
  const commands = [
    "for id in 1 2; do python automationbench_tool.py list; done",
    "if true; then python automationbench_tool.py list; fi",
    "python \\\n automationbench_tool.py list",
    `python3 automationbench_tool.py batch <<'JSON'
[{"command":"search","query":"policy","top_k":5}]
JSON`,
  ]
  for (const command of commands) {
    const audit = await auditDispatchedSkillCoverage({
      projection,
      transcript: [assistant("Developer", "developer-session", [client(command)])] as any,
    })
    expect(audit.benchmark_client_attempts).toHaveLength(1)
    expect(audit.runtime_adherence_violations).toEqual([
      "missing_skill_load:Developer:developer-session",
      "client_before_skill_load:Developer:developer-session:0:0",
    ])
  }
})

test("runtime adherence reports incomplete evidence for an unparseable Bash attempt", async () => {
  const invalid = client("python automationbench_tool.py --args 'unterminated")
  invalid.state.status = "error"
  const audit = await auditDispatchedSkillCoverage({
    projection,
    transcript: [assistant("Developer", "developer-session", [invalid])] as any,
  })

  expect(audit.runtime_adherence_passed).toBe(false)
  expect(audit.unparsed_bash_commands).toEqual([
    {
      agent_id: "Developer",
      session_id: "developer-session",
      message_index: 0,
      part_index: 0,
      status: "error",
    },
  ])
  expect(audit.runtime_adherence_violations).toEqual(["bash_parse_incomplete:Developer:developer-session:0:0"])
})

test("a sealed official result keeps stable coverage while current adherence is recomputed", async () => {
  const agents = [
    { agent_id: "orchestrator", base_role: "primary", skill_mountable: true, skill_tool_available: true },
    { agent_id: "base-developer", base_role: "build", skill_mountable: true, skill_tool_available: true },
    { agent_id: "base-planner", base_role: "delegated-worker", skill_mountable: true, skill_tool_available: true },
    { agent_id: "base-tester", base_role: "delegated-worker", skill_mountable: true, skill_tool_available: true },
  ]
  const matrix = {
    active_profile: "base",
    projection_hash: "projection",
    skills: [
      {
        ref: "default/skill/automationbench-api",
        name: "automationbench-api",
        location: "/project/.opencode/skills/automationbench-api/SKILL.md",
        projection_source: "default",
      },
    ],
    agents,
    matrix: agents.map((agent) => ({
      agent_id: agent.agent_id,
      grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
    })),
  }
  const transcript = [
    assistant("orchestrator", "orchestrator-session", []),
    assistant("base-developer", "developer-session", [skill(), client("python automationbench_tool.py list")]),
  ] as any
  const projected = auditSkillProjection({ profile: "base", matrix })
  const current = await auditDispatchedSkillCoverage({ projection: projected, transcript })
  const sealed = {
    ...current,
    runtime_adherence_passed: false,
    missing_skill_loads: [{ agent_id: "orchestrator", session_id: "orchestrator-session" }],
    runtime_adherence_violations: ["missing_skill_load:orchestrator:orchestrator-session"],
  }

  const audit = await auditSkillEvidenceSeal({
    profile: "base",
    transcript,
    projectionFile: {
      profile: "base",
      matrix,
      skill: { name: "automationbench-api", projection: projected, dispatched_coverage: sealed },
    },
    resultSkill: { name: "automationbench-api", projection: projected, dispatched_coverage: sealed },
  })

  expect(audit.passed).toBe(true)
  expect(audit.coverage.runtime_adherence_passed).toBe(true)
  expect(audit.coverage.missing_skill_loads).toEqual([])
})
