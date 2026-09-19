import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import {
  auditNativeBatchSettlement,
  auditNativeTerminalEnvelope,
  awaitNativeOperation,
  nativeStreamEvidence,
  parseNativeCaseIndexes,
  requireScorableNativeCompletion,
} from "./native-run-contract"
import { ProviderError } from "../../packages/opencorvus/src/provider/error"

test("world wait settles with the exact inactivity error", async () => {
  const abort = new AbortController()
  const pending = awaitNativeOperation(new Promise(() => {}), abort.signal)
  const error = new Error("native_provider_inactivity")
  abort.abort(error)
  await expect(pending).rejects.toBe(error)
})

test("already cancelled operations settle under the original cancellation contract", async () => {
  const abort = new AbortController()
  const error = new Error("native_provider_inactivity")
  abort.abort(error)
  await expect(awaitNativeOperation(Promise.reject(new Error("world_read_failed")), abort.signal)).rejects.toBe(error)
})

test("normal operation and natural completion enter official scoring", async () => {
  const abort = new AbortController()
  expect(await awaitNativeOperation(Promise.resolve("world_ready"), abort.signal)).toBe("world_ready")
  expect(requireScorableNativeCompletion("stop", abort.signal)).toBe("ready_for_official_score")
  abort.abort(new Error("native_provider_inactivity"))
  expect(() => requireScorableNativeCompletion("tool-calls", abort.signal)).toThrow("native_provider_inactivity")
})

test("transport headers use the existing provider redaction contract", () => {
  const evidence = nativeStreamEvidence({ type: "finish-step", response: { headers: {
    "set-cookie": "session=test-value", "content-type": "text/event-stream",
  } } }, ProviderError.redactSensitiveProviderHeaders)
  expect(evidence).toEqual({ type: "finish-step", response: { headers: {
    "set-cookie": "<redacted>", "content-type": "text/event-stream",
  } } })
})

test("native batch selection and terminal settlement preserve infrastructure failures in the fixed cohort", () => {
  const selected = parseNativeCaseIndexes("1-3,5", 5)
  expect(selected).toEqual([1, 2, 3, 5])
  expect(
    auditNativeBatchSettlement({
      selected,
      outcomes: [
        { case_index: 1, status: "scored" },
        { case_index: 2, status: "unscored_infrastructure_failure" },
        { case_index: 3, status: "scored" },
        { case_index: 5, status: "scored" },
      ],
    }),
  ).toEqual({ passed: true, violations: [] })
})

test("native terminal identity requires a nonempty run and monotonic safe timestamps", () => {
  expect(auditNativeTerminalEnvelope({}, { finished_at: 1 })).toEqual({
    passed: false,
    reason: "native_terminal_envelope_mismatch",
  })
  expect(
    auditNativeTerminalEnvelope(
      { run_id: "run-1", started_at: 100 },
      { run_id: "run-1", started_at: 100, finished_at: 1 },
    ),
  ).toEqual({ passed: false, reason: "native_terminal_envelope_mismatch" })
  expect(
    auditNativeTerminalEnvelope(
      { run_id: "run-1", started_at: 100 },
      { run_id: "run-1", started_at: 100, finished_at: 101 },
    ),
  ).toEqual({ passed: true, reason: null })
})

