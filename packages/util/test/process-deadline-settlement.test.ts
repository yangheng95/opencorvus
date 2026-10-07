import { expect, test } from "bun:test"
import { createProcessFacade, ProcessDeadlineExceededError, ProcessSettlementUncertainError } from "../src/process"

test("deadline reports uncertain admission when the injected spawner cannot settle", async () => {
  const facade = createProcessFacade(async () => await new Promise(() => {}), { settlementTimeoutMs: 40 })
  const failure = await facade
    .spawn({ command: { executable: "fixture", args: [] }, deadlineAt: Date.now() + 30 })
    .catch((error: unknown) => error)
  if (!(failure instanceof AggregateError)) throw new Error("Expected primary deadline and uncertain settlement")
  expect(failure.errors[0]).toBeInstanceOf(ProcessDeadlineExceededError)
  expect(failure.errors[1]).toBeInstanceOf(ProcessSettlementUncertainError)
})

test("an expired entry maps to the original typed deadline contract", async () => {
  const facade = createProcessFacade(async () => {
    throw new Error("unexpected admission")
  })
  const result = await facade
    .spawn({ command: { executable: "fixture", args: [] }, deadlineAt: Date.now() - 1 })
    .catch((error: unknown) => error)
  expect(result).toBeInstanceOf(ProcessDeadlineExceededError)
})
