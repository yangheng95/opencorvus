import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  acquireBenchmarkResourceWithAdmission,
  createBenchmarkAdmissionGate,
  auditBatchEvidence,
  auditAutomationBenchBatchPublication,
  auditAutomationBenchBatchSettlement,
  auditAutomationBenchTerminalCohortIdentity,
  mapSettledWithBoundedConcurrency,
  settlePendingSnapshotAfterRefresh,
} from "../../script/benchmark/external-agent/contract"
import { inspectAutomationBenchTerminalCostEvidence } from "../../script/benchmark/external-agent/terminal-cost-evidence"

test("termination closes admission after an awaited authorization boundary", async () => {
  const admission = createBenchmarkAdmissionGate("Batch coordinator")
  let releaseAuthorization!: () => void
  const authorization = new Promise<void>((resolve) => {
    releaseAuthorization = resolve
  })
  const starts: number[] = []
  const scheduled = mapSettledWithBoundedConcurrency(
    [1],
    1,
    async (value) => {
      admission.assertOpen()
      await authorization
      admission.assertOpen()
      starts.push(value)
      return value
    },
    { shouldStart: admission.isOpen },
  )
  admission.request("SIGTERM")
  releaseAuthorization()

  expect(await scheduled).toEqual([
    { status: "rejected", reason: new Error("Batch coordinator received SIGTERM") },
  ])
  expect(starts).toEqual([])
})

test("termination interrupts a contended catalog admission before another lock attempt", async () => {
  const admission = createBenchmarkAdmissionGate("Batch coordinator")
  let releaseDelay!: () => void
  const delayed = new Promise<void>((resolve) => {
    releaseDelay = resolve
  })
  let attempts = 0
  const acquisition = acquireBenchmarkResourceWithAdmission({
    admission,
    maxWaitMs: 90_000,
    acquire: async () => {
      attempts++
      throw Object.assign(new Error("held"), { code: "ELOCKED" })
    },
    isContended: (error) => (error as { code?: string }).code === "ELOCKED",
    delay: () => delayed,
  })
  while (attempts === 0) await Bun.sleep(0)
  admission.request("SIGTERM")
  releaseDelay()
  await expect(acquisition).rejects.toThrow("Batch coordinator received SIGTERM")
  expect(attempts).toBe(1)
})

const slots = Array.from({ length: 5 }, (_, index) => ({ case_index: index + 1, profile: "base" as const }))
const launched = slots.map((slot) => ({
  ...slot,
  exit_code: slot.case_index === 3 ? 2 : 0,
  run_id: `run-${slot.case_index}`,
  run_status: slot.case_index === 3 ? "invalid" : "scored",
  stderr_tail: "",
}))
const eligible = launched
  .filter((item) => item.run_status === "scored")
  .map(({ case_index, profile, run_id }) => ({ case_index, profile, run_id }))

test("a settled batch keeps four valid scores when one sibling is invalid", () => {
  expect(auditAutomationBenchBatchSettlement({ expected: slots, launched, eligible })).toEqual({
    passed: true,
    violations: [],
  })
})

test("a preexisting valid score and four new terminal attempts settle the complete slot set", () => {
  expect(
    auditAutomationBenchBatchSettlement({
      expected: slots,
      launched: launched.slice(1),
      eligible: [{ case_index: 1, profile: "base", run_id: "preexisting-1" }, ...eligible.slice(1)],
    }),
  ).toEqual({ passed: true, violations: [] })
})

test("an unstarted coordinator slot returns the settlement coverage contract", () => {
  expect(
    auditAutomationBenchBatchSettlement({
      expected: slots,
      launched: [
        ...launched.slice(0, 4),
        { case_index: 5, profile: "base", run_id: null, run_status: "coordinator_failed" },
      ],
      eligible: eligible.filter((item) => item.case_index < 5),
    }),
  ).toEqual({
    passed: false,
    violations: ["batch_slot_unsettled:base:5", "settled_case_coverage"],
  })
})

