import crypto from "node:crypto"

export const EXTERNAL_BENCHMARK_SCHEMA_VERSION = 1 as const

export type TokenBreakdown = {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
  costUSD: number
  pricedCalls: number
  unpricedCalls: number
  assistantMessages: number
}

export type TrajectoryEvent = {
  at: number
  end?: number
  lane: string
  kind: "llm" | "turn" | "tool" | "skill" | "benchmark" | "decision" | "failure"
  label: string
  source: "trace" | "transcript" | "benchmark"
}

export function benchmarkRunKey(startedAt: number, runID: string) {
  return `${new Date(startedAt).toISOString().replaceAll(":", "-")}-${runID}`
}

type TranscriptMessage = {
  info?: Record<string, any>
  parts?: Array<Record<string, any>>
}

function finiteNonnegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

export function summarizeTranscriptUsage(transcript: TranscriptMessage[]): TokenBreakdown {
  const result: TokenBreakdown = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
    costUSD: 0,
    pricedCalls: 0,
    unpricedCalls: 0,
    assistantMessages: 0,
  }
  for (const message of transcript) {
    const info = message.info
    if (info?.role !== "assistant" || !info.tokens) continue
    result.assistantMessages++
    result.input += finiteNonnegative(info.tokens.input)
    result.output += finiteNonnegative(info.tokens.output)
    result.reasoning += finiteNonnegative(info.tokens.reasoning)
    result.cacheRead += finiteNonnegative(info.tokens.cache?.read)
    result.cacheWrite += finiteNonnegative(info.tokens.cache?.write)
    result.total += finiteNonnegative(info.tokens.total)
    result.costUSD += finiteNonnegative(info.cost)
    if (info.billing?.status === "priced") result.pricedCalls++
    if (info.billing?.status === "unpriced") result.unpricedCalls++
  }
  return result
}

export function benchmarkActivitySignature(input: {
  board: Record<string, any>
  transcript: TranscriptMessage[]
  trace: Array<Record<string, any>>
  benchmarkEventCount: number
}): string {
  const messages = input.transcript.map((message) => ({
    id: message.info?.id,
    role: message.info?.role,
    agent: message.info?.agent,
    updated: message.info?.time?.updated ?? message.info?.time?.completed ?? message.info?.time?.created,
    parts: (message.parts ?? []).map((part) => ({
      id: part.id,
      type: part.type,
      status: part.state?.status,
      start: part.state?.time?.start ?? part.time?.start,
      end: part.state?.time?.end ?? part.time?.end,
      textLength: typeof part.text === "string" ? part.text.length : undefined,
    })),
  }))
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        task: {
          id: input.board.task?.id,
          status: input.board.task?.status,
          lifecycleStatus: input.board.task?.lifecycleStatus,
          completedAt: input.board.task?.completedAt ?? input.board.task?.time?.completed,
        },
        progress: (input.board.progress ?? []).map?.((item: any) => [
          item.id,
          item.kind,
          item.status,
          item.time?.created,
          item.time?.completed,
        ]),
        artifactRevisions: (input.board.artifacts ?? []).map((item: any) => [item.id, item.revision, item.kind]),
        messages,
        trace: input.trace.map((event) => [event.ts, event.kind, event.sessionID, event.agentName]),
        benchmarkEventCount: input.benchmarkEventCount,
      }),
    )
    .digest("hex")
}

export function normalizeTrajectory(input: {
  transcript: TranscriptMessage[]
  trace: Array<Record<string, any>>
  benchmarkEvents: Array<Record<string, any>>
}): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = []
  const requestStarts = new Map<string, number[]>()
  for (const event of input.trace) {
    const at = finiteNonnegative(event.ts)
    const lane = typeof event.agentName === "string" && event.agentName ? event.agentName : "host"
    if (event.kind === "llm_request") {
      const queue = requestStarts.get(lane) ?? []
      queue.push(at)
      requestStarts.set(lane, queue)
      continue
    }
    if (["agent_turn", "orchestrator_wake", "agent_turn_failure", "orchestrator_wake_failure"].includes(event.kind)) {
      const queue = requestStarts.get(lane) ?? []
      const start = queue.shift() ?? at
      const failed = String(event.kind).endsWith("failure")
      events.push({
        at: start,
        end: at,
        lane,
        kind: failed ? "failure" : lane.includes("orchestrator") ? "decision" : "turn",
        label: event.kind,
        source: "trace",
      })
    }
  }
  for (const message of input.transcript) {
    const lane = typeof message.info?.agent === "string" && message.info.agent ? message.info.agent : "host"
    for (const part of message.parts ?? []) {
      if (part.type !== "tool") continue
      const at = finiteNonnegative(part.state?.time?.start ?? message.info?.time?.created)
      const end = finiteNonnegative(part.state?.time?.end)
      const label = String(part.tool ?? "tool")
      events.push({
        at,
        ...(end >= at && end > 0 ? { end } : {}),
        lane,
        kind: label === "skill" ? "skill" : part.state?.status === "error" ? "failure" : "tool",
        label,
        source: "transcript",
      })
    }
  }
  for (const event of input.benchmarkEvents) {
    events.push({
      at: finiteNonnegative(event.ts),
      ...(finiteNonnegative(event.end) >= finiteNonnegative(event.ts) ? { end: finiteNonnegative(event.end) } : {}),
      lane: "automationbench",
      kind: event.kind === "score" ? "decision" : event.kind === "error" ? "failure" : "benchmark",
      label: String(event.tool ?? event.kind ?? "benchmark"),
      source: "benchmark",
    })
  }
  return events.sort((left, right) => left.at - right.at || left.lane.localeCompare(right.lane))
}

