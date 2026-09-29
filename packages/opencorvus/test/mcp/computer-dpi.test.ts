import { expect, test } from "bun:test"
import { establishComputerHostDpi, prepareComputerHostDpi } from "../../src/mcp/computer/windows-dpi"

test("establishes a physical-pixel process default before native driver creation", () => {
  let context = -1
  const transitions: number[] = []
  establishComputerHostDpi({
    context: () => context,
    equal: (a, b) => Number(a === b),
    lastError: () => 0,
    set: (target) => {
      transitions.push(target)
      context = target
      return 1
    },
  })
  establishComputerHostDpi({
    context: () => context,
    equal: (a, b) => Number(a === b),
    lastError: () => 0,
    set: (target) => {
      transitions.push(target)
      return 1
    },
  })
  expect({ context, transitions }).toEqual({ context: -4, transitions: [-4] })
})

test("reports an incompatible initialized host as the typed backend error", () => {
  try {
    establishComputerHostDpi({ context: () => -1, equal: (a, b) => Number(a === b), lastError: () => 5, set: () => 0 })
    throw new Error("expected DPI contract error")
  } catch (error) {
    expect(error).toMatchObject({
      code: "COMPUTER_BACKEND_ERROR",
      details: { operation: "initialize_dpi", win32Error: 5 },
    })
  }
})

test.skipIf(process.platform !== "win32")("initializes the real Windows host DPI contract", async () => {
  expect(await prepareComputerHostDpi()).toBe("per-monitor-v2")
})
