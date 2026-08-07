#!/usr/bin/env bun

import path from "node:path"
import { runCommandWithInactivity } from "../../src/shell/command-inactivity"

const PRESSURE_TEST_FILES = [
  "test/browser-preview/region-comparison.test.ts",
  "test/browser-preview/region-visible-locator.test.ts",
  "test/browser-preview/region-source-bbox.test.ts",
  "test/browser-preview/region-route-diagnostics.test.ts",
  "test/browser-preview/region-route-state.test.ts",
  "test/browser-preview/region-strict-schema.test.ts",
  "test/agent/runner-prompt.test.ts",
  "test/tool/browser-preview.test.ts",
  "test/server/browser-preview-routes.test.ts",
  "test/server/browser-preview-sdk-contract.test.ts",
  "test/build-agent/reference-comparison-report.test.ts",
  "test/visual-qa/output-tools.test.ts",
  "test/visual-qa/agent.test.ts",
  "test/visual-qa/strict-reference-fidelity.test.ts",
  "test/integrity/acceptance-tools.test.ts",
  "test/integrity/browser-preview-tool.test.ts",
  "test/orchestrator/build-feedback-context.test.ts",
  "test/orchestrator/orchestrator-tool-descriptions.test.ts",
]

const ISOLATED_PRESSURE_TEST_FILES = ["test/integrity/team-agent.test.ts"]

const KNOWN_FLAGS = new Set(["--idle-timeout-ms"])

function flag(name: string): string | undefined {
  const eq = process.argv.find((item) => item.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const idx = process.argv.indexOf(name)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function validateFlags(): void {
  const unknown: string[] = []
  const args = process.argv.slice(2)
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (!arg.startsWith("--")) continue
    const key = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg
    if (KNOWN_FLAGS.has(key)) {
      if (!arg.includes("=") && index + 1 < args.length && !args[index + 1]!.startsWith("--")) index += 1
      continue
    }
    unknown.push(arg)
  }
  if (unknown.length > 0) {
    throw new Error(`unknown browser-preview repair pressure benchmark flag(s): ${unknown.join(" ")}`)
  }
}

function parsePositiveInt(name: string, defaultValue: number): number {
  const raw = flag(name)
  if (!raw) return defaultValue
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`)
  return Math.floor(value)
}

function log(message: string): void {
  process.stdout.write(`[browser-preview-repair-pressure] ${message}\n`)
}

validateFlags()

const packageRoot = path.resolve(import.meta.dir, "../..")
const idleTimeoutMs = parsePositiveInt("--idle-timeout-ms", 120_000)
const bunTestTimeoutDisabled = "0"

log(`cwd=${packageRoot}`)
log(`idle_timeout_ms=${idleTimeoutMs}`)
log("bun_test_timeout_ms=0")

const commands = [
  ["test", "--timeout", bunTestTimeoutDisabled, ...PRESSURE_TEST_FILES],
  ["test", "--timeout", bunTestTimeoutDisabled, ...ISOLATED_PRESSURE_TEST_FILES],
]

for (const args of commands) {
  log(`command=${process.execPath} ${args.join(" ")}`)
  const result = await runCommandWithInactivity({
    executable: process.execPath,
    args,
    cwd: packageRoot,
    inactivityTimeoutMs: idleTimeoutMs,
  })

  if (result.stdout.trim()) process.stdout.write(result.stdout)
  if (result.stderr.trim()) process.stderr.write(result.stderr)

  if (result.failure) {
    log(`status=${result.failure.kind}`)
    process.exit(1)
  }
  if (result.exitCode !== 0) {
    log(`status=failed exit_code=${result.exitCode}`)
    process.exit(result.exitCode)
  }
}

log("status=passed")
