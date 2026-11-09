import { expect, test } from "bun:test"
import { mergeAbortSignals } from "../src/services/api"

test.each(["AbortError", "TimeoutError"])("retains the first request abort cause: %s", (name) => {
  const caller = new AbortController()
  const deadline = new AbortController()
  const combined = mergeAbortSignals(caller.signal, deadline.signal)
  const reason = new DOMException("Directory check ended", name)
  const [first, second] = name === "AbortError" ? [caller, deadline] : [deadline, caller]
  first.abort(reason)
  second.abort(new DOMException("Later abort", "AbortError"))
  expect(combined.reason).toBe(reason)
})
