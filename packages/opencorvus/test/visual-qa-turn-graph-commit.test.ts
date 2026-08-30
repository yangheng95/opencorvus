import { expect, test } from "bun:test"
import { createVisualQaOutputTools } from "@/visual-qa/output-tools"

test("visual QA commits parallel check and dependent coverage as one turn-local graph", async () => {
  const output = createVisualQaOutputTools()
  const execute = (name: string, input: unknown) =>
    (output.materializeExact(name) as { execute: (input: unknown, options: unknown) => Promise<unknown> }).execute(
      input,
      {},
    )

  const [checkResult, coverageResult] = await Promise.all([
    execute("register_visual_qa_check_item", {
      id: "check-layout",
      category: "component-truth",
      question: "Does the rendered layout preserve the required structure?",
      region: "main",
      status: "passed",
      expected: "The required structure is visible.",
      observed: "The required structure is visible.",
      viewports: [],
      states: ["default"],
      source_refs: [],
      evidence_refs: [],
    }),
    execute("register_visual_qa_coverage", {
      check_ids: ["check-layout"],
      region: "main",
      viewports: [],
      states: ["default"],
      source_refs: [],
      evidence_refs: [],
      notes: "Main layout inspected.",
    }),
  ])

  expect(checkResult).toBe('OK: visual QA check_item "check-layout" registered (1 total)')
  expect(coverageResult).toBe('OK: visual QA coverage "main" registered (1 total)')
  const snapshot = await output.snapshotReview()
  expect(snapshot.review).toMatchObject({
    check_items: [{ id: "check-layout" }],
    coverage: [{ region: "main", check_ids: ["check-layout"] }],
  })
})
