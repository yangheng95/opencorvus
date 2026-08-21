import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
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
  analyzePromptComposition,
  auditPromptCompositionCoverage,
  auditDispatchedSkillCoverage,
  auditRunBinding,
  auditSkillEvidenceSeal,
  auditSkillProjection,
  auditTaskInfrastructureIncidents,
  auditTaskOutcome,
  auditTerminalQuiescence,
  auditBatchEvidence,
  executeRollingBatchChains,
  missingCompletedBatchProfileReceipts,
  reusableProfileRuns,
  reusableBatchCandidateRunIDs,
  plannedAutomationBenchSlotState,
  rollingBatchChains,
  paperEvidenceChecks,
  normalizeTrajectory,
  renderTrajectorySVG,
  summarizeTranscriptUsage,
  type ProviderUsageRow,
} from "../../script/benchmark/external-agent/contract"

describe("external agent benchmark contract", () => {
  test("uses the seeded simulated SaaS world and bounded authority discovery", async () => {
    const skill = await fs.readFile(
      path.resolve(import.meta.dir, "../../script/benchmark/external-agent/automationbench-api.SKILL.md"),
      "utf8",
    )
    expect(skill).toContain("initializes a seeded simulated business environment for every Task")
    expect(skill).toContain("do one bounded authority discovery before mutation")
    expect(skill).toContain("one `api_search` using the concrete target/action nouns")
    expect(skill).toContain("never report a simulated app's missing connection as benchmark infrastructure failure")
  })
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
          session_id: "ses_one",
          agent_id: "implementation-engineer",
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

  test("passes the experimental Skill projection only for exact profile owners", () => {
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
        { agent_id: "base-researcher", base_role: "explore", reason: "profile_role_not_skill_owner" },
        // The scheduler is outside the mount matrix by construction. Recording it keeps the
        // post-run coverage audit's accounted set complete instead of leaving an implicit exemption.
        { agent_id: "orchestrator", base_role: "orchestrator", reason: "scheduler_outside_mount_matrix" },
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

    const physicallyUnavailable = matrix(mounted)
    physicallyUnavailable.agents = physicallyUnavailable.agents.map((agent) =>
      agent.agent_id === "base-tester"
        ? { ...agent, skill_mountable: false, skill_tool_available: false }
        : agent,
    )
    expect(auditSkillProjection({ profile: "base", matrix: physicallyUnavailable })).toMatchObject({
      passed: false,
      violations: ["required_agent_not_mountable:base-tester"],
    })
  })

  const infrastructureArtifact = (id: string, gateReason: string) => ({
    id,
    kind: "task-infrastructure-error",
    label: "task-control",
    payload: JSON.stringify({
      component: "task-control",
      operation: "surface-operator-gated-ingress",
      reason: `Task-root ingress ing_${id} rests in host_fault (${gateReason})`,
      context: { ingressID: `ing_${id}`, state: "host_fault", gateReason },
    }),
  })
  const boardIncident = (id: string) => ({ id, source: "infrastructure", errorName: "InfrastructureError" })
  const snapshotOf = (...artifacts: unknown[]) => ({ rows: { engine_artifact: artifacts } })
  const boardOf = (...incidents: unknown[]) => ({ processIncidents: incidents })

  test("accepts a run only when the Host recorded no task infrastructure error", () => {
    expect(
      auditTaskInfrastructureIncidents({
        snapshot: snapshotOf({ id: "art_ok", kind: "expert_output" }),
        board: boardOf({ id: "inc_stream", source: "stream" }),
      }),
    ).toMatchObject({ passed: true, violations: [], missing_sources: [], sources_agree: true })
  })

  test("rejects a run whose relational snapshot holds a host_fault ingress artifact", () => {
    // The exact shape that scored as an ordinary run: the Task-root ingress rests
    // in `host_fault`, no Tool ever returned an `infrastructure_failure`, so the
    // transcript-side audit sees a clean Task.
    const audit = auditTaskInfrastructureIncidents({
      snapshot: snapshotOf(
        infrastructureArtifact("art_one", "decision_ambiguous"),
        infrastructureArtifact("art_two", "decision_ambiguous"),
      ),
      board: boardOf(boardIncident("art_one"), boardIncident("art_two")),
    })
    expect(audit.passed).toBe(false)
    expect(audit.violations).toEqual(["task_infrastructure_error:2"])
    expect(audit.counts_by_reason).toEqual({ "surface-operator-gated-ingress|decision_ambiguous": 2 })
    expect(audit.incidents.map((item) => item.id)).toEqual(["art_one", "art_two"])
    expect(auditTaskOutcome("completed", []).passed).toBe(true)
  })

  test("rejects a run on the terminal board alone when no relational snapshot was sealed", () => {
    const audit = auditTaskInfrastructureIncidents({ board: boardOf(boardIncident("art_one")) })
    expect(audit.passed).toBe(false)
    expect(audit.missing_sources).toEqual(["runtime_database_snapshot"])
    expect(audit.violations).toContain("task_infrastructure_error:1")
  })

  test("fails closed when neither Host record is readable", () => {
    expect(auditTaskInfrastructureIncidents({})).toMatchObject({
      passed: false,
      violations: ["no_host_record_available"],
    })
  })

  test("rejects a run whose two Host records disagree about the incident set", () => {
    const audit = auditTaskInfrastructureIncidents({
      snapshot: snapshotOf(infrastructureArtifact("art_one", "decision_ambiguous")),
      board: boardOf(),
    })
    expect(audit.passed).toBe(false)
    expect(audit.sources_agree).toBe(false)
    expect(audit.violations).toEqual(["source_disagreement", "task_infrastructure_error:1"])
  })

  test("prices the tokens a Session re-sent because an earlier block was rewritten", () => {
    const block = (label: string, sha: string, tokens: number) => ({
      kind: label.startsWith("system") ? "system" : label === "tools" ? "tools" : "message",
      index: 0,
      label,
      chars: tokens * 4,
      tokensEst: tokens,
      sha256: sha,
    })
    // Two calls in one Session. The second rewrote `system[1]` — the live state
    // block — so the four message blocks behind it are re-sent unchanged. That
    // is the measured Orchestrator shape, and the whole point of the metric.
    const call = (liveStateSha: string) => ({
      blocks: [
        block("tools", "aaaa", 100),
        block("system[0]", "bbbb", 50),
        block("system[1]", liveStateSha, 30),
        block("message[0]:user", "cccc", 10),
        block("message[1]:assistant", "dddd", 10),
      ],
      systemBlocks: 2,
      messageBlocks: 2,
      toolCount: 1,
      toolNames: ["read"],
      totalChars: 800,
      totalTokensEst: 200,
      physicalSystem: { chars: 40, tokensEst: 10, sha256: liveStateSha },
      compositionSha256: liveStateSha,
    })
    const trace = [
      { kind: "llm_request", sessionID: "ses_a", payload: { promptComposition: call("t0") } },
      { kind: "llm_request", sessionID: "ses_a", payload: { promptComposition: call("t1") } },
      { kind: "agent_turn", sessionID: "ses_a", payload: {} },
    ]

    const analysis = analyzePromptComposition(trace)
    expect(analysis.calls).toBe(2)
    const session = analysis.sessions[0]!
    expect(session.session_id).toBe("ses_a")
    // Call two keeps tools + system[0] and loses everything from system[1] on.
    expect(session.first_divergent_labels).toEqual({ "system[1]": 1 })
    expect(session.physical_system_changes).toBe(1)
    expect(session.append_only_calls).toBe(0)
    // The two message blocks never changed and were paid for twice.
    expect(session.resent_prefix_tokens_est).toBe(20)
    expect(analysis.resent_prefix_tokens_est).toBe(20)
  })

  test("charges nothing as re-sent when a Session only appends", () => {
    const base = (labels: string[]) => ({
      blocks: labels.map((label, index) => ({
        kind: "message" as const,
        index,
        label,
        chars: 40,
        tokensEst: 10,
        sha256: label,
      })),
      systemBlocks: 0,
      messageBlocks: labels.length,
      toolCount: 0,
      toolNames: [],
      totalChars: labels.length * 40,
      totalTokensEst: labels.length * 10,
      compositionSha256: labels.join(""),
    })
    const analysis = analyzePromptComposition([
      { kind: "llm_request", sessionID: "ses_b", payload: { promptComposition: base(["a", "b"]) } },
      { kind: "llm_request", sessionID: "ses_b", payload: { promptComposition: base(["a", "b", "c"]) } },
    ])
    expect(analysis.sessions[0]!.append_only_calls).toBe(1)
    expect(analysis.resent_prefix_tokens_est).toBe(0)
    // First call has no predecessor, so all 20 of its tokens count as divergent;
    // the second call keeps 20 and adds 10. 20 stable against 30 divergent.
    expect(analysis.stable_prefix_share).toBeCloseTo(0.4, 5)
  })

  test("ignores trace events that carry no fingerprint", () => {
    expect(analyzePromptComposition([{ kind: "agent_turn", sessionID: "ses_c", payload: {} }, {}])).toMatchObject({
      calls: 0,
      sessions: [],
      stable_prefix_share: null,
    })
  })

  test("accepts prompt-composition evidence when every usage-bearing call has a fingerprinted request attempt", () => {
    const promptComposition = {
      blocks: [],
      systemBlocks: 0,
      messageBlocks: 0,
      toolCount: 0,
      toolNames: [],
      totalChars: 0,
      totalTokensEst: 0,
      compositionSha256: "receipt",
    }
    const trace = [
      { kind: "llm_request", sessionID: "ses_a", agentName: "base-developer", payload: { promptComposition } },
      { kind: "llm_request", sessionID: "ses_a", agentName: "base-developer", payload: { promptComposition } },
    ]
    const usage = [
      { id: "pvu_1", purpose: "session", session_id: "ses_a", agent_id: "base-developer" },
      { id: "pvu_2", purpose: "session", session_id: "ses_a", agent_id: "base-developer" },
      { id: "pvu_3", purpose: "summary", session_id: null, agent_id: null },
    ] as ProviderUsageRow[]
    expect(auditPromptCompositionCoverage(trace, usage)).toEqual({
      passed: true,
      request_events: 2,
      fingerprinted_events: 2,
      session_usage_rows: 2,
      request_attempts_without_usage: 0,
      violations: [],
    })
  })

  test("preserves failed request attempts that have fingerprints but no usage row", () => {
    const promptComposition = {
      blocks: [],
      systemBlocks: 0,
      messageBlocks: 0,
      toolCount: 0,
      toolNames: [],
      totalChars: 0,
      totalTokensEst: 0,
      compositionSha256: "failed-attempt-receipt",
    }
    const trace = [
      { kind: "llm_request", sessionID: "ses_a", agentName: "base-tester", payload: { promptComposition } },
      { kind: "llm_request", sessionID: "ses_a", agentName: "base-tester", payload: { promptComposition } },
    ]
    const usage = [
      { id: "pvu_success", purpose: "session", session_id: "ses_a", agent_id: "base-tester" },
    ] as ProviderUsageRow[]
    expect(auditPromptCompositionCoverage(trace, usage)).toEqual({
      passed: true,
      request_events: 2,
      fingerprinted_events: 2,
      session_usage_rows: 1,
      request_attempts_without_usage: 1,
      violations: [],
    })
  })

  test("returns explicit violations when usage has no attributed fingerprinted request", () => {
    const audit = auditPromptCompositionCoverage(
      [{ kind: "llm_request", sessionID: "ses_a", agentName: "base-planner", payload: {} }],
      [
        { id: "pvu_uncovered", purpose: "session", session_id: "ses_b", agent_id: "base-developer" },
      ] as ProviderUsageRow[],
    )
    expect(audit).toMatchObject({
      passed: false,
      request_events: 1,
      fingerprinted_events: 0,
      session_usage_rows: 1,
      request_attempts_without_usage: 1,
      violations: ["missing_fingerprints:1", "usage_without_request_attempt:ses_b:base-developer:1:0"],
    })
  })

  test("accepts a sealed Skill receipt only when result.json and skill-projection.json both carry it", () => {
    const matrix = {
      active_profile: "advanced",
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
        {
          agent_id: "implementation-engineer",
          base_role: "build",
          skill_mountable: true,
          skill_tool_available: true,
        },
        {
          agent_id: "test-engineer",
          base_role: "delegated-worker",
          skill_mountable: true,
          skill_tool_available: true,
        },
        {
          agent_id: "source-investigator",
          base_role: "explore",
          skill_mountable: false,
          skill_tool_available: false,
        },
      ],
      matrix: [
        {
          agent_id: "implementation-engineer",
          grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
        },
        {
          agent_id: "test-engineer",
          grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
        },
      ],
    }
    const transcript = [
      { info: { agent: "orchestrator" } },
      { info: { agent: "source-investigator" } },
      { info: { agent: "implementation-engineer" } },
      { info: { agent: "test-engineer" } },
    ]
    const projection = auditSkillProjection({ profile: "advanced", matrix })
    const coverage = auditDispatchedSkillCoverage({ projection, transcript })
    // Exactly what the runner seals: one audited value written into both files.
    const skill = {
      name: "automationbench-api",
      ref: "default/skill/automationbench-api",
      revision: 1,
      projection,
      dispatched_coverage: coverage,
    }
    const projectionFile = { profile: "advanced", skill, matrix }

    expect(
      auditSkillEvidenceSeal({ profile: "advanced", resultSkill: skill, projectionFile, transcript }),
    ).toMatchObject({ passed: true, violations: [] })

    // The shipped wiring bug: the receipt file carried the coverage and `result.json` did not, so
    // every otherwise-valid run would have been rejected by the checkers instead of scored.
    const { dispatched_coverage: _omitted, ...skillWithoutCoverage } = skill
    expect(
      auditSkillEvidenceSeal({
        profile: "advanced",
        resultSkill: skillWithoutCoverage,
        projectionFile,
        transcript,
      }),
    ).toMatchObject({ passed: false, violations: ["result_coverage_mismatch"] })

    // And the inverse: a receipt that disagrees with the sealed result is never silently accepted.
    expect(
      auditSkillEvidenceSeal({
        profile: "advanced",
        resultSkill: skill,
        projectionFile: { ...projectionFile, skill: skillWithoutCoverage },
        transcript,
      }),
    ).toMatchObject({ passed: false, violations: ["receipt_coverage_mismatch"] })
  })

  test("rejects a run whose transcript shows an Agent the Skill projection never described", () => {
    const projection = {
      mounted_agents: ["implementation-engineer", "test-engineer"],
      unmountable_agents: [{ agent_id: "source-investigator" }, { agent_id: "orchestrator" }],
    }
    const transcript = (agents: string[]) => agents.map((agent) => ({ info: { agent } }))

    expect(
      auditDispatchedSkillCoverage({
        projection,
        transcript: transcript(["orchestrator", "implementation-engineer", "source-investigator"]),
      }),
    ).toMatchObject({ passed: true, uncovered_agents: [] })

    // The real failure: `SkillMount.matrix()` omitted scheduler-only `universal-build`, so the
    // pre-Task projection audit passed while the worker that performed every mutation searched an
    // empty Skill surface. Two sealed Advanced runs carried that false positive.
    expect(
      auditDispatchedSkillCoverage({
        projection,
        transcript: transcript(["orchestrator", "universal-build"]),
      }),
    ).toMatchObject({
      passed: false,
      dispatched_agents: ["orchestrator", "universal-build"],
      uncovered_agents: ["universal-build"],
    })
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

  test("builds five rolling crossover case chains", () => {
    const wave1 = [1, 2, 3, 4, 5].map((case_index) => ({
      case_index,
      profile: case_index % 2 ? ("base" as const) : ("advanced" as const),
    }))
    const wave2 = wave1.map((item) => ({
      case_index: item.case_index,
      profile: item.profile === "base" ? ("advanced" as const) : ("base" as const),
    }))
    expect(rollingBatchChains([wave1, wave2])).toEqual(
      wave1.map((item, index) => [item, wave2[index]]),
    )
    expect(rollingBatchChains([wave1.map((item) => ({ ...item, profile: "base" as const }))])).toEqual(
      wave1.map((item) => [{ ...item, profile: "base" }]),
    )
  })

  test("keeps five rolling case slots busy and continues each case after a settled invalid attempt", async () => {
    const wave1 = [1, 2, 3, 4, 5].map((case_index) => ({
      case_index,
      profile: case_index % 2 ? ("base" as const) : ("advanced" as const),
    }))
    const wave2 = wave1.map((item) => ({
      case_index: item.case_index,
      profile: item.profile === "base" ? ("advanced" as const) : ("base" as const),
    }))
    let active = 0
    let peak = 0
    const outcomes = await executeRollingBatchChains({
      chains: rollingBatchChains([wave1, wave2]),
      shouldRun: () => true,
      run: async (slot, waveIndex) => {
        active += 1
        peak = Math.max(peak, active)
        await Bun.sleep(slot.case_index)
        active -= 1
        return { ...slot, wave_index: waveIndex, status: slot.case_index === 1 && waveIndex === 1 ? "invalid" : "scored" }
      },
    })
    expect({ peak, active, outcomes }).toEqual({
      peak: 5,
      active: 0,
      outcomes: wave1.map((first, index) => [
        { ...first, wave_index: 1, status: index === 0 ? "invalid" : "scored" },
        { ...wave2[index]!, wave_index: 2, status: "scored" },
      ]),
    })
  })

  test("accepts a sealed five-case rolling batch with paired crossover slots", () => {
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
    const adoptedRun = launched[0]![0]!
    const attempts = launched.flatMap((wave, waveOffset) =>
      wave.map((item, index) => {
        const adopted = item.run_id === adoptedRun.run_id
        return {
          run_id: item.run_id,
          raw_leaderboard_eligible: true,
          leaderboard_eligible: true,
          started_at: waveOffset === 0 ? 100 : 151 + index * 10,
          finished_at: waveOffset === 0 ? 150 + index * 10 : 200 + index * 10,
          benchmark: {
            batch_run_id: adopted ? "batch-previous" : "batch-1",
            batch_plan_sha256: adopted ? "previous-plan-sha" : "plan-sha",
            wave_index: waveOffset + 1,
            case_index: item.case_index,
          },
          opencorvus: {
            profile: item.profile,
            host_network_isolation_audit: { network_namespace: item.network_namespace },
          },
        }
      }),
    )
    expect(
      auditBatchEvidence({
        plan: {
          batch_run_id: "batch-1",
          trial_concurrency: 5,
          schedule_mode: "rolling_case_slots_v1",
          profiles: ["base", "advanced"],
          network_isolation: "private_netns_slirp4netns_disable_host_loopback_v1",
          host_network_namespace: "net:[999]",
          protected_roots: { evidence: { passed: true }, control: { passed: true } },
          preexisting_eligible: {
            base: [{ run_id: adoptedRun.run_id, case_index: adoptedRun.case_index, profile: adoptedRun.profile }],
            advanced: [],
          },
          cases,
          waves: [wave1, wave2],
        },
        receipt: {
          batch_run_id: "batch-1",
          status: "completed",
          wave_1: { launched: launched[0]!.slice(1), eligible: launched[0] },
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
        .filter((item) => item.run_id !== adoptedRun.run_id)
        .map((item) => item.run_id)
        .sort(),
      adopted_run_ids: [adoptedRun.run_id],
    })
  })

  test("accepts a completed five-case Base-only rolling batch", () => {
    const cases = [6, 7, 8, 9, 10].map((case_index) => ({ case_index }))
    const wave = cases.map((item) => ({ ...item, profile: "base" }))
    const launched = wave.map((item, index) => ({ ...item, run_id: `base-${item.case_index}`, index }))
    const attempts = launched.map((item) => ({
      run_id: item.run_id,
      raw_leaderboard_eligible: true,
      leaderboard_eligible: true,
      started_at: 100,
      finished_at: 200 + item.index,
      benchmark: {
        batch_run_id: "batch-2",
        batch_plan_sha256: "base-plan-sha",
        wave_index: 1,
        case_index: item.case_index,
      },
      opencorvus: { profile: "base" },
    }))
    expect(
      auditBatchEvidence({
        plan: {
          batch_run_id: "batch-2",
          trial_concurrency: 5,
          schedule_mode: "rolling_case_slots_v1",
          profiles: ["base"],
          cases,
          waves: [wave],
          preexisting_eligible: { base: [], advanced: [] },
        },
        receipt: {
          batch_run_id: "batch-2",
          status: "completed",
          wave_1: { launched, eligible: launched },
        },
        attempts,
        planSHA256: "base-plan-sha",
      }),
    ).toEqual({
      passed: true,
      status: "completed",
      reasons: [],
      eligible_run_ids: launched.map((item) => item.run_id).sort(),
      sealing_run_ids: launched.map((item) => item.run_id).sort(),
      adopted_run_ids: [],
    })
  })

  test("preserves clean sealed candidates when later Host faults invalidate sibling claims", () => {
    const cases = [1, 2, 3, 4, 5].map((case_index) => ({ case_index }))
    const wave = cases.map((item) => ({ ...item, profile: "base" }))
    const launched = wave.map((item) => ({ ...item, run_id: `base-${item.case_index}` }))
    const attempts = launched.map((item) => ({
      run_id: item.run_id,
      raw_leaderboard_eligible: item.case_index === 3 || item.case_index === 4,
      leaderboard_eligible: item.case_index === 3 || item.case_index === 4,
      started_at: 100,
      finished_at: 200 + item.case_index,
      benchmark: {
        batch_run_id: "batch-posthoc-host-fault",
        batch_plan_sha256: "posthoc-plan-sha",
        wave_index: 1,
        case_index: item.case_index,
      },
      opencorvus: { profile: "base" },
    }))
    const audit = auditBatchEvidence({
      plan: {
        batch_run_id: "batch-posthoc-host-fault",
        trial_concurrency: 5,
        schedule_mode: "rolling_case_slots_v1",
        profiles: ["base"],
        cases,
        waves: [wave],
        preexisting_eligible: { base: [], advanced: [] },
      },
      receipt: {
        batch_run_id: "batch-posthoc-host-fault",
        status: "failed",
        wave_1: { launched, eligible: launched },
      },
      attempts,
      planSHA256: "posthoc-plan-sha",
    })

    expect({
      passed: audit.passed,
      reasons: audit.reasons,
      reusable: reusableBatchCandidateRunIDs(audit),
    }).toEqual({
      passed: false,
      reasons: [
        "eligible_trial_raw_invalid:base:1",
        "eligible_trial_raw_invalid:base:2",
        "eligible_trial_raw_invalid:base:5",
      ],
      reusable: ["base-3", "base-4"],
    })
    expect(
      reusableBatchCandidateRunIDs({
        ...audit,
        reasons: [...audit.reasons, "rolling_concurrency"],
      }),
    ).toEqual([])
    expect(
      reusableBatchCandidateRunIDs({
        ...audit,
        reasons: ["eligible_trial_contract:base:1"],
      }),
    ).toEqual([])
  })

  test("projects active and terminal attempts ahead of an unstarted planned slot", () => {
    const invalidation = { status: "invalid_bug", reason: "host_decision_ambiguous" }
    expect([
      plannedAutomationBenchSlotState({ active: true, invalidation }),
      plannedAutomationBenchSlotState({ active: false, invalidation }),
      plannedAutomationBenchSlotState({ active: false }),
    ]).toEqual([
      { kind: "running" },
      { kind: "invalidated", ...invalidation },
      { kind: "queued" },
    ])
  })

  test("accepts profile-phased completed receipts for the final paired matrix", () => {
    const completed = (batch_index: number, profiles: string[]) => ({
      profiles,
      receipt: { batch_index },
      audit: { passed: true, status: "completed" },
    })
    const batches = Array.from({ length: 10 }, (_, offset) => [
      completed(offset + 1, ["base"]),
      completed(offset + 1, ["advanced"]),
    ]).flat()

    expect(
      missingCompletedBatchProfileReceipts({
        batches,
        batchIndexes: Array.from({ length: 10 }, (_, offset) => offset + 1),
        profiles: ["base", "advanced"],
      }),
    ).toEqual([])
  })

  test("reuses verified profile rows before failed-batch candidates", () => {
    const record = (run_id: string, case_index: number) => ({
      run_id,
      benchmark: { case_index, repetition: 1 },
      opencorvus: { profile: "base" },
    })
    const reusable = reusableProfileRuns(
      {
        leaderboard: [record("verified-1", 1)],
        candidates: [record("superseded-candidate-1", 1), record("candidate-2", 2)],
      },
      "base",
    )

    expect([...reusable].map(([caseIndex, item]) => [caseIndex, item.run_id])).toEqual([
      [2, "candidate-2"],
      [1, "verified-1"],
    ])
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
