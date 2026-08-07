import { expect, test } from "bun:test"
import { runPostCommitUiEffect } from "../src/services/diagnostics"

test("post-commit UI failures are diagnostic-only and cannot escape to mutation callers", () => {
  let attempted = false

  expect(() =>
    runPostCommitUiEffect({ id: "delete:committed", title: "Deletion committed" }, () => {
      attempted = true
      throw new Error("local projection unavailable")
    }),
  ).not.toThrow()
  expect(attempted).toBe(true)
})
