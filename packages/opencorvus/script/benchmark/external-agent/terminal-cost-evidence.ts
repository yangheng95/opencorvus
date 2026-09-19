import fs from "node:fs/promises"
import path from "node:path"
import {
  providerUsageMatchesModel,
  summarizeBenchmarkToolEvents,
  summarizeProviderUsageRows,
  type ProviderUsageRow,
} from "./contract"

export async function inspectAutomationBenchTerminalCostEvidence(input: {
  directory: string
  payload: Record<string, any>
  isResult: boolean
  model: string
}) {
  const finishedAt = input.isResult ? input.payload.run?.finished_at : input.payload.run?.failed_at
  const durationMs = Number(input.payload.run?.duration_ms ?? Number(finishedAt) - Number(input.payload.run?.started_at))
  const durationPassed = Number.isFinite(durationMs) && durationMs >= 0
  const usageRows = input.isResult
    ? await fs
        .readFile(path.join(input.directory, "provider-usage-ledger.json"), "utf8")
        .then((text) => JSON.parse(text))
        .catch(() => undefined)
    : await fs
        .readFile(path.join(input.directory, "runtime-database-snapshot.json"), "utf8")
        .then((text) => JSON.parse(text)?.rows?.provider_usage_event)
        .catch(() => undefined)
  const usageRowsStructured =
    Array.isArray(usageRows) && usageRows.every((row) => row !== null && typeof row === "object" && !Array.isArray(row))
  const meteredUsageRows = usageRowsStructured
    ? usageRows.filter((row) => row.purpose !== "provider-connectivity")
    : []
  const connectivityRows = usageRowsStructured
    ? usageRows.filter((row) => row.purpose === "provider-connectivity")
    : []
  const expectedModel = providerUsageMatchesModel(meteredUsageRows, input.model)
  const usageFieldsComplete = usageRowsStructured && usageRows.every((row) =>
    typeof row.id === "string" &&
    Number.isFinite(row.occurred_at) &&
    typeof row.provider_id === "string" &&
    typeof row.model_id === "string" &&
    typeof row.purpose === "string" &&
    [
      row.input_tokens,
      row.output_tokens,
      row.reasoning_tokens,
      row.cache_read_tokens,
      row.cache_write_tokens,
      row.total_tokens,
      row.cost_usd,
    ].every((value) => Number.isFinite(value) && value >= 0) &&
    ["priced", "unpriced"].includes(row.billing_status) &&
    (row.session_id === null || typeof row.session_id === "string") &&
    (row.agent_id === null || typeof row.agent_id === "string")
  )
  const usagePassed =
    Array.isArray(usageRows) &&
    usageFieldsComplete &&
    expectedModel.passed &&
    connectivityRows.every(
      (row) => row.provider_id === expectedModel.provider_id && row.model_id === expectedModel.model_id,
    )
  const tokens = usagePassed ? summarizeProviderUsageRows(meteredUsageRows as ProviderUsageRow[]) : null
  const expectedTokens = input.payload.opencorvus?.tokens
  const tokenFields = [
    "input",
    "output",
    "reasoning",
    "cacheRead",
    "cacheWrite",
    "total",
    "costUSD",
    "pricedCalls",
    "unpricedCalls",
    "modelCalls",
  ]
  const tokensPassed =
    !input.isResult ||
    (tokens !== null &&
      tokenFields.every((field) => tokens[field as keyof typeof tokens] === expectedTokens?.[field]))
  const events = await fs.readFile(path.join(input.directory, "automationbench-events.jsonl"), "utf8").catch(() => undefined)
  let toolAudit: ReturnType<typeof summarizeBenchmarkToolEvents> | undefined
  try {
    toolAudit = events === undefined
      ? undefined
      : summarizeBenchmarkToolEvents(events.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)))
  } catch {}
  const toolCountsPassed =
    toolAudit?.sequenceValid === true &&
    (!input.isResult ||
      (toolAudit.attempts === input.payload.benchmark?.tool_attempts &&
        toolAudit.failed === input.payload.benchmark?.tool_failed))
  const passed = durationPassed && usagePassed && tokensPassed && toolCountsPassed
  return {
    passed,
    source: input.isResult ? "sealed_result_ledger_and_events" : "sealed_failure_snapshot_and_events",
    reason: passed ? null : input.isResult ? "result_cost_evidence_incomplete" : "failure_cost_evidence_incomplete",
    duration_ms: durationPassed ? durationMs : null,
    tokens,
    provider_connectivity_calls: usagePassed ? connectivityRows.length : null,
    benchmark_attempts: toolAudit?.sequenceValid === true ? toolAudit.attempts : null,
    benchmark_failed: toolAudit?.sequenceValid === true ? toolAudit.failed : null,
  }
}
