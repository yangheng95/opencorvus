import assert from "node:assert/strict"
import test from "node:test"
import { dependencyWaves } from "../src/waves.js"

test("builds deterministic waves and waits for every fan-in predecessor", () => {
  assert.deepEqual(
    dependencyWaves({
      release: ["package", "audit"],
      audit: ["lint", "test"],
      package: ["build"],
      test: ["build"],
      lint: [],
      build: [],
    }),
    [["build", "lint"], ["package", "test"], ["audit"], ["release"]],
  )
})

test("is independent of object insertion order", () => {
  const first = { c: ["a", "b"], b: [], a: [] }
  const second = { a: [], c: ["b", "a"], b: [] }
  assert.deepEqual(dependencyWaves(first), [["a", "b"], ["c"]])
  assert.deepEqual(dependencyWaves(second), [["a", "b"], ["c"]])
})

test("reports the sorted members of a dependency cycle", () => {
  assert.throws(
    () => dependencyWaves({ gamma: ["beta"], alpha: ["gamma"], beta: ["alpha"], free: [] }),
    (error) =>
      error?.name === "DependencyCycleError" &&
      error?.code === "DEPENDENCY_CYCLE" &&
      JSON.stringify(error?.nodes) === JSON.stringify(["alpha", "beta", "gamma"]),
  )
})
