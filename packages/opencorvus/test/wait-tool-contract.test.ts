import { describe, expect, test } from "bun:test"
import { WaitToolDescription, WaitToolParameters } from "../src/tool/wait-contract"

describe("wait tool scheduling contract", () => {
  test("binds deliberate waits to the governing inactivity deadline", () => {
    expect(
      WaitToolParameters.parse({
        duration_ms: 5 * 60 * 1000,
        reason: "A concrete external build is expected to publish terminal evidence before the benchmark deadline.",
      }),
    ).toEqual({
      duration_ms: 5 * 60 * 1000,
      reason: "A concrete external build is expected to publish terminal evidence before the benchmark deadline.",
    })
    expect(WaitToolParameters.shape.duration_ms.description).toContain(
      "schedule the wake strictly before that deadline and leave time for wake dispatch plus evidence production",
    )
    expect(WaitToolDescription).toContain(
      "the wake must occur strictly before it with enough remaining time to dispatch and publish real evidence",
    )
  })
})
