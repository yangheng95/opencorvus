import { expect, test } from "bun:test"
import { createIntegrityReviewRunner } from "@/orchestrator/integrity-tool"

test("integrity runner executes each exact concurrent tool occurrence", async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  const started: string[] = []
  const run = createIntegrityReviewRunner({
    taskID: "task_exact_occurrences",
    requireTask: () => ({ id: "task_exact_occurrences" }),
    runReviewOnce: async ({
      toolInput,
    }: {
      toolExecution: { agentID: string; workScope: { kind: "task" }; dispatch: { dispatchID: string } }
      toolInput: { occurrence: string }
    }) => {
      started.push(toolInput.occurrence)
      await gate
      return { occurrence: toolInput.occurrence }
    },
  })
  const execution = { agentID: "integrity-reviewer", workScope: { kind: "task" } as const }
  const first = run({ ...execution, dispatch: { dispatchID: "dispatch-a" } }, { occurrence: "tool-part-a" })
  const second = run({ ...execution, dispatch: { dispatchID: "dispatch-b" } }, { occurrence: "tool-part-b" })
  expect(started).toEqual(["tool-part-a", "tool-part-b"])
  release()
  expect(await Promise.all([first, second])).toEqual([{ occurrence: "tool-part-a" }, { occurrence: "tool-part-b" }])
})

test("integrity runner shares one in-flight result for the same dispatch occurrence", async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  let executions = 0
  const run = createIntegrityReviewRunner({
    taskID: "task_exact_replay",
    requireTask: () => ({ id: "task_exact_replay" }),
    runReviewOnce: async ({
      toolInput,
    }: {
      toolExecution: { agentID: string; workScope: { kind: "task" }; dispatch: { dispatchID: string } }
      toolInput: { value: string }
    }) => {
      executions += 1
      await gate
      return { value: toolInput.value }
    },
  })
  const execution = {
    agentID: "integrity-reviewer",
    workScope: { kind: "task" } as const,
    dispatch: { dispatchID: "dispatch-exact-replay" },
  }
  const first = run(execution, { value: "durable occurrence result" })
  const replay = run(execution, { value: "ignored duplicate payload" })
  release()
  expect(await Promise.all([first, replay])).toEqual([
    { value: "durable occurrence result" },
    { value: "durable occurrence result" },
  ])
  expect(executions).toBe(1)
})
