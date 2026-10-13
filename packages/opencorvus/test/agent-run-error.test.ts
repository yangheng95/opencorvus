import { expect, test } from "bun:test"
import { AgentRunError, buildHardErrorFromFinalMessage } from "../src/agent/run-error"

for (const kind of ["assistant", "delegated-worker", "orchestrator"] as const) {
  test(`${kind} preserves the canonical Provider failure and its cause`, () => {
    const error = { name: "UnknownError", data: { message: "Provider stream overloaded" } }
    const result = buildHardErrorFromFinalMessage({
      kind,
      agentName: "actual-agent",
      finalMessage: { info: { role: "assistant", finish: "error", error } },
    })
    expect(result).toBeInstanceOf(AgentRunError)
    expect(result).toMatchObject({
      name: "AgentRunError",
      kind,
      cause: error,
      message: `[${kind}] LLM error during actual-agent: UnknownError: Provider stream overloaded`,
    })
  })
}

test("output limits retain the effective cap in the typed cause", () => {
  expect(
    buildHardErrorFromFinalMessage({
      kind: "delegated-worker",
      agentName: "researcher",
      effectiveOutputLimit: 4096,
      finalMessage: { info: { role: "assistant", finish: "length" } },
    }),
  ).toMatchObject({
    name: "AgentRunError",
    kind: "delegated-worker",
    cause: { name: "MessageOutputLengthError", data: { effectiveOutputLimit: 4096 } },
  })
})

test("an error finish without its diagnostic has an explicit integrity failure", () => {
  expect(
    buildHardErrorFromFinalMessage({
      kind: "orchestrator",
      agentName: "orchestrator",
      finalMessage: { info: { role: "assistant", finish: "error" } },
    }),
  ).toMatchObject({
    name: "AgentRunError",
    kind: "orchestrator",
    message: "[orchestrator] LLM error during orchestrator: error finish has no recorded diagnostic",
  })
})
