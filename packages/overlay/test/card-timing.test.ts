import { expect, test } from "bun:test"

import { cardDurationMs } from "../src/utils/card-timing"

const START = 1_782_000_000_000

function toolNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "part-tool-timing",
    kind: "tool" as const,
    title: "mission_state",
    parts: [],
    childIDs: [],
    orderKey: "v1:0001782000000000:0000000000000031:0000000000000000:part:part-tool-timing",
    time: START,
    status: "completed" as const,
    timeCompleted: START + 2_500,
    ...overrides,
  }
}

test("completed cards derive duration from persisted start and finish", () => {
  const node = toolNode()
  expect(cardDurationMs(node, START + 50_000)).toBe(2_500)
})

test("only running cards derive live elapsed time from the supplied shared clock", () => {
  const running = toolNode({ status: "running", timeCompleted: undefined })
  const pending = toolNode({ status: "pending", timeCompleted: undefined })

  expect(cardDurationMs(running, START + 3_900)).toBe(3_900)
  expect(cardDurationMs(pending, START + 4_200)).toBeNull()
})

test("invalid or non-positive start timestamps do not produce a duration", () => {
  expect(cardDurationMs(toolNode({ time: 0 }), START + 5_000)).toBeNull()
  expect(cardDurationMs(toolNode({ time: Number.NaN }), START + 5_000)).toBeNull()
})