function batchAudit(status: "completed" | "failed", invalidRepetition = 1, cohortPassed = true, invalidExitCode: unknown = 2) {
  const receiptLaunched = launched.map((item) => item.case_index === 3 ? { ...item, exit_code: invalidExitCode } : item)
  const planSHA256 = "a".repeat(64)
  const plan = {
    schema_version: 2,
    batch_run_id: "batch-1",
    batch_index: 1,
    repetition: 1,
    model: "openai/gpt-5.6-luna",
    launch_mode: "mission",
    profiles: ["base"],
    trial_concurrency: 5,
    schedule_mode: "rolling_case_slots_v1",
    execution_identity: {
      commit: "commit-1",
      benchmark_bundle_sha256: "bundle-1",
      case_set_manifest_sha256: "manifest-1",
    },
    cases: slots.map(({ case_index }) => ({ case_index })),
    waves: [slots],
    preexisting_eligible: { base: [], advanced: [] },
  }
  const attempts = receiptLaunched.map((item) => ({
    run_id: item.run_id,
    started_at: item.case_index * 10,
    finished_at: item.case_index * 10 + 5,
    raw_leaderboard_eligible: item.run_status === "scored",
    leaderboard_eligible: false,
    source_run_status: item.run_status,
    cohort_identity_audit: { passed: cohortPassed, violations: cohortPassed ? [] : ["cohort_case_identity_mismatch"] },
    benchmark: {
      batch_run_id: plan.batch_run_id,
      batch_plan_sha256: planSHA256,
      wave_index: 1,
      case_index: item.case_index,
      repetition: item.case_index === 3 ? invalidRepetition : 1,
      case_set_manifest_sha256: "manifest-1",
    },
    opencorvus: {
      profile: "base",
      model: plan.model,
      launch_mode: "mission",
      source: { commit: "commit-1", benchmark_bundle_sha256: "bundle-1" },
    },
  }))
  return auditBatchEvidence({
    plan,
    planSHA256,
    attempts,
    receipt: {
      status,
      batch_run_id: plan.batch_run_id,
      batch_index: 1,
      wave_1: { launched: receiptLaunched, eligible: status === "completed" ? eligible : [] },
    },
  })
}

test("a current completed receipt publishes only its four valid members", () => {
  expect(batchAudit("completed")).toMatchObject({
    passed: true,
    status: "completed",
    eligible_run_ids: ["run-1", "run-2", "run-4", "run-5"],
  })
})

test("an old failed receipt with complete terminal coverage derives the same valid members", () => {
  expect(batchAudit("failed")).toMatchObject({
    passed: true,
    status: "settled_from_failed_receipt",
    eligible_run_ids: ["run-1", "run-2", "run-4", "run-5"],
  })
})

test("a terminal with foreign cohort identity cannot settle its batch slot", () => {
  expect(batchAudit("failed", 1, false)).toMatchObject({ passed: false })
  expect(batchAudit("failed", 1, false).reasons).toContain("launched_trial:base:3")
})

test("a terminal without its exact numeric exit code cannot settle its batch slot", () => {
  expect(batchAudit("failed", 1, true, null)).toMatchObject({ passed: false })
  expect(batchAudit("failed", 1, true, "0").reasons).toContain("launched_trial:base:3")
})

test("completed publication finalizes the exact valid subset without requiring its invalid sibling", () => {
  expect(
    auditAutomationBenchBatchPublication({
      batchRunID: "batch-1",
      expectedEligibleRunIDs: ["run-1", "run-2", "run-4", "run-5"],
      batches: [
        {
          batch_run_id: "batch-1",
          receipt_present: true,
          audit: { passed: true, status: "completed" },
          eligible_run_ids: ["run-5", "run-4", "run-2", "run-1"],
        },
      ],
    }),
  ).toEqual({ passed: true, violations: [] })
})

test("the settlement drain accepts the refreshed publication for only the valid subset", async () => {
  const pending = new Set(["batch-1"])
  const settled: string[] = []
  await settlePendingSnapshotAfterRefresh({
    pending,
    refresh: async () => ({
      batches: [
        {
          batch_run_id: "batch-1",
          receipt_present: true,
          audit: { passed: true, status: "completed" },
          eligible_run_ids: ["run-1", "run-2", "run-4", "run-5"],
        },
      ],
    }),
    settle: async (items, snapshot) => {
      expect(
        auditAutomationBenchBatchPublication({
          batchRunID: items[0]!,
          expectedEligibleRunIDs: ["run-1", "run-2", "run-4", "run-5"],
          batches: snapshot.batches,
        }),
      ).toEqual({ passed: true, violations: [] })
      settled.push(...items)
    },
  })
  expect({ pending: pending.size, settled }).toEqual({ pending: 0, settled: ["batch-1"] })
})

test("a nonterminal status and a foreign repetition return exact settlement errors", () => {
  expect(
    auditAutomationBenchBatchSettlement({
      expected: slots,
      launched: launched.map((item) => (item.case_index === 3 ? { ...item, run_status: "running" } : item)),
      eligible,
    }),
  ).toEqual({
    passed: false,
    violations: ["batch_slot_unsettled:base:3", "settled_case_coverage"],
  })
  const audit = batchAudit("completed", 2)
  expect(audit).toMatchObject({
    passed: false,
    status: "invalid",
  })
  expect(audit.reasons).toContain("launched_trial:base:3")
})

