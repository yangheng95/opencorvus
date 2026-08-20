import { describe, expect, test } from "bun:test"
import {
  benchmarkActivitySignature,
  benchmarkRunKey,
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

  test("changes the activity signature when benchmark world activity advances", () => {
    const base = { board: { task: { status: "active" }, artifacts: [] }, transcript, trace: [], benchmarkEventCount: 1 }
    expect(benchmarkActivitySignature({ ...base, benchmarkEventCount: 2 })).not.toBe(
      benchmarkActivitySignature(base),
    )
  })

  test("assigns every run an immutable timestamp and run identity key", () => {
    expect(benchmarkRunKey(Date.UTC(2026, 7, 20, 6, 7, 8), "run-a")).toBe("2026-08-20T06-07-08.000Z-run-a")
    expect(benchmarkRunKey(Date.UTC(2026, 7, 20, 6, 7, 8), "run-b")).toBe("2026-08-20T06-07-08.000Z-run-b")
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
    expect(renderTrajectorySVG({ title: "Base trial", events, tokens: summarizeTranscriptUsage(transcript) })).toContain(
      "Aligned OpenCorvus agent and AutomationBench tool trajectory.",
    )
  })
})