function escapeXML(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

export function renderTrajectorySVG(input: {
  title: string
  events: TrajectoryEvent[]
  tokens: TokenBreakdown
}): string {
  const lanes = [...new Set(input.events.map((event) => event.lane))]
  const min = Math.min(...input.events.map((event) => event.at), Date.now())
  const max = Math.max(...input.events.map((event) => event.end ?? event.at), min + 1)
  const width = 1400
  const left = 190
  const right = 40
  const top = 116
  const laneHeight = 52
  const height = top + Math.max(1, lanes.length) * laneHeight + 92
  const plotWidth = width - left - right
  const x = (value: number) => left + ((value - min) / Math.max(1, max - min)) * plotWidth
  const colors: Record<TrajectoryEvent["kind"], string> = {
    llm: "#2563eb",
    turn: "#2563eb",
    tool: "#0f766e",
    skill: "#7c3aed",
    benchmark: "#d97706",
    decision: "#15803d",
    failure: "#b91c1c",
  }
  const rows = lanes
    .map((lane, index) => {
      const y = top + index * laneHeight
      const marks = input.events
        .filter((event) => event.lane === lane)
        .sort((left, right) => (right.end ?? right.at) - right.at - ((left.end ?? left.at) - left.at))
        .map((event) => {
          const startX = x(event.at)
          const endX = x(event.end ?? event.at)
          const color = colors[event.kind]
          const durationWidth = Math.max(4, endX - startX)
          return `<g><title>${escapeXML(event.label)} · ${Math.max(0, (event.end ?? event.at) - event.at)} ms</title><rect x="${startX.toFixed(1)}" y="${y + 12}" width="${durationWidth.toFixed(1)}" height="20" rx="3" fill="${color}" opacity="0.88"/></g>`
        })
        .join("")
      return `<text x="${left - 14}" y="${y + 27}" text-anchor="end" font-size="13" fill="#111827">${escapeXML(lane)}</text><line x1="${left}" y1="${y + 38}" x2="${width - right}" y2="${y + 38}" stroke="#e5e7eb"/>${marks}`
    })
    .join("")
  const durationSeconds = (max - min) / 1000
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const tickX = left + ratio * plotWidth
      return `<line x1="${tickX}" y1="${top - 12}" x2="${tickX}" y2="${height - 72}" stroke="#f3f4f6"/><text x="${tickX}" y="${top - 20}" text-anchor="middle" font-size="11" fill="#4b5563">${(durationSeconds * ratio).toFixed(0)}s</text>`
    })
    .join("")
  const legendKinds: Array<[TrajectoryEvent["kind"], string]> = [
    ["turn", "agent turn"],
    ["tool", "harness tool"],
    ["skill", "Skill"],
    ["benchmark", "benchmark API"],
    ["decision", "decision/scorer"],
    ["failure", "failure"],
  ]
  const legend = legendKinds
    .map(
      ([kind, label], index) =>
        `<rect x="${left + index * 170}" y="${height - 52}" width="14" height="14" rx="2" fill="${colors[kind]}"/><text x="${left + index * 170 + 21}" y="${height - 40}" font-size="11" fill="#374151">${label}</text>`,
    )
    .join("")
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${escapeXML(input.title)}</title>`,
    `<desc id="desc">Aligned OpenCorvus agent and AutomationBench tool trajectory.</desc>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="24" y="32" font-size="20" font-weight="600" fill="#111827">${escapeXML(input.title)}</text>`,
    `<text x="24" y="58" font-size="12" fill="#4b5563">${durationSeconds.toFixed(1)} s · ${input.events.length} events · ${input.tokens.total.toLocaleString()} provider tokens · ${input.tokens.output.toLocaleString()} text output · ${input.tokens.reasoning.toLocaleString()} reasoning</text>`,
    ticks,
    `<line x1="${left}" y1="${top - 12}" x2="${width - right}" y2="${top - 12}" stroke="#9ca3af"/>`,
    rows,
    legend,
    `<text x="${width - right}" y="${height - 40}" text-anchor="end" font-size="11" fill="#6b7280">Hover marks in SVG for exact labels and durations.</text>`,
    `</svg>`,
  ].join("\n")
}