test("terminal cohort identity rejects a foreign task before final coverage", () => {
  expect(
    auditAutomationBenchTerminalCohortIdentity({
      benchmark: {
        version: "1.0.6",
        package_tree_sha256: "p",
        case_index: 3,
        batch_index: 1,
        domain: "support",
        task: "support.foreign",
        task_contract_sha256: null,
        case_set_manifest_sha256: "m",
        case_set_canonical_sha256: "c",
        dataset_index_sha256: "d",
      },
      opencorvus: { model: "openai/gpt-5.6-luna", launch_mode: "mission", profile: "base" },
      selectedCase: {
        case_index: 3,
        batch_index: 1,
        domain: "support",
        task: "support.expected",
        example_id: 3,
        task_contract_sha256: "t",
      },
      model: "openai/gpt-5.6-luna",
      manifestSHA256: "m",
      manifestCanonicalSHA256: "c",
      datasetIndexSHA256: "d",
      caseCount: 100,
      packageTreeSHA256: "p",
      allowIncompleteOfficialIdentity: true,
    }),
  ).toMatchObject({ passed: false, violations: ["cohort_case_identity_mismatch"] })
})

test("a sealed failure snapshot contributes measured model, token, API, and duration cost", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-batch-failure-cost-"))
  try {
    await fs.writeFile(
      path.join(directory, "runtime-database-snapshot.json"),
      JSON.stringify({
        rows: {
          provider_usage_event: [
            {
              id: "usage-1",
              occurred_at: 2,
              provider_id: "openai",
              model_id: "gpt-5.6-luna",
              purpose: "task",
              input_tokens: 10,
              output_tokens: 5,
              reasoning_tokens: 2,
              cache_read_tokens: 1,
              cache_write_tokens: 0,
              total_tokens: 15,
              cost_usd: 0,
              billing_status: "unpriced",
              session_id: "session-1",
              agent_id: "agent-1",
            },
          ],
        },
      }),
    )
    await fs.writeFile(path.join(directory, "automationbench-events.jsonl"), "")
    expect(
      await inspectAutomationBenchTerminalCostEvidence({
        directory,
        isResult: false,
        model: "openai/gpt-5.6-luna",
        payload: { run: { started_at: 100, failed_at: 250 }, benchmark: {}, opencorvus: {} },
      }),
    ).toMatchObject({
      passed: true,
      duration_ms: 150,
      tokens: { input: 10, output: 5, reasoning: 2, total: 15, modelCalls: 1 },
      provider_connectivity_calls: 0,
      benchmark_attempts: 0,
      benchmark_failed: 0,
    })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("a usage row without token fields is incomplete rather than measured as zero", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-batch-missing-cost-"))
  try {
    await fs.writeFile(
      path.join(directory, "runtime-database-snapshot.json"),
      JSON.stringify({
        rows: {
          provider_usage_event: [
            {
              id: "usage-1",
              occurred_at: 2,
              provider_id: "openai",
              model_id: "gpt-5.6-luna",
              purpose: "task",
              billing_status: "unpriced",
              session_id: "session-1",
              agent_id: "agent-1",
            },
          ],
        },
      }),
    )
    await fs.writeFile(path.join(directory, "automationbench-events.jsonl"), "")
    expect(
      await inspectAutomationBenchTerminalCostEvidence({
        directory,
        isResult: false,
        model: "openai/gpt-5.6-luna",
        payload: { run: { started_at: 100, failed_at: 250 }, benchmark: {}, opencorvus: {} },
      }),
    ).toMatchObject({
      passed: false,
      reason: "failure_cost_evidence_incomplete",
      tokens: null,
      provider_connectivity_calls: null,
    })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("a null usage row is incomplete rather than crashing terminal evidence inspection", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-batch-null-cost-"))
  try {
    await fs.writeFile(
      path.join(directory, "runtime-database-snapshot.json"),
      JSON.stringify({ rows: { provider_usage_event: [null] } }),
    )
    await fs.writeFile(path.join(directory, "automationbench-events.jsonl"), "")
    expect(
      await inspectAutomationBenchTerminalCostEvidence({
        directory,
        isResult: false,
        model: "openai/gpt-5.6-luna",
        payload: { run: { started_at: 100, failed_at: 250 }, benchmark: {}, opencorvus: {} },
      }),
    ).toMatchObject({ passed: false, reason: "failure_cost_evidence_incomplete", tokens: null })
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