test("native batch coordinator replays source-bound terminals and publishes complete coverage", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-native-batch-"))
  const output = path.join(root, "output")
  const manifest = path.join(root, "manifest.json")
  const harness = path.join(root, "harness")
  const runtime = path.join(root, "runtime")
  const python = Bun.which("python") ?? Bun.which("python3")
  if (!python) throw new Error("Python is required for the native replay contract test")
  const manifestBody = JSON.stringify({
    selection: { count: 2 },
    cases: [
      { case_index: 1, domain: "test", task: "test.one" },
      { case_index: 2, domain: "test", task: "test.two" },
    ],
  })
  const manifestSHA256 = crypto.createHash("sha256").update(manifestBody).digest("hex")
  await Promise.all([
    fs.mkdir(path.join(output, "case-001-attempt-1"), { recursive: true }),
    fs.mkdir(path.join(output, "case-002-attempt-1"), { recursive: true }),
    fs.mkdir(harness, { recursive: true }),
    fs.mkdir(runtime, { recursive: true }),
  ])
  await Promise.all([
    fs.writeFile(manifest, manifestBody),
    fs.writeFile(path.join(harness, "automationbench_bridge.py"), "# bridge\n"),
    fs.writeFile(
      path.join(harness, "verify_automationbench_replay.py"),
      "import json, sys\njson.load(sys.stdin)\nprint(json.dumps({'passed': True}))\n",
    ),
    fs.writeFile(path.join(runtime, "source.txt"), "frozen runtime\n"),
  ])
  const git = (args: string[]) => Bun.spawnSync(["git", "-C", runtime, ...args])
  for (const args of [
    ["init"],
    ["config", "user.email", "benchmark@example.invalid"],
    ["config", "user.name", "Benchmark Test"],
    ["add", "source.txt"],
    ["commit", "-m", "frozen runtime"],
  ]) {
    const result = git(args)
    if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  }
  const runtimeRevision = git(["rev-parse", "HEAD"]).stdout.toString().trim()
  const sourceFiles = [
    path.join(import.meta.dir, "run-native-automationbench.ts"),
    path.join(import.meta.dir, "run-native-automationbench-batch.ts"),
    path.join(import.meta.dir, "native-run-contract.ts"),
    path.join(import.meta.dir, "process-lifecycle.ts"),
    path.join(import.meta.dir, "native-automationbench-world.py"),
    path.join(harness, "automationbench_bridge.py"),
    path.join(harness, "verify_automationbench_replay.py"),
  ]
  const sourceIdentity = Object.fromEntries(
    await Promise.all(sourceFiles.map(async (file) => [path.basename(file), crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex")])),
  )
  const identity = {
    runtime_revision: runtimeRevision,
    model: "openai/gpt-5.6-luna",
    reasoning_effort: "medium",
    manifest_sha256: manifestSHA256,
    max_response_steps: 50,
    inactivity_ms: 600_000,
  }
  await Promise.all([
    fs.writeFile(path.join(output, "case-001-attempt-1/run-start.json"), JSON.stringify({ run_id: "run-1", started_at: 1, case_index: 1, ...identity })),
    fs.writeFile(path.join(output, "case-001-attempt-1/input.json"), JSON.stringify({ run_id: "run-1", case_index: 1, source_files: sourceIdentity, ...identity })),
    fs.writeFile(path.join(output, "case-001-attempt-1/result.json"), JSON.stringify({ run_id: "run-1", started_at: 1, finished_at: 2, case_index: 1, status: "scored", score: { score: 1 }, replay: { passed: true }, ...identity })),
    fs.writeFile(path.join(output, "case-002-attempt-1/run-start.json"), JSON.stringify({ run_id: "run-2", started_at: 3, case_index: 2, ...identity })),
    fs.mkdir(path.join(output, "case-001-attempt-1/world"), { recursive: true }),
    fs.writeFile(
      path.join(output, "case-002-attempt-1/result.json"),
      JSON.stringify({ run_id: "run-2", started_at: 3, finished_at: 4, case_index: 2, status: "unscored_infrastructure_failure", failure_stage: "setup", error: "setup failed", ...identity }),
    ),
  ])
  await Promise.all([
    fs.writeFile(path.join(output, "case-001-attempt-1/world/automationbench-events.jsonl"), ""),
    fs.writeFile(path.join(output, "case-001-attempt-1/world/automationbench-initial-world.json"), "{}"),
    fs.writeFile(path.join(output, "case-001-attempt-1/world/automationbench-final-world.json"), "{}"),
  ])
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(import.meta.dir, "run-native-automationbench-batch.ts"),
      "--runtime", runtime,
      "--runtime-revision", runtimeRevision,
      "--runtime-home", path.join(root, "unused-home"),
      "--python", python,
      "--harness", harness,
      "--manifest", manifest,
      "--reasoning-effort", "medium",
      "--output", output,
      "--case-index", "1-2",
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  try {
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
    const progress = JSON.parse(await fs.readFile(path.join(output, "native-batch-progress.json"), "utf8"))
    expect({ exitCode, stderr, status: progress.status, settlement: progress.settlement }).toEqual({
      exitCode: 0,
      stderr: "",
      status: "completed",
      settlement: { passed: true, violations: [] },
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
