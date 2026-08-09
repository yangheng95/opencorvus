import assert from "node:assert/strict"
import test from "node:test"
import { mergeWindows } from "../src/windows.js"

test("merges overlapping, nested, and chained windows with stable labels", () => {
  assert.deepEqual(
    mergeWindows([
      { start: 8, end: 12, labels: ["deploy"] },
      { start: 1, end: 5, labels: ["cache", "api"] },
      { start: 4, end: 9, labels: ["api", "database"] },
      { start: 2, end: 3, labels: ["nested"] },
    ]),
    [{ start: 1, end: 12, labels: ["api", "cache", "database", "deploy", "nested"] }],
  )
})

test("keeps adjacent windows distinct", () => {
  assert.deepEqual(
    mergeWindows([
      { start: 0, end: 2, labels: ["a"] },
      { start: 2, end: 4, labels: ["b"] },
    ]),
    [
      { start: 0, end: 2, labels: ["a"] },
      { start: 2, end: 4, labels: ["b"] },
    ],
  )
})

test("rejects malformed windows with the typed error contract", () => {
  assert.throws(
    () => mergeWindows([{ start: 4, end: 3, labels: ["bad"] }]),
    (error) => error instanceof RangeError && error.code === "INVALID_WINDOW",
  )
})
