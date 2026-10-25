import { expect, test } from "bun:test"
import {
  assertCompleteWorkArtifactBatch,
  WorkArtifactBatchError,
  WorkArtifactRuntimeError,
  parseWorkArtifactRuntimeJson,
} from "../../src/work-artifact/presentation"

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

test("native exit diagnostics retain actual standard output, error output and the original cause", () => {
  const cause = new Error("Original process failure")
  const error = new WorkArtifactRuntimeError(
    "OfficeCLI batch failed",
    { exit_code: 1, stdout: '{"success":false,"error":"Actual native save error"}', stderr: "Native error detail" },
    cause,
  )
  expect({ name: error.name, cause: error.cause, message: error.message }).toEqual({
    name: "WorkArtifactRuntimeError",
    cause,
    message:
      'OfficeCLI batch failed: {"exit_code":1,"stdout":"{\\"success\\":false,\\"error\\":\\"Actual native save error\\"}","stderr":"Native error detail"}',
  })
})

test("a JSON runtime failure returns its current error class and actual diagnostic", () => {
  expect(() =>
    parseWorkArtifactRuntimeJson(Buffer.from('{"success":false,"error":"Invalid native column width"}'), "OfficeCLI"),
  ).toThrow('OfficeCLI did not report success: {"success":false,"error":"Invalid native column width"}')
})
