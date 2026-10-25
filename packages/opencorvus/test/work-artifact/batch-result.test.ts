import { expect, test } from "bun:test"
import { assertCompleteWorkArtifactBatch, WorkArtifactBatchError } from "../../src/work-artifact/presentation"

test("a complete native batch authorizes the entire typed plan", () => {
  const result = {
    success: true,
    data: {
      results: [
        { index: 0, success: true },
        { index: 1, success: true },
      ],
      summary: { total: 2, executed: 2, succeeded: 2, failed: 0, skipped: 0 },
    },
  }
  expect(assertCompleteWorkArtifactBatch(result, 2)).toBeUndefined()
})
test("a partial native batch returns the explicit authoring error with repair evidence", () => {
  const result = {
    success: true,
    data: {
      results: [{ index: 0, success: false, error: "Invalid cell type" }],
      summary: { total: 2, executed: 1, succeeded: 0, failed: 1, skipped: 1 },
    },
  }
  expect(() => assertCompleteWorkArtifactBatch(result, 2)).toThrow(WorkArtifactBatchError)
  expect(() => assertCompleteWorkArtifactBatch(result, 2)).toThrow("Invalid cell type")
})
