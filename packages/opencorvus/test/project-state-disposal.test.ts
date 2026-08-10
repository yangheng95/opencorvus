import { expect, test } from "bun:test"
import { State } from "@/project/state"

test("project state disposal unwinds dependencies once when a disposer resets an earlier dependency", async () => {
  const key = `state-disposal-reentrant-${Date.now()}-${Math.random()}`
  let dependencyDisposals = 0
  let ownerDisposals = 0
  const dependency = State.create(
    () => key,
    () => ({}),
    async () => {
      dependencyDisposals += 1
    },
    "reentrant dependency",
  )
  const owner = State.create(
    () => key,
    () => ({}),
    async () => {
      ownerDisposals += 1
      await dependency.reset()
    },
    "reentrant owner",
  )
  dependency()
  owner()

  await State.dispose(key)

  expect({ dependencyDisposals, ownerDisposals }).toEqual({ dependencyDisposals: 1, ownerDisposals: 1 })
})

test("project state disposal continues unwinding after one disposer fails", async () => {
  const key = `state-disposal-error-${Date.now()}-${Math.random()}`
  let dependencyDisposals = 0
  let failingDisposals = 0
  const dependency = State.create(
    () => key,
    () => ({}),
    async () => {
      dependencyDisposals += 1
    },
    "error dependency",
  )
  const failing = State.create(
    () => key,
    () => ({}),
    async () => {
      failingDisposals += 1
      throw new Error("expected disposal failure")
    },
    "failing owner",
  )
  dependency()
  failing()

  await expect(State.dispose(key)).rejects.toThrow("expected disposal failure")

  expect({ dependencyDisposals, failingDisposals }).toEqual({ dependencyDisposals: 1, failingDisposals: 1 })
})

test("project state disposal reports a failing reentrant reset without repeating its disposer", async () => {
  const key = `state-disposal-reentrant-error-${Date.now()}-${Math.random()}`
  let dependencyDisposals = 0
  let ownerDisposals = 0
  let nestedFailure = ""
  let dependencyShouldFail = true
  const dependency = State.create(
    () => key,
    () => ({}),
    async () => {
      dependencyDisposals += 1
      if (dependencyShouldFail) throw new Error("expected reentrant disposal failure")
    },
    "failing reentrant dependency",
  )
  const owner = State.create(
    () => key,
    () => ({}),
    async () => {
      ownerDisposals += 1
      try {
        await dependency.reset()
      } catch (error) {
        nestedFailure = error instanceof Error ? error.message : String(error)
      }
    },
    "reentrant failure owner",
  )
  dependency()
  owner()

  await expect(State.dispose(key)).rejects.toThrow("expected reentrant disposal failure")

  expect({ dependencyDisposals, ownerDisposals, nestedFailure }).toEqual({
    dependencyDisposals: 1,
    ownerDisposals: 1,
    nestedFailure: "expected reentrant disposal failure",
  })
  expect(dependency.inspectAll().map((item) => item.key)).toEqual([key])

  dependencyShouldFail = false
  await dependency.reset()
  expect({ dependencyDisposals, remaining: dependency.inspectAll() }).toEqual({ dependencyDisposals: 2, remaining: [] })
})
