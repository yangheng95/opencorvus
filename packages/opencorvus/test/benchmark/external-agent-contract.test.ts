import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import {
  automationBenchCaseSetAuthority,
  automationBenchRestrictedShellAuthority,
  automationBenchRestrictedShellSourceFile,
  AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256,
  acquireAutomationBenchTrialLease,
  benchmarkActivitySignature,
  benchmarkInactivityDeadline,
  benchmarkRunKey,
  auditBenchmarkBunRuntime,
  auditBatchReceiptRedaction,
  automationBenchToolConfig,
  automationBenchHarnessRequest,
  automationBenchRunValidity,
  auditBenchmarkIsolation,
  summarizeProviderUsageRows,
  providerUsageMatchesModel,
  summarizeBenchmarkToolEvents,
  evidenceFileSetMatches,
  permanentRunInvalidation,
  analyzePromptComposition,
  auditPromptCompositionCoverage,
  auditTaskBoundPromptCompositionCoverage,
  auditDispatchedSkillCoverage,
  auditRunBinding,
  auditSkillEvidenceSeal,
  auditSkillProjection,
  auditTaskInfrastructureIncidents,
  auditTaskOutcome,
  auditTerminalQuiescence,
  auditMissionOutcome,
  auditMissionEvidenceLineage,
  auditMissionEvidenceCollections,
  auditMissionQuiescence,
  auditMissionRunBinding,
  auditBatchEvidence,
  auditExcludedWrongExperimentBatch,
  auditAutomationBenchBatchPlanSchema,
  automationBenchBatchPlanIdentity,
  automationBenchBatchPlanMatches,
  automationBenchCoordinatorBatchIndexes,
  automationBenchCoordinatorSettlement,
  activeAutomationBenchBatchRunIDs,
  executeRollingBatchChains,
  failureObservationReceipt,
  missingCompletedBatchProfileReceipts,
  reusableProfileRuns,
  reconcileAutomationBenchBatchCandidates,
  reusableBatchCandidateRunIDs,
  plannedAutomationBenchSlotState,
  rollingBatchChains,
  paperEvidenceChecks,
  normalizeTrajectory,
  renderTrajectorySVG,
  summarizeTranscriptUsage,
  type ProviderUsageRow,
  type AutomationBenchTrialLease,
} from "../../script/benchmark/external-agent/contract"

