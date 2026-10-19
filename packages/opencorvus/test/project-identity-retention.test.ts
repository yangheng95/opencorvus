import { afterEach, expect, test } from "bun:test"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("one retained identity scope preserves nested owners and State through idle convergence and explicit refresh", async () => {
  await using first = await tmpdir()
  await using second = await tmpdir()
  const disposed: string[] = []
  const state = createInstanceState(
    () => ({ directory: Instance.directory }),
    async (value) => {
      disposed.push(value.directory)
    },
    "retained-identity-scope",
  )
  await Instance.withRetainedProjectIdentities({
    directories: [first.path],
    fn: async () => {
      const original = await Instance.provideProjectIdentity({ directory: first.path, fn: state })
      await Instance.withRetainedProjectIdentities({
        directories: [second.path],
        fn: async () => {
          await Instance.provideProjectIdentity({ directory: second.path, fn: state })
        },
      })
      const converged = await Instance.converge({ maximumRetained: 1 })
      expect({ retained: converged.retained, active: converged.active }).toEqual({ retained: 2, active: 2 })
      const refreshed = await Instance.provideProjectIdentity({
        directory: first.path,
        fn: async () => {
          const context = await Instance.refresh()
          expect(context.directory).toBe(first.path)
          return state()
        },
      })
      expect(refreshed).toBe(original)
      const repeated = await Instance.converge({ maximumRetained: 1 })
      expect({ retained: repeated.retained, active: repeated.active }).toEqual({ retained: 2, active: 2 })
    },
  })
  const released = await Instance.converge({ maximumRetained: 1 })
  expect({ retained: released.retained, active: released.active, disposed: released.disposed }).toEqual({
    retained: 1,
    active: 0,
    disposed: [second.path],
  })
  expect(disposed).toEqual([second.path])
})

test("a failed identity scope preserves its original error and releases every physical lease", async () => {
  await using first = await tmpdir()
  await using second = await tmpdir()
  const failure = new Error("declared identity scope failure")
  const result = await Instance.withRetainedProjectIdentities({
    directories: [first.path, second.path],
    fn: async () => {
      await Instance.provideProjectIdentity({ directory: first.path, fn: () => Instance.project.id })
      await Instance.provideProjectIdentity({ directory: second.path, fn: () => Instance.project.id })
      throw failure
    },
  }).catch((error) => error)
  expect(result).toBe(failure)
  const released = await Instance.converge({ maximumRetained: 1 })
  expect({ retained: released.retained, active: released.active, disposed: released.disposed }).toEqual({
    retained: 1,
    active: 0,
    disposed: [first.path],
  })
})

test("outside work settles its own identity while the original scope retains its Project", async () => {
  await using first = await tmpdir()
  await using outside = await tmpdir()
  await Instance.withRetainedProjectIdentities({
    directories: [first.path],
    fn: async () => {
      const original = await Instance.provideProjectIdentity({ directory: first.path, fn: () => Instance.current() })
      await runOutsideInstanceContext(async () => {
        const identity = await Instance.provideProjectIdentity({
          directory: outside.path,
          fn: () => Instance.current(),
        })
        expect(identity?.directory).toBe(outside.path)
      })
      const converged = await Instance.converge({ maximumRetained: 1 })
      expect({ retained: converged.retained, active: converged.active, disposed: converged.disposed }).toEqual({
        retained: 1,
        active: 1,
        disposed: [outside.path],
      })
      expect(await Instance.provideProjectIdentity({ directory: first.path, fn: () => Instance.current() })).toBe(
        original,
      )
    },
  })
})

test("declared cached identities belong to the scope before its first Project callback", async () => {
  await using first = await tmpdir()
  await using second = await tmpdir()
  const directories = [first.path, second.path]
  const identities = await Promise.all(
    directories.map((directory) =>
      Instance.provideProjectIdentity({
        directory,
        fn: () => Instance.current(),
      }),
    ),
  )
  await Instance.withRetainedProjectIdentities({
    directories,
    fn: async () => {
      const retained = await Instance.converge({ maximumRetained: 1 })
      expect({ retained: retained.retained, active: retained.active }).toEqual({ retained: 2, active: 2 })
      const current = await Promise.all(
        directories.map((directory) => Instance.provideProjectIdentity({ directory, fn: () => Instance.current() })),
      )
      current.forEach((identity, index) => expect(identity).toBe(identities[index]))
    },
  })
})
