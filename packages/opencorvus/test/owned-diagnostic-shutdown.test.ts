import { expect, test } from "bun:test"
import { AssertionError } from "node:assert"
import { ownedShutdownBudgetWindow, qualifyOwnedShutdownReaderAbort } from "../script/owned-diagnostic-shutdown"

test("derives shutdown and its complete settlement reserve from one admission deadline", () => {
  expect(ownedShutdownBudgetWindow({ registeredAt: 1_000, deadlineAt: 2_701_000 })).toEqual({
    dueAt: 2_401_000, delayMs: 2_400_000, physicalDeadlineAt: 2_701_000, settlementReserveMs: 300_000,
  })
})

test("an exhausted admission maps to its explicit timing error", () => {
  expect(() => ownedShutdownBudgetWindow({ registeredAt: 1_000, deadlineAt: 301_000 })).toThrow(RangeError)
})

test("qualifies a reader cancellation that drains after the shutdown HTTP response", () => {
  expect(qualifyOwnedShutdownReaderAbort({ occurrence: "owned-1", shutdownOccurrence: "owned-1",
    settledOccurrence: "owned-1", arrivedAt: 1_000, terminalAt: 1_020, settledAt: 1_500 })).toEqual({
    kind: "owned_shutdown_abort", occurrence: "owned-1", millisecondsAfterArrival: 20, millisecondsBeforeSettlement: 480,
  })
})

test("a cancellation after settlement maps to its explicit timing error", () => {
  expect(() => qualifyOwnedShutdownReaderAbort({ occurrence: "owned-1", shutdownOccurrence: "owned-1",
    settledOccurrence: "owned-1", arrivedAt: 1_000, terminalAt: 1_501, settledAt: 1_500 })).toThrow(RangeError)
})

test("a foreign shutdown occurrence maps to its explicit identity error", () => {
  expect(() => qualifyOwnedShutdownReaderAbort({ occurrence: "owned-1", shutdownOccurrence: "owned-2",
    settledOccurrence: "owned-1", arrivedAt: 1_000, terminalAt: 1_020, settledAt: 1_500 })).toThrow(AssertionError)
})