describe("external agent benchmark contract", () => {
  test("reconciles a sanitized Provider diagnostic batch-receipt redaction chain", () => {
    const batchRunID = "367ae713-7598-4422-be04-37634d5e958a"
    const targetFileName = `batch-05-${batchRunID}-receipt.json`
    const targetBytes = Buffer.from(
      JSON.stringify({
        schema_version: 1,
        batch_run_id: batchRunID,
        batch_index: 5,
        status: "failed",
        wave_1: { launched: [{ stderr_tail: '"set-cookie": "<redacted>", "x-codex-turn-state": "<redacted>"' }] },
      }, null, 2) + "\n",
    )
    const afterSHA256 = crypto.createHash("sha256").update(targetBytes).digest("hex")
    expect(
      auditBatchReceiptRedaction({
        redactionFileName: `batch-05-${batchRunID}-redaction-receipt.json`,
        targetFileName,
        targetBytes,
        redactionReceipt: {
          schema_version: 1,
          kind: "automationbench_batch_receipt_secret_redaction",
          target: targetFileName,
          created_at: 1,
          reason: "provider_response_header_diagnostic_disclosure",
          redacted_labels: ["set-cookie", "x-codex-turn-state"],
          changed_stderr_tails: 1,
          before_sha256: "a".repeat(64),
          after_sha256: afterSHA256,
        },
      }),
    ).toEqual({ passed: true, target_sha256: afterSHA256, redacted_tail_count: 1, violations: [] })

    const prefixedTargetBytes = Buffer.from(
      JSON.stringify({
        schema_version: 1,
        batch_run_id: batchRunID,
        batch_index: 5,
        status: "failed",
        wave_1: {
          launched: [
            { stderr_tail: '"not-set-cookie": "<redacted>", "prefix-x-codex-turn-state": "<redacted>"' },
          ],
        },
      }, null, 2) + "\n",
    )
    const prefixedAfterSHA256 = crypto.createHash("sha256").update(prefixedTargetBytes).digest("hex")
    expect(
      auditBatchReceiptRedaction({
        redactionFileName: `batch-05-${batchRunID}-redaction-receipt.json`,
        targetFileName,
        targetBytes: prefixedTargetBytes,
        redactionReceipt: {
          schema_version: 1,
          kind: "automationbench_batch_receipt_secret_redaction",
          target: targetFileName,
          created_at: 1,
          reason: "provider_response_header_diagnostic_disclosure",
          redacted_labels: ["set-cookie", "x-codex-turn-state"],
          changed_stderr_tails: 1,
          before_sha256: "a".repeat(64),
          after_sha256: prefixedAfterSHA256,
        },
      }).violations,
    ).toContain("redaction_exact_labels_missing")
  })

  test("binds formal batches to the repository's exact Bun runtime", () => {
    expect(auditBenchmarkBunRuntime("bun@1.3.14", "1.3.14")).toEqual({
      passed: true,
      expected_version: "1.3.14",
      actual_version: "1.3.14",
    })
  })

  test("extends the frozen first 50 cases to all 600 unique public cases", async () => {
    const directory = path.resolve(import.meta.dir, "../../script/benchmark/external-agent")
    const [baseBytes, extendedBytes] = await Promise.all([
      fs.readFile(path.join(directory, "automationbench-case-set.json")),
      fs.readFile(path.join(directory, "automationbench-case-set-600.json")),
    ])
    const base = JSON.parse(baseBytes.toString("utf8"))
    const extended = JSON.parse(extendedBytes.toString("utf8"))
    const identity = (item: Record<string, unknown>) => ({
      domain: item.domain,
      task: item.task,
      example_id: item.example_id,
      task_contract_sha256: item.task_contract_sha256,
      selection_rank_sha256: item.selection_rank_sha256,
      case_index: item.case_index,
      batch_index: item.batch_index,
    })

    expect({
      baseCount: base.selection.count,
      extendedCount: extended.selection.count,
      basePrefix: extended.cases.slice(0, 50).map(identity),
      base: base.cases.map(identity),
      uniqueTasks: new Set(extended.cases.map((item: any) => `${item.domain}:${item.task}`)).size,
      firstAdded: { case_index: extended.cases[50].case_index, batch_index: extended.cases[50].batch_index },
      last: { case_index: extended.cases[599].case_index, batch_index: extended.cases[599].batch_index },
      quotas: extended.selection.domain_quotas,
      baseManifestSHA256: extended.selection.base_manifest_sha256,
    }).toEqual({
      baseCount: 50,
      extendedCount: 600,
      basePrefix: base.cases.map(identity),
      base: base.cases.map(identity),
      uniqueTasks: 600,
      firstAdded: { case_index: 51, batch_index: 11 },
      last: { case_index: 600, batch_index: 120 },
      quotas: { sales: 100, marketing: 100, operations: 100, support: 100, finance: 100, hr: 100 },
      baseManifestSHA256: crypto.createHash("sha256").update(baseBytes).digest("hex"),
    })
  })

  test("projects the old and extended case-set authorities across the case-50 boundary", () => {
    const base = { sha256: "base-bytes", canonical_sha256: "base-canonical" }
    const extended = { sha256: "extended-bytes", canonical_sha256: "extended-canonical" }
    const authority = (caseIndex: number, sealed: typeof base) =>
      automationBenchCaseSetAuthority({
        caseIndex,
        baseCount: 50,
        extendedCount: 600,
        sealedSHA256: sealed.sha256,
        sealedCanonicalSHA256: sealed.canonical_sha256,
        base,
        extended,
      })

    expect({
      case50: authority(50, base),
      case51: authority(51, extended),
      crossedDigest: authority(51, base),
    }).toEqual({
      case50: { passed: true, authority: "base", violations: [] },
      case51: { passed: true, authority: "extended", violations: [] },
      crossedDigest: { passed: false, authority: "extended", violations: ["case_set_authority_mismatch"] },
    })
  })

  test("binds real restricted-shell sources to the old and extended case ranges", async () => {
    const scriptRoot = path.resolve(import.meta.dir, "../../script/benchmark/external-agent")
    const [baseBytes, extendedBytes, runner, catalog, verifier] = await Promise.all([
      fs.readFile(path.join(scriptRoot, "restricted-agent-shell-base.sh")),
      fs.readFile(path.join(scriptRoot, "restricted-agent-shell.sh")),
      fs.readFile(path.join(scriptRoot, "run-automationbench.ts"), "utf8"),
      fs.readFile(path.join(scriptRoot, "catalog-automationbench-evidence.ts"), "utf8"),
      fs.readFile(path.join(scriptRoot, "verify-automationbench-evidence.ts"), "utf8"),
    ])
    const baseSHA256 = crypto.createHash("sha256").update(baseBytes).digest("hex")
    const extendedSHA256 = crypto.createHash("sha256").update(extendedBytes).digest("hex")
    const authority = (caseIndex: number, sealedSHA256: string) =>
      automationBenchRestrictedShellAuthority({
        caseIndex,
        baseCount: 50,
        extendedCount: 600,
        sealedSHA256,
        extendedSHA256,
      })

    expect({
      frozenBaseDigest: baseSHA256,
      case50Source: automationBenchRestrictedShellSourceFile({ caseIndex: 50, baseCount: 50, extendedCount: 600 }),
      case51Source: automationBenchRestrictedShellSourceFile({ caseIndex: 51, baseCount: 50, extendedCount: 600 }),
      case50: authority(50, baseSHA256),
      case51: authority(51, extendedSHA256),
      crossedDigest: authority(51, baseSHA256),
      productionAuthorityOwners: {
        runner: runner.includes("extendedSHA256: extendedWrapperSHA256"),
        catalogInput: catalog.includes("extendedSHA256: input.extendedWrapperSHA256"),
        catalogSource: catalog.includes("extendedWrapperSHA256: extendedRestrictedShellSHA256"),
        verifier: verifier.includes("extendedSHA256: extendedRestrictedShellSHA256"),
      },
    }).toEqual({
      frozenBaseDigest: AUTOMATIONBENCH_BASE_RESTRICTED_SHELL_SHA256,
      case50Source: "restricted-agent-shell-base.sh",
      case51Source: "restricted-agent-shell.sh",
      case50: { passed: true, authority: "base", expected_sha256: baseSHA256, violations: [] },
      case51: { passed: true, authority: "extended", expected_sha256: extendedSHA256, violations: [] },
      crossedDigest: {
        passed: false,
        authority: "extended",
        expected_sha256: extendedSHA256,
        violations: ["restricted_shell_authority_mismatch"],
      },
      productionAuthorityOwners: {
        runner: true,
        catalogInput: true,
        catalogSource: true,
        verifier: true,
      },
    })
  })

  test("uses the seeded simulated SaaS world and bounded authority discovery", async () => {
    const skill = await fs.readFile(
      path.resolve(import.meta.dir, "../../script/benchmark/external-agent/automationbench-api.SKILL.md"),
      "utf8",
    )
    expect(skill).toContain("initializes a seeded simulated business environment for every Task")
    expect(skill).toContain("do one bounded authority discovery before mutation")
    expect(skill).toContain("one `api_search` using the concrete target/action nouns")
    expect(skill).toContain("`search` is an endpoint-contract directory")
    expect(skill).toContain("durable simulated-world actions while GET/List continues to project seeded")
    expect(skill).toContain("record `acted-on-with-nonprojecting-readback` and stop that effect row")
    expect(skill).toContain("reread only the failed or unresolved effect rows named by the exact incremental guidance")
    expect(skill).toContain("Do not redispatch the mutation owner merely to make GET/List mirror the action receipt")
    expect(skill).toContain("That closure ends discovery, not the Task")
    expect(skill).toContain("email message inbox thread channel history")
    expect(skill).toContain("A keyword-filtered empty record read proves only that filter")
    expect(skill).toContain("one bounded list/read that is not narrowed by the missing business keyword")
    expect(skill).toContain("build one authority-field effect row for every material returned field/value")
    expect(skill).toContain("A field that names an action remains an action obligation")
    expect(skill).toContain("re-check the endpoint field name, path identity, range, query/body placement")
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

  test("binds preserved Provider usage to the exact Luna Mission experiment model", () => {
    const rows: ProviderUsageRow[] = [
      {
        id: "usage-luna-mission",
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
        session_id: "ses_luna_mission",
        agent_id: "base-developer",
      },
    ]
    expect(providerUsageMatchesModel(rows, "openai/gpt-5.6-luna")).toEqual({
      passed: true,
      provider_id: "openai",
      model_id: "gpt-5.6-luna",
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

  test("extends inactivity through the earliest durable scheduled wake promise", () => {
    const scheduledWakes = [
      {
        id: "automation-early",
        target: { scope: "session" as const, sessionID: "mission-session" },
        nextRun: 21_000,
        leaseUntil: 0,
        state: "scheduled" as const,
        claim: null,
      },
      {
        id: "automation-later",
        target: { scope: "task" as const, taskID: "task-1" },
        nextRun: 41_000,
        leaseUntil: 0,
        state: "scheduled" as const,
        claim: null,
      },
    ]
    const leasedWake = {
      ...scheduledWakes[0]!,
      state: "leased" as const,
      leaseUntil: 12_000,
      claim: {
        leaseID: "lease-a",
        ownerOccurrenceID: "automation-attempt-a",
        activatedAt: 11_000,
      },
    }
    expect(
      benchmarkInactivityDeadline({
        now: 1_000,
        currentDeadline: 11_000,
        inactivityMs: 10_000,
        scheduledWakes,
      }),
    ).toBe(31_000)
    expect(
      benchmarkInactivityDeadline({
        now: 1_000,
        currentDeadline: 11_000,
        inactivityMs: 10_000,
        scheduledWakes: [leasedWake],
      }),
    ).toBe(11_000)
    expect(
      benchmarkInactivityDeadline({
        now: 22_000,
        currentDeadline: 32_000,
        inactivityMs: 10_000,
        scheduledWakes,
      }),
    ).toBe(32_000)
    expect(
      benchmarkInactivityDeadline({
        now: 22_000,
        currentDeadline: 32_000,
        inactivityMs: 10_000,
        scheduledWakes: [scheduledWakes[1]!],
      }),
    ).toBe(51_000)
    expect(
      benchmarkActivitySignature({
        board: { task: { status: "active" }, artifacts: [] },
        transcript,
        trace: [],
        benchmarkEventCount: 1,
        scheduledWakes: [scheduledWakes[0]!],
      }),
    ).not.toBe(
      benchmarkActivitySignature({
        board: { task: { status: "active" }, artifacts: [] },
        transcript,
        trace: [],
        benchmarkEventCount: 1,
        scheduledWakes: [leasedWake],
      }),
    )
    expect(
      benchmarkActivitySignature({
        board: { task: { status: "active" }, artifacts: [] },
        transcript,
        trace: [],
        benchmarkEventCount: 1,
        scheduledWakes: [leasedWake],
      }),
    ).toBe(
      benchmarkActivitySignature({
        board: { task: { status: "active" }, artifacts: [] },
        transcript,
        trace: [],
        benchmarkEventCount: 1,
        scheduledWakes: [{ ...leasedWake, leaseUntil: 42_000 }],
      }),
    )
    expect(
      benchmarkActivitySignature({
        board: { task: { status: "active" }, artifacts: [] },
        transcript,
        trace: [],
        benchmarkEventCount: 1,
        scheduledWakes: [leasedWake],
      }),
    ).not.toBe(
      benchmarkActivitySignature({
        board: { task: { status: "active" }, artifacts: [] },
        transcript,
        trace: [],
        benchmarkEventCount: 1,
        scheduledWakes: [
          {
            ...leasedWake,
            leaseUntil: 42_000,
            claim: {
              leaseID: "lease-b",
              ownerOccurrenceID: "automation-attempt-b",
              activatedAt: 41_000,
            },
          },
        ],
      }),
    )
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
    expect(mapped).toContain(
      "Mission is the real intake coordinator for this run. Delegate the complete business workflow to child Task work owned by the held Expert Squad",
    )
    expect(mapped).toContain(
      "The SYSTEM/USER block is the sole semantic authority. Mission must assign every requested effect across the complete child-Task set",
    )
    expect(mapped).toContain("The full block remains authority context and does not make one child duplicate effects explicitly assigned to a sibling Task")
    expect(mapped).toContain("SYSTEM:\nExecute  the requested task. Keep  records exact.\n  code = '  exact  '")
    expect(mapped).toContain("USER:\n  Update the simulated business state.  ")
  })

  test("records the semantic-preserving Mission intake mapping as revision three", async () => {
    const runner = await fs.readFile(
      path.resolve(import.meta.dir, "../../script/benchmark/external-agent/run-automationbench.ts"),
      "utf8",
    )
    expect(runner).toContain('prompt_mapping: "remove_stock_single_model_turn_budget_and_use_mission_intake_v3"')
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

  test("accepts a Luna Mission that owns the exact Base child Task set and reaches durable completion", () => {
    const taskBoard = {
      task: {
        id: "task-1",
        source: "mission",
        status: "completed",
        packageRevisionBinding: { id: "base" },
      },
      executionProjection: { occurrences: [] },
    }
    const missionRecord = {
      missionID: "mission-1",
      sessionID: "mission-session-1",
      interruptible: false,
      pendingInteractions: 0,
      completion: {
        summary: "Accepted benchmark outcome",
        messageID: "message-mission-complete",
        toolCallID: "call-mission-complete",
        toolPartID: "part-mission-complete",
        timeRecorded: 12,
      },
      tasks: [{ id: "task-1", lifecycleStatus: "completed" }],
    }
    const missionStatus = {
      missionID: "mission-1",
      sessionID: "mission-session-1",
      status: "inactive",
      tasks: [{ taskID: "task-1", lifecycleStatus: "completed" }],
    }
    const missionTranscript = [
      {
        info: {
          id: "message-mission-user",
          role: "user",
          sessionID: "mission-session-1",
          time: { created: 1 },
        },
        parts: [{ type: "text", text: "Run the benchmark Mission." }],
      },
      {
        info: {
          id: "message-mission-complete",
          role: "assistant",
          agent: "mission",
          sessionID: "mission-session-1",
          time: { created: 10, completed: 12 },
          finish: "tool-calls",
          parentID: "message-mission-user",
        },
        parts: [
          {
            id: "part-mission-complete",
            callID: "call-mission-complete",
            type: "tool",
            tool: "panel",
            state: {
              status: "completed",
              input: { action: "complete_mission" },
              output: JSON.stringify({
                kind: "mission_completed",
                mission_id: "mission-1",
                mission_session_id: "mission-session-1",
                summary: "Accepted benchmark outcome",
                task_acceptances: [{
                  task_id: "task-1",
                  evidence_locators: [{ source: "task_artifact", ref: "artifact-1" }],
                  terminal_lifecycle_reference: { terminalEventID: "event-task-1-terminal" },
                }],
                assistant_message_id: "message-mission-complete",
                tool_call_id: "call-mission-complete",
                tool_part_id: "part-mission-complete",
                time_recorded: 12,
              }),
            },
          },
        ],
      },
    ]
    const taskBoards = [{ task_id: "task-1", board: taskBoard }]

    expect(
      auditMissionRunBinding({
        resultProfile: "base",
        resultModel: "openai/gpt-5.6-luna",
        resultMissionID: "mission-1",
        resultMissionSessionID: "mission-session-1",
        resultTaskIDs: ["task-1"],
        wakeRequest: {
          model: "openai/gpt-5.6-luna",
          expertSquadIDs: ["base"],
          productPillar: "work",
        },
        wakeResponse: {
          missionID: "mission-1",
          sessionID: "mission-session-1",
          productPillar: "work",
          created: true,
        },
        missionSession: {
          kind: "mission",
          metadata: {
            mission: { id: "mission-1", productPillar: "work", visibleExpertSquadIDs: ["base"] },
          },
        },
        missionRecord,
        missionStatus,
        projectGitInit: { created: true },
        taskBoards,
      }),
    ).toMatchObject({
      passed: true,
      requested_squads: ["base"],
      held_squads: ["base"],
      task_ids: ["task-1"],
      task_bindings: [{ task_id: "task-1", source: "mission", bound_profile: "base" }],
    })
    expect(
      auditMissionOutcome({
        missionRecord,
        missionStatus,
        missionTranscript,
        taskTranscripts: [{ task_id: "task-1", lifecycle_status: "completed", transcript: [] }],
      }),
    ).toMatchObject({
      passed: true,
      scored_terminal: true,
      mission_completed: true,
      explicit_complete_mission: true,
      child_task_count: 1,
    })
    expect(auditMissionQuiescence({ missionRecord, missionStatus, taskBoards })).toMatchObject({
      passed: true,
      mission_status: "inactive",
      mission_completed: true,
      task_count: 1,
    })
  })

  test("scores a clean naturally inactive Mission only after its assistant settled without a Provider error", () => {
    const missionRecord = {
      missionID: "mission-natural",
      sessionID: "session-natural",
      interruptible: false,
      tasks: [],
    }
    const missionStatus = {
      missionID: "mission-natural",
      sessionID: "session-natural",
      status: "inactive",
      tasks: [],
    }
    const settled = [
      {
        info: { id: "message-natural-user", sessionID: "session-natural", role: "user", time: { created: 1 } },
        parts: [{ type: "text", text: "Coordinate the benchmark." }],
      },
      {
        info: {
          id: "message-natural",
          sessionID: "session-natural",
          role: "assistant",
          parentID: "message-natural-user",
          time: { created: 2, completed: 3 },
          finish: "stop",
        },
        parts: [],
      },
    ]
    expect(auditMissionOutcome({ missionRecord, missionStatus, missionTranscript: settled, taskTranscripts: [] }))
      .toMatchObject({ scored_terminal: true, mission_assistant_healthy: true, child_task_count: 0 })

    const providerError = [
      settled[0],
      {
        ...settled[1],
        info: { ...settled[1].info, error: { name: "APIError", message: "provider failed" } },
      },
    ]
    expect(auditMissionOutcome({ missionRecord, missionStatus, missionTranscript: providerError, taskTranscripts: [] }))
      .toMatchObject({ scored_terminal: false, mission_assistant_healthy: false })
    const unansweredSchedulerWake = [
      ...settled,
      {
        info: { id: "message-scheduler-wake", sessionID: "session-natural", role: "user", time: { created: 4 } },
        parts: [{ type: "text", text: "Child Task reached terminal state." }],
      },
    ]
    expect(
      auditMissionOutcome({
        missionRecord,
        missionStatus,
        missionTranscript: unansweredSchedulerWake,
        taskTranscripts: [],
      }),
    ).toMatchObject({
      scored_terminal: false,
      mission_assistant_replies_to_latest_user: false,
    })

    expect(auditMissionOutcome({
      missionRecord: { ...missionRecord, tasks: [{ id: "task-failed", lifecycleStatus: "failed" }] },
      missionStatus: {
        ...missionStatus,
        tasks: [{ taskID: "task-failed", lifecycleStatus: "failed" }],
      },
      missionTranscript: settled,
      taskTranscripts: [{
        task_id: "task-failed",
        lifecycle_status: "failed",
        transcript: [{
          info: { id: "message-task-failed", sessionID: "task-session", role: "assistant" },
          parts: [{
            type: "tool",
            tool: "manage_task",
            state: { status: "completed", input: { action: "fail_task" } },
          }],
        }],
      }],
    })).toMatchObject({
      scored_terminal: true,
      mission_completed: false,
      child_tasks: [{ task_id: "task-failed", outcome: "natural_failed" }],
    })
  })

  test("rebuilds exact Mission and multi-Task lineage from the sealed relational snapshot", () => {
    const missionTranscript = [{
      info: { id: "message-mission", sessionID: "session-mission", role: "assistant", time: { created: 1, completed: 2 } },
      parts: [],
    }]
    const taskTranscripts = [
      { task_id: "task-a", transcript: [{ info: { id: "message-a", sessionID: "session-a", role: "assistant", time: { created: 3, completed: 4 } }, parts: [] }] },
      { task_id: "task-b", transcript: [{ info: { id: "message-b", sessionID: "session-b", role: "assistant", time: { created: 2, completed: 5 } }, parts: [] }] },
    ]
    const snapshot = {
      mission_id: "mission-1",
      mission_session_id: "session-mission",
      task_ids: ["task-a", "task-b"],
      missing_tables: [],
      rows: {
        session: [
          { id: "session-mission", kind: "mission", parent_id: null, metadata: JSON.stringify({ mission: { id: "mission-1", productPillar: "work" } }) },
          { id: "session-a", kind: "root", parent_id: null, metadata: null },
          { id: "session-b", kind: "root", parent_id: null, metadata: null },
        ],
        engine_task: [
          { id: "task-a", session_id: "session-a", source: "mission", product_pillar: "work", metadata: JSON.stringify({ actor: "mission", mission: { id: "mission-1", session_id: "session-mission" } }) },
          { id: "task-b", session_id: "session-b", source: "mission", product_pillar: "work", metadata: JSON.stringify({ actor: "mission", mission: { id: "mission-1", session_id: "session-mission" } }) },
        ],
        message: [
          { id: "message-mission", session_id: "session-mission" },
          { id: "message-a", session_id: "session-a" },
          { id: "message-b", session_id: "session-b" },
        ],
        benchmark_transcript_surface: [
          { surface: "mission", owner_id: "mission-1", message_id: "message-mission", session_id: "session-mission" },
          { surface: "task", owner_id: "task-a", message_id: "message-a", session_id: "session-a" },
          { surface: "task", owner_id: "task-b", message_id: "message-b", session_id: "session-b" },
        ],
        protocol_inbox: [],
        protocol_delivery_receipt: [],
        provider_usage_event: [{
          id: "usage-1",
          occurred_at: 6,
          provider_id: "openai",
          model_id: "gpt-5.6-luna",
          purpose: "session",
          input_tokens: 10,
          output_tokens: 5,
          reasoning_tokens: 2,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 17,
          cost_usd: 0,
          billing_status: "unpriced",
          session_id: "session-a",
          agent_id: "base-developer",
        }, {
          id: "usage-mission",
          occurred_at: 6,
          provider_id: "openai",
          model_id: "gpt-5.6-luna",
          purpose: "session",
          input_tokens: 8,
          output_tokens: 4,
          reasoning_tokens: 1,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 13,
          cost_usd: 0,
          billing_status: "unpriced",
          session_id: "session-mission",
          agent_id: "mission",
        }, {
          id: "usage-helper",
          occurred_at: 7,
          provider_id: "openai",
          model_id: "gpt-5.6-luna",
          purpose: "vcs-commit-message",
          input_tokens: 3,
          output_tokens: 1,
          reasoning_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 4,
          cost_usd: 0,
          billing_status: "unpriced",
          session_id: null,
          agent_id: null,
        }],
      },
    }
    expect(auditMissionEvidenceLineage({
      snapshot,
      missionID: "mission-1",
      missionSessionID: "session-mission",
      taskIDs: ["task-a", "task-b"],
      missionTranscript,
      taskTranscripts,
      flattenedTaskTranscript: [taskTranscripts[1].transcript[0], taskTranscripts[0].transcript[0]],
    })).toMatchObject({
      passed: true,
      task_transcript_flatten_matches: true,
      pending_mission_scheduler_inbox_ids: [],
    })
    expect(auditMissionEvidenceCollections({
      snapshot,
      missionSessionID: "session-mission",
      taskIDs: ["task-a", "task-b"],
      taskBoards: [
        { task_id: "task-a", board: { interactions: [] } },
        { task_id: "task-b", board: { interactions: [] } },
      ],
      taskInteractions: [
        { task_id: "task-a", interactions: [] },
        { task_id: "task-b", interactions: [] },
      ],
      flattenedInteractions: [],
      resultInteractions: [],
      providerLedger: [{
        id: "usage-1",
        occurred_at: 6,
        provider_id: "openai",
        model_id: "gpt-5.6-luna",
        purpose: "session",
        input_tokens: 10,
        output_tokens: 5,
        reasoning_tokens: 2,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_tokens: 17,
        cost_usd: 0,
        billing_status: "unpriced",
        session_id: "session-a",
        agent_id: "base-developer",
      }, {
        id: "usage-mission",
        occurred_at: 6,
        provider_id: "openai",
        model_id: "gpt-5.6-luna",
        purpose: "session",
        input_tokens: 8,
        output_tokens: 4,
        reasoning_tokens: 1,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_tokens: 13,
        cost_usd: 0,
        billing_status: "unpriced",
        session_id: "session-mission",
        agent_id: "mission",
      }, {
        id: "usage-helper",
        occurred_at: 7,
        provider_id: "openai",
        model_id: "gpt-5.6-luna",
        purpose: "vcs-commit-message",
        input_tokens: 3,
        output_tokens: 1,
        reasoning_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_tokens: 4,
        cost_usd: 0,
        billing_status: "unpriced",
        session_id: null,
        agent_id: null,
      }],
      taskTrace: [{ sessionID: "session-a", kind: "llm_request", ts: 6 }],
    })).toMatchObject({
      passed: true,
      interactions_match: true,
      provider_ledger_snapshot_matches: true,
      provider_ledger_session_lineage_matches: true,
      task_provider_usage_trace_coverage_matches: true,
    })
  })

  test("reconciles Mission child-board infrastructure incidents for zero and multiple Tasks", () => {
    const emptySnapshot = { rows: { engine_artifact: [] } }
    expect(auditTaskInfrastructureIncidents({
      snapshot: emptySnapshot,
      board: { launch_mode: "mission", tasks: [] },
    })).toMatchObject({ passed: true, sources_agree: true, incidents: [] })
    const snapshot = { rows: { engine_artifact: [{ id: "incident-1", kind: "task-infrastructure-error", payload: "{}" }] } }
    const board = {
      launch_mode: "mission",
      tasks: [
        { task_id: "task-a", board: { processIncidents: [{ id: "incident-1", source: "infrastructure" }] } },
        { task_id: "task-b", board: { processIncidents: [] } },
      ],
    }
    expect(auditTaskInfrastructureIncidents({ snapshot, board })).toMatchObject({
      passed: false,
      sources_agree: true,
      violations: ["task_infrastructure_error:1"],
    })
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
        { agent_id: "orchestrator", base_role: "orchestrator", skill_mountable: true, skill_tool_available: true },
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
      orchestrator: { effective: true, enabled: true },
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
      mounted_agents: ["base-developer", "base-planner", "base-tester", "orchestrator"],
      unmountable_agents: [
        { agent_id: "base-researcher", base_role: "explore", reason: "profile_role_not_skill_owner" },
      ],
      violations: [],
    })

    // The first five-case wave seeded `.opencorvus/skill/` and declared `skill.enabled` without
    // mounting anything, so every projected worker searched an empty Skill surface.
    expect(
      auditSkillProjection({
        profile: "base",
        matrix: matrix({
          orchestrator: { effective: false, enabled: null },
          "base-planner": { effective: false, enabled: null },
          "base-developer": { effective: false, enabled: null },
          "base-tester": { effective: false, enabled: null },
        }),
      }),
    ).toMatchObject({
      passed: false,
      mounted_agents: [],
      violations: [
        "not_effective:orchestrator",
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

  test("accepts a zero-child Mission with ledger usage and no Task-bound trace", () => {
    const missionUsage: ProviderUsageRow = {
      id: "usage-mission-only",
      occurred_at: 1,
      provider_id: "openai",
      model_id: "gpt-5.6-luna",
      purpose: "session",
      input_tokens: 10,
      output_tokens: 3,
      reasoning_tokens: 1,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 14,
      cost_usd: 0,
      billing_status: "unpriced",
      session_id: "session-mission",
      agent_id: "mission",
    }
    expect(
      auditTaskBoundPromptCompositionCoverage({
        traceEvents: [],
        providerRows: [missionUsage],
        missionSessionID: "session-mission",
      }),
    ).toMatchObject({
      passed: true,
      mission_usage_rows: 1,
      task_usage_rows: 0,
      request_events: 0,
      violations: [],
    })
  })

  test("audits a failed Task Provider attempt from its fingerprinted request even without usage", () => {
    const promptComposition = {
      blocks: [],
      systemBlocks: 0,
      messageBlocks: 0,
      toolCount: 0,
      toolNames: [],
      totalChars: 0,
      totalTokensEst: 0,
      compositionSha256: "failed-task-attempt",
    }
    expect(
      auditTaskBoundPromptCompositionCoverage({
        traceEvents: [{
          kind: "llm_request",
          sessionID: "session-task",
          agentName: "base-developer",
          payload: { promptComposition },
        }],
        providerRows: [],
        missionSessionID: "session-mission",
      }),
    ).toMatchObject({
      passed: true,
      task_usage_rows: 0,
      request_events: 1,
      fingerprinted_events: 1,
      request_attempts_without_usage: 1,
      violations: [],
    })
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
          agent_id: "orchestrator",
          base_role: "orchestrator",
          skill_mountable: true,
          skill_tool_available: true,
        },
        {
          agent_id: "requirement-engineer",
          base_role: "requirements",
          skill_mountable: true,
          skill_tool_available: true,
        },
        {
          agent_id: "solution-architect",
          base_role: "architect",
          skill_mountable: true,
          skill_tool_available: true,
        },
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
          base_role: "delegated-worker",
          skill_mountable: true,
          skill_tool_available: true,
        },
      ],
      matrix: [
        {
          agent_id: "orchestrator",
          grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
        },
        {
          agent_id: "requirement-engineer",
          grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
        },
        {
          agent_id: "solution-architect",
          grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
        },
        {
          agent_id: "source-investigator",
          grants: [{ ref: "default/skill/automationbench-api", effective: true, enabled: true }],
        },
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
      ...["orchestrator", "requirement-engineer", "solution-architect", "source-investigator"].map((agent) => ({
        info: { agent, role: "assistant", sessionID: `ses_${agent}` },
        parts: [
          {
            type: "tool",
            tool: "skill",
            state: { status: "completed", input: { name: "automationbench-api" } },
          },
          ...(agent === "source-investigator"
            ? [
                {
                  type: "tool",
                  tool: "bash",
                  state: {
                    status: "completed",
                    input: { command: "python3 automationbench_tool.py fetch GET https://api/read" },
                  },
                },
              ]
            : []),
        ],
      })),
      {
        info: { agent: "implementation-engineer", role: "assistant", sessionID: "ses_impl" },
        parts: [
          {
            type: "tool",
            tool: "skill",
            state: { status: "completed", input: { name: "automationbench-api" } },
          },
        ],
      },
      {
        info: { agent: "implementation-engineer", role: "assistant", sessionID: "ses_impl" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            state: {
              status: "completed",
              input: {
                command: "rg automationbench_tool.py README.md",
                description: "Inspect documentation that mentions python3 automationbench_tool.py",
              },
            },
          },
          {
            type: "tool",
            tool: "bash",
            state: { status: "completed", input: { command: "python3 automationbench_tool.py search contacts" } },
          },
        ],
      },
      {
        info: { agent: "test-engineer", role: "assistant", sessionID: "ses_test" },
        parts: [
          {
            type: "tool",
            tool: "skill",
            state: { status: "completed", input: { name: "automationbench-api" } },
          },
        ],
      },
      {
        info: { agent: "test-engineer", role: "assistant", sessionID: "ses_test" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            state: { status: "completed", input: { command: "python3 automationbench_tool.py fetch GET https://api" } },
          },
        ],
      },
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
    ).toMatchObject({
      passed: true,
      coverage: {
        passed: true,
        runtime_adherence_passed: true,
        dispatched_owner_sessions: [
          { agent_id: "implementation-engineer", session_id: "ses_impl" },
          { agent_id: "orchestrator", session_id: "ses_orchestrator" },
          { agent_id: "requirement-engineer", session_id: "ses_requirement-engineer" },
          { agent_id: "solution-architect", session_id: "ses_solution-architect" },
          { agent_id: "source-investigator", session_id: "ses_source-investigator" },
          { agent_id: "test-engineer", session_id: "ses_test" },
        ],
        successful_skill_loads: [
          { agent_id: "orchestrator", session_id: "ses_orchestrator" },
          { agent_id: "requirement-engineer", session_id: "ses_requirement-engineer" },
          { agent_id: "solution-architect", session_id: "ses_solution-architect" },
          { agent_id: "source-investigator", session_id: "ses_source-investigator" },
          { agent_id: "implementation-engineer", session_id: "ses_impl" },
          { agent_id: "test-engineer", session_id: "ses_test" },
        ],
        benchmark_client_attempts: [
          { agent_id: "source-investigator", session_id: "ses_source-investigator", status: "completed" },
          { agent_id: "implementation-engineer", session_id: "ses_impl", status: "completed" },
          { agent_id: "test-engineer", session_id: "ses_test", status: "completed" },
        ],
        violations: [],
        runtime_adherence_violations: [],
      },
      violations: [],
    })

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

    const legacySkill = {
      ...skill,
      dispatched_coverage: {
        passed: true,
        dispatched_agents: coverage.dispatched_agents,
        uncovered_agents: [],
      },
    }
    expect(
      auditSkillEvidenceSeal({
        profile: "advanced",
        resultSkill: legacySkill,
        projectionFile: { ...projectionFile, skill: legacySkill },
        transcript,
      }),
    ).toMatchObject({
      passed: false,
      violations: ["receipt_coverage_mismatch", "result_coverage_mismatch"],
    })
  })

  test("rejects a run whose transcript shows an Agent the Skill projection never described", () => {
    const projection = {
      mounted_agents: [
        "implementation-engineer",
        "orchestrator",
        "requirement-engineer",
        "solution-architect",
        "source-investigator",
        "test-engineer",
      ],
      unmountable_agents: [],
    }
    // This fixture isolates projection accounting: user Messages prove dispatch identity, while the
    // preceding sealed-receipt fixture owns assistant runtime-load and command-order evidence.
    const transcript = (agents: string[]) =>
      agents.map((agent, index) => ({ info: { agent, role: "user", sessionID: `ses_projection_${index}` } }))

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

  test("preserves official scoring while reporting explicit Skill runtime non-adherence", () => {
    const projection = {
      skill_name: "automationbench-api",
      mounted_agents: ["base-developer", "base-tester"],
      unmountable_agents: [{ agent_id: "orchestrator" }],
    }
    const transcript = [
      {
        info: { agent: "base-developer", role: "assistant", sessionID: "ses_developer" },
        parts: [
          {
            type: "tool",
            tool: "skill",
            state: { status: "error", input: { name: "automationbench-api" } },
          },
          {
            type: "tool",
            tool: "bash",
            state: { status: "error", input: { command: "python3 automationbench_tool.py search leads" } },
          },
          {
            type: "tool",
            tool: "skill",
            state: { status: "completed", input: { name: "automationbench-api" } },
          },
        ],
      },
      {
        info: { agent: "base-tester", role: "assistant", sessionID: "ses_tester_load" },
        parts: [
          {
            type: "tool",
            tool: "skill",
            state: { status: "completed", input: { name: "automationbench-api" } },
          },
        ],
      },
      {
        info: { agent: "base-tester", role: "assistant", sessionID: "ses_tester_client" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            state: { status: "completed", input: { command: "python3 automationbench_tool.py fetch GET https://api" } },
          },
        ],
      },
      {
        info: { agent: "orchestrator", role: "assistant", sessionID: "ses_orchestrator" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            state: { status: "completed", input: { command: "python3 automationbench_tool.py search leads" } },
          },
        ],
      },
    ]
    const coverage = auditDispatchedSkillCoverage({
      projection,
      transcript,
    })

    expect(coverage).toMatchObject({
      passed: true,
      runtime_adherence_passed: false,
      missing_skill_loads: [{ agent_id: "base-tester", session_id: "ses_tester_client" }],
      client_before_skill_load: [
        { agent_id: "base-developer", session_id: "ses_developer", status: "error" },
        { agent_id: "base-tester", session_id: "ses_tester_client", status: "completed" },
      ],
      unmounted_client_attempts: [
        { agent_id: "orchestrator", session_id: "ses_orchestrator", status: "completed" },
      ],
      violations: [],
      runtime_adherence_violations: [
        "missing_skill_load:base-tester:ses_tester_client",
        "client_before_skill_load:base-developer:ses_developer:0:1",
        "client_before_skill_load:base-tester:ses_tester_client:2:0",
        "client_by_unmounted_agent:orchestrator:ses_orchestrator:3:0",
      ],
    })
    const naturalOutcome = auditTaskOutcome("failed", [
      ...transcript,
      {
        parts: [
          {
            type: "tool",
            tool: "manage_task",
            state: { status: "completed", input: { action: "fail_task" } },
          },
        ],
      },
    ])
    expect(naturalOutcome).toMatchObject({ passed: true, scored_terminal: true, outcome: "natural_failed" })
    expect(
      automationBenchRunValidity({
        taskOutcomePassed: naturalOutcome.scored_terminal,
        profilePassed: true,
        isolationPassed: true,
        promptCompositionPassed: true,
        skillProjectionPassed: true,
        skillCoveragePassed: coverage.passed,
        skillRuntimeAdherencePassed: coverage.runtime_adherence_passed,
      }),
    ).toEqual({ valid: true, runtime_adherence_passed: false })
  })

  test("seals the last successful failed-run observation or a typed unavailable receipt", () => {
    const transcript = [
      {
        info: { agent: "base-developer", role: "assistant", sessionID: "ses_developer" },
        parts: [
          {
            type: "tool",
            tool: "skill",
            state: { status: "completed", input: { name: "automationbench-api" } },
          },
        ],
      },
      {
        info: { agent: "base-developer", role: "assistant", sessionID: "ses_developer" },
        parts: [
          {
            type: "tool",
            tool: "bash",
            state: { status: "completed", input: { command: "python3 automationbench_tool.py search leads" } },
          },
        ],
      },
    ]
    expect(
      failureObservationReceipt({
        runID: "run_captured",
        runKey: "key_captured",
        taskID: "task_captured",
        capturedAt: 123,
        projection: {
          skill_name: "automationbench-api",
          mounted_agents: ["base-developer"],
          unmountable_agents: [{ agent_id: "orchestrator" }],
        },
        observation: {
          transcript,
          trace: [{ kind: "llm" }],
          interactions: [],
          benchmarkEvents: [{ kind: "tool" }],
        },
      }),
    ).toMatchObject({
      status: "captured",
      reason: "last_successful_public_observation",
      captured_at: 123,
      message_count: 2,
      trace_event_count: 1,
      benchmark_event_count: 1,
      skill_runtime_coverage: {
        passed: true,
        runtime_adherence_passed: true,
        successful_skill_loads: [{ agent_id: "base-developer", session_id: "ses_developer" }],
        benchmark_client_attempts: [{ agent_id: "base-developer", session_id: "ses_developer" }],
      },
    })
    expect(
      failureObservationReceipt({
        runID: "run_unavailable",
        runKey: "key_unavailable",
        capturedAt: 456,
      }),
    ).toEqual({
      schema_version: 1,
      run_id: "run_unavailable",
      run_key: "key_unavailable",
      task_id: null,
      mission_id: null,
      mission_session_id: null,
      task_ids: [],
      status: "unavailable",
      reason: "mission_not_created",
      captured_at: null,
      message_count: 0,
      mission_message_count: 0,
      task_message_count: 0,
      trace_event_count: 0,
      interaction_count: 0,
      benchmark_event_count: 0,
      skill_runtime_coverage: null,
    })
    expect(
      failureObservationReceipt({
        runID: "run_unobserved",
        runKey: "key_unobserved",
        taskID: "task_unobserved",
        capturedAt: 789,
      }),
    ).toMatchObject({
      task_id: "task_unobserved",
      status: "unavailable",
      reason: "no_successful_observation",
      captured_at: null,
      skill_runtime_coverage: null,
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

  test("maps one or two missing manifest batches onto one coordinator invocation", () => {
    expect(automationBenchCoordinatorBatchIndexes("14")).toEqual([14])
    expect(automationBenchCoordinatorBatchIndexes("14,15")).toEqual([14, 15])
    expect(automationBenchCoordinatorBatchIndexes("14,16")).toEqual([14, 16])
    expect(() => automationBenchCoordinatorBatchIndexes("15,14")).toThrow(
      "Batch coordinator requires one positive batch or two ascending distinct batches",
    )
    expect(() => automationBenchCoordinatorBatchIndexes("14,14")).toThrow(
      "Batch coordinator requires one positive batch or two ascending distinct batches",
    )
  })

  test("settles sibling receipts independently and keeps both plans anchored on the dashboard", () => {
    expect(
      automationBenchCoordinatorSettlement([
        { batch_index: 14, complete: true },
        { batch_index: 15, complete: false },
      ]),
    ).toEqual({
      complete: false,
      failed_batch_indexes: [15],
      status_by_batch: { 14: "completed", 15: "failed" },
    })
    expect(
      activeAutomationBenchBatchRunIDs(
        [{ batch_run_id: "batch-14" }],
        [{ batch_run_id: "batch-14" }, { batch_run_id: "batch-15" }],
      ),
    ).toEqual(new Set(["batch-14", "batch-15"]))
  })

  test("admits two independent five-case batches up to ten shared trial leases", () => {
    const candidate = (caseIndex: number, batchIndex: number) => ({
      run_id: `run-${caseIndex}`,
      pid: caseIndex,
      case_id: `domain:task-${caseIndex}`,
      profile: "base" as const,
      started_at: caseIndex,
      batch_run_id: `batch-${batchIndex}`,
      batch_index: batchIndex,
      batch_plan_sha256: String(batchIndex).repeat(64),
    })
    let active: AutomationBenchTrialLease[] = []
    for (const caseIndex of [56, 57, 58, 59, 60, 61, 62, 63, 64, 65]) {
      const batchIndex = caseIndex <= 60 ? 12 : 13
      const result = acquireAutomationBenchTrialLease({
        active,
        candidate: candidate(caseIndex, batchIndex),
        maxConcurrent: 10,
        maxPerBatch: 5,
      })
      expect(result.acquired).toBe(true)
      active = result.active
    }
    expect({
      total: active.length,
      batch12: active.filter((item) => item.batch_index === 12).length,
      batch13: active.filter((item) => item.batch_index === 13).length,
      cases: active.map((item) => item.case_id),
      eleventh: acquireAutomationBenchTrialLease({
        active,
        candidate: candidate(66, 14),
        maxConcurrent: 10,
        maxPerBatch: 5,
      }),
    }).toEqual({
      total: 10,
      batch12: 5,
      batch13: 5,
      cases: Array.from({ length: 10 }, (_, offset) => `domain:task-${offset + 56}`),
      eleventh: { acquired: false, reason: "global_concurrency_exhausted", active },
    })
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
      opencorvus: { profile: "base", model: "openai/gpt-5.6-luna", launch_mode: "mission" },
    }))
    expect(
      auditBatchEvidence({
        plan: {
          schema_version: 1,
          batch_run_id: "batch-2",
          model: "openai/gpt-5.6-luna",
          launch_mode: "mission",
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

  test("preserves and excludes the exact five-run wrong-repetition incident", () => {
    const cases = [1, 2, 3, 4, 5].map((case_index) => ({ case_index }))
    const wave = cases.map((item) => ({ ...item, profile: "base" }))
    const launched = wave.map((item) => ({ ...item, run_id: `wrong-repetition-${item.case_index}` }))
    const plan = {
      schema_version: 2,
      batch_run_id: "wrong-repetition-batch",
      batch_index: 1,
      repetition: 2,
      model: "openai/gpt-5.6-luna",
      launch_mode: "mission",
      profiles: ["base"],
      trial_concurrency: 5,
      schedule_mode: "rolling_case_slots_v1",
      cases,
      waves: [wave],
    }
    const attempts = launched.map((item) => ({
      run_id: item.run_id,
      benchmark: {
        batch_run_id: plan.batch_run_id,
        batch_plan_sha256: "wrong-repetition-plan-sha",
        batch_index: 1,
        wave_index: 1,
        case_index: item.case_index,
        repetition: 2,
      },
      opencorvus: { profile: "base", model: plan.model, launch_mode: "mission" },
    }))
    const dispositions = Object.fromEntries(
      launched.map((item) => [
        item.run_id,
        { status: "invalid_bug", reason: "wrong_test_set_repetition" },
      ]),
    )
    expect(
      auditExcludedWrongExperimentBatch({
        plan,
        receipt: {
          batch_run_id: plan.batch_run_id,
          batch_index: 1,
          repetition: 2,
          status: "failed",
          wave_1: { launched, eligible: [] },
        },
        attempts,
        dispositions,
        model: plan.model,
        planSHA256: "wrong-repetition-plan-sha",
      }),
    ).toEqual({
      passed: true,
      run_ids: launched.map((item) => item.run_id).sort(),
      violations: [],
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
      opencorvus: { profile: "base", model: "openai/gpt-5.6-luna", launch_mode: "mission" },
    }))
    const audit = auditBatchEvidence({
      plan: {
        schema_version: 1,
        batch_run_id: "batch-posthoc-host-fault",
        model: "openai/gpt-5.6-luna",
        launch_mode: "mission",
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

  test("preserves sealed siblings when one coordinator slot never produces a run identity", () => {
    const cases = [1, 2, 3, 4, 5].map((case_index) => ({ case_index }))
    const wave = cases.map((item) => ({ ...item, profile: "base" }))
    const successful = [1, 3, 4, 5].map((case_index) => ({
      case_index,
      profile: "base",
      run_id: `sealed-${case_index}`,
      exit_code: 0,
      run_status: "scored",
    }))
    const attempts = successful.map((item) => ({
      run_id: item.run_id,
      raw_leaderboard_eligible: true,
      leaderboard_eligible: true,
      started_at: 100,
      finished_at: 200 + item.case_index,
      benchmark: {
        batch_run_id: "batch-unstarted-sibling",
        batch_plan_sha256: "unstarted-plan-sha",
        wave_index: 1,
        case_index: item.case_index,
      },
      opencorvus: { profile: "base", model: "openai/gpt-5.6-luna", launch_mode: "mission" },
    }))
    const audit = auditBatchEvidence({
      plan: {
        schema_version: 2,
        repetition: 1,
        batch_run_id: "batch-unstarted-sibling",
        batch_index: 1,
        model: "openai/gpt-5.6-luna",
        launch_mode: "mission",
        trial_concurrency: 5,
        schedule_mode: "rolling_case_slots_v1",
        profiles: ["base"],
        cases,
        waves: [wave],
        preexisting_eligible: { base: [], advanced: [] },
      },
      receipt: {
        batch_run_id: "batch-unstarted-sibling",
        batch_index: 1,
        status: "failed",
        wave_1: {
          launched: [
            ...successful,
            {
              case_index: 2,
              profile: "base",
              run_id: null,
              exit_code: -1,
              run_status: "coordinator_failed",
            },
          ],
          eligible: successful,
        },
      },
      attempts,
      planSHA256: "unstarted-plan-sha",
    })

    expect({ audit, reusable: reusableBatchCandidateRunIDs(audit) }).toEqual({
      audit: {
        passed: false,
        status: "invalid",
        reasons: ["launched_trial_unstarted:base:2"],
        eligible_run_ids: successful.map((item) => item.run_id).sort(),
        sealing_run_ids: successful.map((item) => item.run_id).sort(),
        adopted_run_ids: [],
      },
      reusable: successful.map((item) => item.run_id).sort(),
    })
    expect(
      reusableBatchCandidateRunIDs({ ...audit, reasons: ["launched_trial:base:2"] }),
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

  test("accepts all 120 completed Base batch receipts for the unique-case matrix", () => {
    const batches = Array.from({ length: 120 }, (_, offset) => ({
      profiles: ["base"],
      receipt: { batch_index: offset + 1 },
      audit: { passed: true, status: "completed" },
    }))
    expect(
      missingCompletedBatchProfileReceipts({
        batches,
        batchIndexes: Array.from({ length: 120 }, (_, offset) => offset + 1),
        profiles: ["base"],
      }),
    ).toEqual([])
  })

  test("projects one root-private WSL network authority across every benchmark supervisor", async () => {
    const scriptRoot = path.resolve(import.meta.dir, "../../script/benchmark/external-agent")
    const helperPath = path.join(scriptRoot, "load-automationbench-environment.sh")
    const [helper, ...supervisors] = await Promise.all([
      fs.readFile(helperPath, "utf8"),
      fs.readFile(path.join(scriptRoot, "run-sol-mission-base-50.sh"), "utf8"),
      fs.readFile(path.join(scriptRoot, "run-luna-mission-base-cases-51-600.sh"), "utf8"),
      fs.readFile(path.join(scriptRoot, "run-luna-mission-advanced-50.sh"), "utf8"),
    ])
    const sourcePath = (script: string) =>
      script.match(/^\. (packages\/opencorvus\/script\/benchmark\/external-agent\/load-automationbench-environment\.sh)$/m)?.[1]
    const exports = Array.from(
      helper.matchAll(/^export (AUTOMATIONBENCH_PROXY_URL|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)(?:=(.+))?$/gm),
      ([, name, value]) => ({ name, value }),
    )

    expect({
      supervisorEnvironmentOwners: supervisors.map(sourcePath),
      providerDataRoot: helper.match(/^provider_data_root=(.+)$/m)?.[1],
      environmentFiles: Array.from(helper.matchAll(/^\. "\$provider_data_root\/(.+\.env)"$/gm), ([, name]) => name),
      gatewayProjection: helper.match(/^automationbench_windows_host=(.+)$/m)?.[1],
      proxyProjection: helper.match(/^AUTOMATIONBENCH_PROXY_URL=(.+)$/m)?.[1],
      exports,
    }).toEqual({
      supervisorEnvironmentOwners: Array(3).fill(
        "packages/opencorvus/script/benchmark/external-agent/load-automationbench-environment.sh",
      ),
      providerDataRoot: "/var/lib/opencorvus-benchmark/provider-data",
      environmentFiles: ["exa.env", "network.env"],
      gatewayProjection: '"$(ip -4 route show default | awk \'NR == 1 { print $3; exit }\')"',
      proxyProjection: '"http://${automationbench_windows_host}:${AUTOMATIONBENCH_PROXY_PORT}"',
      exports: [
        { name: "AUTOMATIONBENCH_PROXY_URL", value: '"$AUTOMATIONBENCH_PROXY_URL"' },
        { name: "HTTP_PROXY", value: '"$AUTOMATIONBENCH_PROXY_URL"' },
        { name: "HTTPS_PROXY", value: '"$AUTOMATIONBENCH_PROXY_URL"' },
        { name: "ALL_PROXY", value: '"$AUTOMATIONBENCH_PROXY_URL"' },
        { name: "NO_PROXY", value: '"${AUTOMATIONBENCH_NO_PROXY:-127.0.0.1,localhost}"' },
      ],
    })
  })

  test("installs and selects the case-range restricted-shell authorities before every supervisor", async () => {
    const scriptRoot = path.resolve(import.meta.dir, "../../script/benchmark/external-agent")
    const [installer, solBase, lunaExtended, lunaAdvanced] = await Promise.all([
      fs.readFile(path.join(scriptRoot, "install-automationbench-restricted-shells.sh"), "utf8"),
      fs.readFile(path.join(scriptRoot, "run-sol-mission-base-50.sh"), "utf8"),
      fs.readFile(path.join(scriptRoot, "run-luna-mission-base-cases-51-600.sh"), "utf8"),
      fs.readFile(path.join(scriptRoot, "run-luna-mission-advanced-50.sh"), "utf8"),
    ])
    const installationCall =
      "packages/opencorvus/script/benchmark/external-agent/install-automationbench-restricted-shells.sh"

    expect({
      installerProjectsBase: installer.includes('"$install_root/restricted-agent-shell-base"'),
      installerProjectsExtended: installer.includes('"$install_root/restricted-agent-shell"'),
      installerConcurrencyAuthority: {
        sharedLock: installer.includes('exec 9>"$install_root/restricted-shell-install.lock"'),
        exclusiveLock: installer.includes("flock -x 9"),
        sameDirectoryTemporary: installer.includes('local temporary="${target}.$$.tmp"'),
        atomicProjection: installer.includes('mv -f -- "$temporary" "$target"'),
      },
      installationCalls: [solBase, lunaExtended, lunaAdvanced].map((script) => script.includes(installationCall)),
      installationAfterSupervisorLock: [solBase, lunaExtended, lunaAdvanced].map(
        (script) => script.indexOf("flock -n 9") < script.indexOf(installationCall),
      ),
      signalSettlement: [solBase, lunaExtended, lunaAdvanced].map((script) =>
        script.includes("trap - INT TERM HUP") && script.includes("trap terminate_supervisor INT TERM HUP"),
      ),
      solBaseAuthority: Array.from(solBase.matchAll(/--restricted-shell (.+)$/gm), ([, value]) => value),
      lunaExtendedAuthority: Array.from(lunaExtended.matchAll(/--restricted-shell (.+)$/gm), ([, value]) => value),
      lunaAdvancedAuthority: Array.from(lunaAdvanced.matchAll(/--restricted-shell (.+)$/gm), ([, value]) => value),
    }).toEqual({
      installerProjectsBase: true,
      installerProjectsExtended: true,
      installerConcurrencyAuthority: {
        sharedLock: true,
        exclusiveLock: true,
        sameDirectoryTemporary: true,
        atomicProjection: true,
      },
      installationCalls: [true, true, true],
      installationAfterSupervisorLock: [true, true, true],
      signalSettlement: [true, true, true],
      solBaseAuthority: Array(2).fill("/var/lib/opencorvus-benchmark/restricted-agent-shell-base \\"),
      lunaExtendedAuthority: Array(2).fill("/var/lib/opencorvus-benchmark/restricted-agent-shell \\"),
      lunaAdvancedAuthority: Array(2).fill("/var/lib/opencorvus-benchmark/restricted-agent-shell-base \\"),
    })
  })

  test("binds the Luna Mission Base continuation to unique cases 51 through 600", async () => {
    const script = await fs.readFile(
      path.resolve(import.meta.dir, "../../script/benchmark/external-agent/run-luna-mission-base-cases-51-600.sh"),
      "utf8",
    )
    const coordinator = await fs.readFile(
      path.resolve(import.meta.dir, "../../script/benchmark/external-agent/run-automationbench-batch.ts"),
      "utf8",
    )
    const assignment = (name: string) => script.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]
    const lines = script.split(/\r?\n/)
    const invocations: Array<{ entry: string | undefined; args: Record<string, string> }> = []
    for (let index = 0; index < lines.length; index++) {
      if (lines[index]?.trim() !== "/root/.bun/bin/bun \\") continue
      const command: string[] = []
      for (index += 1; index < lines.length; index++) {
        const raw = lines[index]!.trim()
        const continued = raw.endsWith("\\")
        command.push(raw.replace(/ \\$/, "").replace(/ &$/, ""))
        if (!continued) break
      }
      const args: Record<string, string> = {}
      for (const item of command.slice(1)) {
        const match = item.match(/^--([^ ]+) (.+)$/)
        if (match) args[match[1]!] = match[2]!
      }
      invocations.push({ entry: command[0], args })
    }

    expect({
      evidenceRoot: assignment("evidence_root"),
      controlRoot: assignment("control_root"),
      dashboardRoot: assignment("dashboard_root"),
      caseSet: assignment("case_set"),
      supervisorLock: script.match(/^exec 9>"(.+)"$/m)?.[1],
      batchRange: script.includes("for batch_index in {11..120}; do"),
      groupedBatchLimit: script.match(/-eq ([0-9]+) \]\]; then/)?.[1],
      singleCoordinator: script.includes('active_coordinator="$!"') && !script.includes("active_coordinators=("),
      batchScopedAuthorization: coordinator.includes("`active-batch-${selected.batchIndex}.json`"),
      allPlansAnchored: coordinator.includes('contexts.map((context) => context.planPath).join(",")'),
      serializedCatalog: coordinator.includes('path.join(controlRoot, "catalog.lock")'),
      catalogLockWaits: coordinator.includes("retries: { retries: 900, factor: 1, minTimeout: 1_000, maxTimeout: 1_000 }"),
      invocations,
      resumeIdentityOwner: script.includes("automationBenchBatchPlanMatches(plan"),
    }).toEqual({
      evidenceRoot: "/var/lib/opencorvus-benchmark/evidence-luna-mission-base-v20260822-r3",
      controlRoot: "/var/lib/opencorvus-benchmark/control-luna-mission-base-v20260822-r3",
      dashboardRoot: "/mnt/d/myhexin-local/opencorvus-benchmark-results/luna-mission-base-v20260822-r3",
      caseSet: "packages/opencorvus/script/benchmark/external-agent/automationbench-case-set-600.json",
      supervisorLock: "$control_root/supervisor.lock",
      batchRange: true,
      groupedBatchLimit: "2",
      singleCoordinator: true,
      batchScopedAuthorization: true,
      allPlansAnchored: true,
      serializedCatalog: true,
      catalogLockWaits: true,
      invocations: [
        {
          entry: "packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts",
          args: {
            python: "/var/lib/opencorvus-benchmark/evaluator-venv/bin/python",
            "source-data": "/var/lib/opencorvus-benchmark/provider-data",
            output: '"$evidence_root"',
            "restricted-shell": "/var/lib/opencorvus-benchmark/restricted-agent-shell",
            "control-root": '"$control_root"',
            dashboard: '"$dashboard_root/index.html"',
            "case-set": '"$case_set"',
            "batch-index": '"$batch_indices"',
            repetition: "1",
            model: "openai/gpt-5.6-luna",
            profiles: "base",
            "inactivity-ms": "600000",
          },
        },
        {
          entry: "packages/opencorvus/script/benchmark/external-agent/verify-automationbench-evidence.ts",
          args: {
            root: '"$evidence_root"',
            "source-data": "/var/lib/opencorvus-benchmark/provider-data",
            python: "/var/lib/opencorvus-benchmark/evaluator-venv/bin/python",
            "restricted-shell": "/var/lib/opencorvus-benchmark/restricted-agent-shell",
            "case-set": '"$case_set"',
            model: "openai/gpt-5.6-luna",
            profiles: "base",
            repetition: "1",
            mode: "final",
          },
        },
      ],
      resumeIdentityOwner: true,
    })
  })

  test("binds the dedicated Luna Mission Advanced supervisor to its isolated 50-case round", async () => {
    const script = await fs.readFile(
      path.resolve(import.meta.dir, "../../script/benchmark/external-agent/run-luna-mission-advanced-50.sh"),
      "utf8",
    )
    const assignment = (name: string) => script.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]
    const lines = script.split(/\r?\n/)
    const invocations: Array<{ entry: string | undefined; args: Record<string, string> }> = []
    for (let index = 0; index < lines.length; index++) {
      if (lines[index]?.trim() !== "/root/.bun/bin/bun \\") continue
      const command: string[] = []
      for (index += 1; index < lines.length; index++) {
        const raw = lines[index]!.trim()
        const continued = raw.endsWith("\\")
        command.push(raw.replace(/ \\$/, "").replace(/ &$/, ""))
        if (!continued) break
      }
      const args: Record<string, string> = {}
      for (const item of command.slice(1)) {
        const match = item.match(/^--([^ ]+) (.+)$/)
        if (match) args[match[1]!] = match[2]!
      }
      invocations.push({ entry: command[0], args })
    }

    expect({
      evidenceRoot: assignment("evidence_root"),
      controlRoot: assignment("control_root"),
      dashboardRoot: assignment("dashboard_root"),
      invocations,
      batchRange: script.match(/^for batch_index in (.+); do$/m)?.[1],
      startEvent: script.includes('"event":"luna_advanced_batch_start"'),
      completionEvent: script.includes('"event":"luna_advanced_batch_complete"'),
      resumeIdentityOwner: script.includes("automationBenchBatchPlanMatches(plan"),
    }).toEqual({
      evidenceRoot: "/var/lib/opencorvus-benchmark/evidence-luna-mission-advanced-v20260824-r1",
      controlRoot: "/var/lib/opencorvus-benchmark/control-luna-mission-advanced-v20260824-r1",
      dashboardRoot: "/mnt/d/myhexin-local/opencorvus-benchmark-results/luna-mission-advanced-v20260824-r1",
      invocations: [
        {
          entry: "packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts",
          args: {
            python: "/var/lib/opencorvus-benchmark/evaluator-venv/bin/python",
            "source-data": "/var/lib/opencorvus-benchmark/provider-data",
            output: '"$evidence_root"',
            "restricted-shell": "/var/lib/opencorvus-benchmark/restricted-agent-shell-base",
            "control-root": '"$control_root"',
            dashboard: '"$dashboard_root/index.html"',
            "batch-index": '"$batch_index"',
            repetition: "1",
            model: "openai/gpt-5.6-luna",
            profiles: "advanced",
            "inactivity-ms": "600000",
          },
        },
        {
          entry: "packages/opencorvus/script/benchmark/external-agent/verify-automationbench-evidence.ts",
          args: {
            root: '"$evidence_root"',
            "source-data": "/var/lib/opencorvus-benchmark/provider-data",
            python: "/var/lib/opencorvus-benchmark/evaluator-venv/bin/python",
            "restricted-shell": "/var/lib/opencorvus-benchmark/restricted-agent-shell-base",
            model: "openai/gpt-5.6-luna",
            profiles: "advanced",
            repetition: "1",
            mode: "final",
          },
        },
      ],
      batchRange: "{1..10}",
      startEvent: true,
      completionEvent: true,
      resumeIdentityOwner: true,
    })
  })

  test("projects and matches the complete Luna Mission Advanced batch-plan identity", () => {
    const plan = {
      schema_version: 2,
      batch_index: 4,
      model: "openai/gpt-5.6-luna",
      launch_mode: "mission",
      repetition: 1,
      trial_concurrency: 5,
      schedule_mode: "rolling_case_slots_v1",
      profiles: ["advanced"],
      cases: Array.from({ length: 5 }, (_, offset) => ({ case_index: 16 + offset })),
    }
    const expected = {
      schema_version: 2,
      batch_index: 4,
      model: "openai/gpt-5.6-luna",
      launch_mode: "mission",
      repetition: 1,
      trial_concurrency: 5,
      schedule_mode: "rolling_case_slots_v1",
      profiles: ["advanced"],
      case_count: 5,
    }
    expect(automationBenchBatchPlanIdentity(plan)).toEqual(expected)
    expect(automationBenchBatchPlanMatches(plan, expected)).toBe(true)
  })

  test("maps legacy, current, and unsupported batch-plan schemas to the explicit audit contract", () => {
    expect([
      auditAutomationBenchBatchPlanSchema({ schema_version: 1 }),
      auditAutomationBenchBatchPlanSchema({ schema_version: 2, repetition: 1 }),
      auditAutomationBenchBatchPlanSchema({ schema_version: 2 }),
      auditAutomationBenchBatchPlanSchema({ schema_version: 3, repetition: 1 }),
      auditAutomationBenchBatchPlanSchema({ schema_version: "1" }),
      auditAutomationBenchBatchPlanSchema({ schema_version: "2", repetition: "1" }),
    ]).toEqual([
      { passed: true, schema_version: 1, repetition: null, legacy: true, reason: null },
      { passed: true, schema_version: 2, repetition: 1, legacy: false, reason: null },
      { passed: false, schema_version: 2, repetition: null, legacy: false, reason: "batch_plan_schema" },
      { passed: false, schema_version: 3, repetition: 1, legacy: false, reason: "batch_plan_schema" },
      { passed: false, schema_version: null, repetition: null, legacy: false, reason: "batch_plan_schema" },
      { passed: false, schema_version: null, repetition: null, legacy: false, reason: "batch_plan_schema" },
    ])
  })

  test("keeps the plan-selected sealed run when an accidental current duplicate exists", () => {
    const selected = { run_id: "sealed-61", benchmark: { case_index: 61 } }
    const duplicate = { run_id: "duplicate-61", benchmark: { case_index: 61 } }
    expect(
      reconcileAutomationBenchBatchCandidates({
        profile: "base",
        preexisting: [selected],
        current: [duplicate],
      }),
    ).toEqual(new Map([[61, selected]]))
    expect(() =>
      reconcileAutomationBenchBatchCandidates({
        profile: "base",
        preexisting: [],
        current: [selected, duplicate],
      }),
    ).toThrow("Multiple eligible candidates exist for base case 61")
  })

  test("reuses verified profile rows before failed-batch candidates", () => {
    const record = (run_id: string, case_index: number) => ({
      run_id,
      benchmark: { case_index, repetition: 1 },
      opencorvus: { profile: "base", model: "openai/gpt-5.6-luna", launch_mode: "mission" },
    })
    const reusable = reusableProfileRuns(
      {
        leaderboard: [record("verified-1", 1)],
        candidates: [
          record("superseded-candidate-1", 1),
          record("candidate-2", 2),
          {
            ...record("direct-task-candidate-3", 3),
            opencorvus: { profile: "base", model: "openai/gpt-5.6-luna", launch_mode: "task" },
          },
          {
            ...record("terra-mission-candidate-4", 4),
            opencorvus: { profile: "base", model: "openai/gpt-5.6-terra", launch_mode: "mission" },
          },
        ],
      },
      "base",
      "openai/gpt-5.6-luna",
      "mission",
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
