import { describe, expect, test } from "bun:test"
import {
  benchmarkActivitySignature,
  benchmarkRunKey,
  automationBenchToolConfig,
  automationBenchHarnessRequest,
  auditBenchmarkIsolation,
  summarizeProviderUsageRows,
  summarizeBenchmarkToolEvents,
  evidenceFileSetMatches,
  permanentRunInvalidation,
  auditRunBinding,
  auditSkillProjection,
  auditTaskOutcome,
  auditTerminalQuiescence,
  auditBatchEvidence,
  paperEvidenceChecks,
  normalizeTrajectory,
  renderTrajectorySVG,
  summarizeTranscriptUsage,
} from "../../script/benchmark/external-agent/contract"

describe("external agent benchmark contract", () => {
  const transcript = [
    {
      info: {
        id: "message-1",
        role: "assistant",
        agent: "base-developer",
        time: { created: 100, updated: 160 },
        tokens: { input: 10, output: 4, reasoning: 3, total: 17, cache: { read: 2, write: 1 } },
        cost: 0.01,
        billing: { status: "priced" },
      },
      parts: [
        {
          id: "tool-1",
          type: "tool",
          tool: "skill",
          state: { status: "completed", time: { start: 120, end: 130 } },
        },
      ],
    },
  ]

  test("reduces exact assistant usage into the shared token contract", () => {
    expect(summarizeTranscriptUsage(transcript)).toEqual({
      input: 10,
      output: 4,
      reasoning: 3,
      cacheRead: 2,
      cacheWrite: 1,
      total: 17,
      costUSD: 0.01,
      pricedCalls: 1,
      unpricedCalls: 0,
      assistantMessages: 1,
    })
  })

  test("recomputes the Provider aggregate from preserved per-call ledger rows", () => {
    expect(
      summarizeProviderUsageRows([
        {
          id: "usage-1",
          occurred_at: 100,
          provider_id: "openai",
          model_id: "gpt-5.6-luna",
          purpose: "session",
          input_tokens: 10,
          output_tokens: 4,
          reasoning_tokens: 3,
          cache_read_tokens: 2,
          cache_write_tokens: 1,
          total_tokens: 20,
          cost_usd: 0.01,
          billing_status: "priced",
        },
      ]),
    ).toEqual({
      input: 10,
      output: 4,
      reasoning: 3,
      cacheRead: 2,
      cacheWrite: 1,
      total: 20,
      costUSD: 0.01,
      pricedCalls: 1,
      unpricedCalls: 0,
      assistantMessages: 0,
      modelCalls: 1,
    })
  })

  test("recomputes attempted, successful, and failed benchmark calls before the sealed score event", () => {
    expect(
      summarizeBenchmarkToolEvents([
        { sequence: 1, kind: "tool", tool: "api_search" },
        { sequence: 2, kind: "tool_error", tool: "api_fetch" },
        { sequence: 3, kind: "score" },
        { sequence: 4, kind: "terminal_rejection" },
      ]),
    ).toEqual({ attempts: 2, succeeded: 1, failed: 1, scoreEvents: 1, scoreIndex: 2, sequenceValid: true })
  })

  test("changes the activity signature when benchmark world activity advances", () => {
    const base = { board: { task: { status: "active" }, artifacts: [] }, transcript, trace: [], benchmarkEventCount: 1 }
    expect(benchmarkActivitySignature({ ...base, benchmarkEventCount: 2 })).not.toBe(benchmarkActivitySignature(base))
  })

  test("assigns every run an immutable timestamp and run identity key", () => {
    expect(benchmarkRunKey(Date.UTC(2026, 7, 20, 6, 7, 8), "run-a")).toBe("2026-08-20T06-07-08.000Z-run-a")
    expect(benchmarkRunKey(Date.UTC(2026, 7, 20, 6, 7, 8), "run-b")).toBe("2026-08-20T06-07-08.000Z-run-b")
  })

  test("projects the localhost tool capability without a project-side credential", () => {
    expect(automationBenchToolConfig("/run/opencorvus-bench/case-1.sock")).toEqual({
      socket_path: "/run/opencorvus-bench/case-1.sock",
    })
  })

  test("maps the stock single-model prompt onto the uncapped OpenCorvus harness contract", () => {
    const mapped = automationBenchHarnessRequest([
      {
        role: "system",
        content:
          "Execute  the requested task. You have a budget of ~50 tool-using turns — favor parallel tool calls and avoid duplicate searches. Keep  records exact.\n  code = '  exact  '",
      },
      { role: "user", content: "  Update the simulated business state.  " },
    ])
    expect(mapped).toContain(
      "OpenCorvus is the evaluated multi-Agent harness. Tool, model, Agent, retry, and concurrent call counts are measured without a stock single-model turn budget.\n\nSYSTEM:\n",
    )
    expect(mapped).toContain("SYSTEM:\nExecute  the requested task. Keep  records exact.\n  code = '  exact  '")
    expect(mapped).toContain("USER:\n  Update the simulated business state.  ")
  })

  test("accepts a trajectory whose tools stay inside the projected benchmark capability", () => {
    expect(
      auditBenchmarkIsolation([{ parts: [{ type: "tool", output: "Used http://127.0.0.1:43123/v1/search" }] }], {
        protectedPaths: ["C:/protected/automationbench"],
        forbiddenMarkers: ["/admin/score"],
      }),
    ).toEqual({ passed: true, violations: [] })
  })

  test("detects protected Windows paths and credential leaves inside nested escaped text", () => {
    expect(
      auditBenchmarkIsolation(
        [{ parts: [{ output: JSON.stringify({ text: "C:\\protected\\automationbench\\data.py" }) }] }],
        { protectedPaths: ["C:\\protected\\automationbench"], forbiddenMarkers: [] },
      ),
    ).toEqual({ passed: false, violations: ["protected_path_1"] })
    expect(
      auditBenchmarkIsolation([{ text: "nested provider-secret-value marker" }], {
        protectedPaths: [],
        forbiddenMarkers: [],
        protectedSecrets: [{ label: "source_auth_secret_1", value: "provider-secret-value" }],
      }),
    ).toEqual({ passed: false, violations: ["protected_secret:source_auth_secret_1"] })
  })

  test("accepts a paper run only when its exact evidence checks converge", () => {
    expect(evidenceFileSetMatches(["result.json", "trace.json"], ["trace.json", "result.json"])).toBe(true)
    expect(
      paperEvidenceChecks({
        manifestVerified: true,
        providerLedgerVerified: true,
        profileVerified: true,
        isolationVerified: true,
        benchmarkIdentityVerified: true,
        rawEvidenceVerified: true,
      }),
    ).toEqual({ passed: true, failed: [] })
  })

  test("permanently invalidates cleanup, seal, and post-seal redaction evidence", () => {
    expect(permanentRunInvalidation(["cleanup-failure.json"], {})).toEqual({ invalid: true, reason: "cleanup_failure" })
    expect(permanentRunInvalidation(["evidence-seal-failure.json"], {})).toEqual({
      invalid: true,
      reason: "evidence_seal_failure",
    })
    expect(permanentRunInvalidation(["redaction-receipt-2.json"], {})).toEqual({
      invalid: true,
      reason: "post_seal_secret_redaction",
    })
  })

  test("recomputes Task profile, identity, and workflow binding from raw receipts", () => {
    const workflow = { kind: "virtual_workflow", workflow_id: "planned-delivery" }
    expect(
      auditRunBinding({
        resultProfile: "advanced",
        resultTaskID: "task-1",
        resultWorkflow: workflow,
        resultSelectedWorkflowID: "planned-delivery",
        requestedProfile: "advanced",
        boundProfile: "advanced",
        boardTaskID: "task-1",
        responseTaskID: "task-1",
        boardWorkflow: workflow,
      }),
    ).toEqual({ passed: true, selectedWorkflowID: "planned-delivery" })
  })

  test("passes the experimental Skill projection only when every skill-capable agent mounts it", () => {
    const matrix = (grants: Record<string, { effective: boolean; enabled: boolean | null; reason?: string }>) => ({
      active_profile: "base",
      projection_hash: "hash",
      skills: [
        {
          ref: "default/skill/automationbench-api",
          name: "automationbench-api",
          location: "/project/.opencorvus/skill/automationbench-api/SKILL.md",
          projection_source: "default",
        },
      ],
      agents: [
        { agent_id: "base-planner", base_role: "delegated-worker", skill_mountable: true, skill_tool_available: true },
        { agent_id: "base-developer", base_role: "build", skill_mountable: true, skill_tool_available: true },
        { agent_id: "base-tester", base_role: "delegated-worker", skill_mountable: true, skill_tool_available: true },
        { agent_id: "base-researcher", base_role: "explore", skill_mountable: false, skill_tool_available: false },
      ],
      matrix: Object.entries(grants).map(([agent_id, grant]) => ({
        agent_id,
        grants: [{ ref: "default/skill/automationbench-api", ...grant }],
      })),
    })
    const mounted = {
      "base-planner": { effective: true, enabled: true },
      "base-developer": { effective: true, enabled: true },
      "base-tester": { effective: true, enabled: true },
    }
    expect(
      auditSkillProjection({
        profile: "base",
        matrix: matrix(mounted),
        expectedLocation: "/project/.opencorvus/skill/automationbench-api/SKILL.md",
      }),
    ).toMatchObject({
      passed: true,
      mounted_agents: ["base-developer", "base-planner", "base-tester"],
      unmountable_agents: [
        { agent_id: "base-researcher", base_role: "explore", reason: "base_role_not_skill_mountable" },
      ],
      violations: [],
    })

    // The first five-case wave seeded `.opencorvus/skill/` and declared `skill.enabled` without
    // mounting anything, so every projected worker searched an empty Skill surface.
    expect(
      auditSkillProjection({
        profile: "base",
        matrix: matrix({
          "base-planner": { effective: false, enabled: null },
          "base-developer": { effective: false, enabled: null },
          "base-tester": { effective: false, enabled: null },
        }),
      }),
    ).toMatchObject({
      passed: false,
      mounted_agents: [],
      violations: [
        "not_effective:base-planner",
        "not_effective:base-developer",
        "not_effective:base-tester",
        "no_agent_mounted",
      ],
    })

    expect(
      auditSkillProjection({
        profile: "base",
        matrix: matrix({ ...mounted, "base-tester": { effective: true, enabled: false, reason: "permission_denied" } }),
      }).violations,
    ).toEqual(["not_enabled:base-tester:permission_denied"])
  })

  test("scores an explicit natural Task failure but rejects an infrastructure-affected failure", () => {
    const natural = auditTaskOutcome("failed", [
      {
        parts: [
          {
            type: "tool",
            tool: "manage_task",
            state: { status: "completed", input: { action: "fail_task" }, output: "Task stopped" },
          },
        ],
      },
    ])
    expect(natural).toMatchObject({ passed: true, scored_terminal: true, outcome: "natural_failed" })

    const infrastructure = auditTaskOutcome("failed", [
      {
        parts: [
          {
            type: "tool",
            tool: "dispatch_agent",
            state: {
              output: JSON.stringify({
                kind: "infrastructure_failure",
                operation: "build_adapter",
                message: "MCP failed",
              }),
            },
          },
          {
            type: "tool",
            tool: "manage_task",
            state: { status: "completed", input: { action: "fail_task" }, output: "Task stopped" },
          },
        ],
      },
    ])
    expect(infrastructure).toMatchObject({ passed: false, scored_terminal: false, outcome: "invalid_terminal" })

    expect(
      auditTaskOutcome("failed", [
        {
          parts: [
            {
              type: "tool",
              tool: "manage_task",
              state: { status: "error", input: { action: "fail_task" }, output: "Rejected" },
            },
          ],
        },
      ]),
    ).toMatchObject({ passed: false, scored_terminal: false, explicit_fail_task: false })
  })

  test("accepts terminal evidence only after every execution occurrence settles", () => {
    const terminal = (type: string) => ({ events: [{ status: { type } }] })
    expect(
      auditTerminalQuiescence({
        task: { status: "failed" },
        executionProjection: {
          occurrences: [
            terminal("terminal"),
            { agent: "orchestrator", events: [{ status: { type: "idle" } }] },
          ],
        },
      }),
    ).toMatchObject({ passed: true, occurrence_count: 2, unsettled_occurrences: [] })
    expect(
      auditTerminalQuiescence({
        task: { status: "failed" },
        executionProjection: {
          occurrences: [
            terminal("terminal"),
            { agent: "base-developer", sessionID: "session-late", events: [{ status: { type: "streaming" } }] },
          ],
        },
      }),
    ).toMatchObject({
      passed: false,
      unsettled_occurrences: [
        { agent: "base-developer", session_id: "session-late", last_status: "streaming" },
      ],
    })
  })

  test("accepts a sealed five-case batch with paired crossover waves", () => {
    const cases = [1, 2, 3, 4, 5].map((case_index) => ({ case_index }))
    const wave1 = cases.map((item) => ({ ...item, profile: item.case_index % 2 ? "base" : "advanced" }))
    const wave2 = wave1.map((item) => ({
      case_index: item.case_index,
      profile: item.profile === "base" ? "advanced" : "base",
    }))
    const launched = [wave1, wave2].map((wave, waveOffset) =>
      wave.map((item, index) => ({
        ...item,
        run_id: `run-${waveOffset + 1}-${item.case_index}`,
        network_namespace: `net:[${1000 + waveOffset * 10 + index}]`,
      })),
    )
    const attempts = launched.flatMap((wave, waveOffset) =>
      wave.map((item, index) => ({
        run_id: item.run_id,
        raw_leaderboard_eligible: true,
        leaderboard_eligible: true,
        started_at: waveOffset === 0 ? 100 + index : 210 + index,
        finished_at: waveOffset === 0 ? 150 + index : 260 + index,
        benchmark: {
          batch_run_id: "batch-1",
          batch_plan_sha256: "plan-sha",
          wave_index: waveOffset + 1,
          case_index: item.case_index,
        },
        opencorvus: {
          profile: item.profile,
          host_network_isolation_audit: { network_namespace: item.network_namespace },
        },
      })),
    )
    expect(
      auditBatchEvidence({
        plan: {
          batch_run_id: "batch-1",
          trial_concurrency: 5,
          network_isolation: "private_netns_slirp4netns_disable_host_loopback_v1",
          host_network_namespace: "net:[999]",
          protected_roots: { evidence: { passed: true }, control: { passed: true } },
          preexisting_eligible: { base: [], advanced: [] },
          cases,
          waves: [wave1, wave2],
        },
        waveCompletion: {
          batch_run_id: "batch-1",
          status: "wave_1_complete",
          completed_at: 200,
          eligible_slots: wave1,
        },
        receipt: {
          batch_run_id: "batch-1",
          status: "completed",
          wave_1: { launched: launched[0], eligible: launched[0] },
          wave_2: { launched: launched[1], eligible: launched[1] },
        },
        attempts,
        planSHA256: "plan-sha",
      }),
    ).toEqual({
      passed: true,
      status: "completed",
      reasons: [],
      eligible_run_ids: launched
        .flat()
        .map((item) => item.run_id)
        .sort(),
      sealing_run_ids: launched
        .flat()
        .map((item) => item.run_id)
        .sort(),
      adopted_run_ids: [],
    })
  })

  test("normalizes trace, Skill, and benchmark calls onto aligned lanes", () => {
    const events = normalizeTrajectory({
      transcript,
      trace: [
        { ts: 100, kind: "llm_request", agentName: "base-developer" },
        { ts: 160, kind: "agent_turn", agentName: "base-developer" },
      ],
      benchmarkEvents: [{ ts: 135, end: 145, kind: "tool", tool: "api_fetch" }],
    })
    expect(events.map((event) => [event.lane, event.kind, event.label])).toEqual([
      ["base-developer", "turn", "agent_turn"],
      ["base-developer", "skill", "skill"],
      ["automationbench", "benchmark", "api_fetch"],
    ])
    expect(
      renderTrajectorySVG({ title: "Base trial", events, tokens: summarizeTranscriptUsage(transcript) }),
    ).toContain("Aligned OpenCorvus agent and AutomationBench tool trajectory.")
  })
})
