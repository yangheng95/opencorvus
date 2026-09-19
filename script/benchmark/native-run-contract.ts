export function awaitNativeOperation<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener("abort", abort, { once: true })
  })
}

export function requireScorableNativeCompletion(finishReason: string, signal: AbortSignal): "ready_for_official_score" {
  if (signal.aborted) throw signal.reason
  if (!["stop", "tool-calls", "length", "content-filter"].includes(finishReason))
    throw new Error(`unscored_native_finish:${finishReason}`)
  return "ready_for_official_score"
}

export function nativeStreamEvidence(part: any, redactHeaders: (headers: Record<string, string>) => unknown): unknown {
  if (part.type === "finish-step" && part.response?.headers)
    return { ...part, response: { ...part.response, headers: redactHeaders(part.response.headers) } }
  return part
}

export function parseNativeCaseIndexes(value: string, caseCount: number): number[] {
  const selected = new Set<number>()
  for (const token of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(token)
    if (!match) throw new Error("native_case_selection_invalid")
    const first = Number(match[1])
    const last = Number(match[2] ?? match[1])
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > caseCount) {
      throw new Error("native_case_selection_out_of_manifest")
    }
    for (let index = first; index <= last; index++) {
      if (selected.has(index)) throw new Error("native_case_selection_duplicate")
      selected.add(index)
    }
  }
  if (selected.size === 0) throw new Error("native_case_selection_empty")
  return [...selected]
}

export function auditNativeBatchSettlement(input: {
  selected: readonly number[]
  outcomes: ReadonlyArray<{ case_index: number; status: string }>
}) {
  const selected = [...input.selected].sort((left, right) => left - right)
  const terminal = input.outcomes
    .filter((item) => ["scored", "unscored_infrastructure_failure"].includes(item.status))
    .map((item) => item.case_index)
    .sort((left, right) => left - right)
  const violations = [
    ...(new Set(input.outcomes.map((item) => item.case_index)).size === input.outcomes.length
      ? []
      : ["native_terminal_case_duplicate"]),
    ...(JSON.stringify(selected) === JSON.stringify(terminal) ? [] : ["native_terminal_case_coverage"]),
  ]
  return { passed: violations.length === 0, violations }
}

export function auditNativeTerminalEnvelope(start: Record<string, unknown>, result: Record<string, unknown>) {
  const runID = start.run_id
  const startedAt = start.started_at
  const finishedAt = result.finished_at
  const passed =
    typeof runID === "string" &&
    runID.length > 0 &&
    result.run_id === runID &&
    typeof startedAt === "number" &&
    Number.isSafeInteger(startedAt) &&
    startedAt >= 0 &&
    result.started_at === startedAt &&
    typeof finishedAt === "number" &&
    Number.isSafeInteger(finishedAt) &&
    finishedAt >= startedAt
  return { passed, reason: passed ? null : "native_terminal_envelope_mismatch" }
}
